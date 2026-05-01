import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { callClaude } from '@/lib/ai';
import { z } from 'zod';

export const maxDuration = 30;

const requestSchema = z.object({
  jdText: z.string().min(1).max(60000),
});

// ── JSON parsing with truncation detection ────────────────────────────────────
function safeParseJson(raw: string): { ok: true; data: any } | { ok: false; error: string } {
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return { ok: true, data: JSON.parse(cleaned) };
  } catch {
    // Attempt to extract the largest JSON object/array fragment
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return { ok: true, data: JSON.parse(match[0]) };
      } catch {
        // fall through
      }
    }
    return {
      ok: false,
      error: `Response was truncated or malformed. Raw length: ${raw.length} chars. First 200: ${raw.slice(0, 200)}`,
    };
  }
}

const SONIC_REVIEW_SYSTEM = `You are a senior HR quality auditor and job description specialist.
Your role is to identify specific, actionable quality issues in job descriptions.
Always return valid JSON only — no markdown, no explanation outside JSON.
Be specific: quote exact phrases, name exact fields/sections.
Focus on issues a pay equity auditor or DEI specialist would flag first.`;

const buildPrompt = (jdText: string, wordCount: number) => `Analyze this job description (${wordCount} words) for quality issues.

JD TEXT:
${jdText}

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "issues": [
    {
      "id": "ai_001",
      "severity": "critical",
      "type": "bias",
      "title": "Brief issue title (max 60 chars)",
      "description": "Specific description with quoted text or section name",
      "sonicNote": "Why this registers as a sonic anomaly in the melody (1 sentence metaphor)",
      "location": "Exact quote (max 80 chars) or section label where issue appears",
      "fix": "Specific, actionable fix recommendation",
      "fixedSnippet": "Ready-to-use replacement text for the location quote (omit if not applicable)"
    }
  ],
  "overallScore": 72,
  "overallAssessment": "2-3 sentence plain text assessment of JD quality",
  "readyForDecision": false
}

Severity levels: "critical" (bias, legal risk), "warning" (quality gap), "info" (style suggestion).
Types: "bias", "missing_section", "vague", "inconsistency", "grade_inflation", "duplication", "structure".
Find 3-8 specific issues. Prefer critical/warning over info.
For fixedSnippet: provide the corrected text to replace the exact location quote. Omit if location is a whole section.
overallScore: 0-100 overall quality score (0=unusable, 100=publication-ready).`;

// POST /api/ai/sonic-review
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { jdText } = parsed.data;
  const wordCount = jdText.trim().split(/\s+/).length;

  // Completeness gate — Claude needs enough content for meaningful analysis
  if (wordCount < 30) {
    return NextResponse.json(
      {
        error: 'JD too short for meaningful AI analysis',
        wordCount,
        minRequired: 30,
        hint: 'Add at least a job title, brief purpose, and key responsibilities.',
      },
      { status: 422 },
    );
  }

  // Primary attempt: full prompt
  try {
    const raw = await callClaude(SONIC_REVIEW_SYSTEM, buildPrompt(jdText, wordCount), 4000,
      { operation: 'jd.sonicReview', context: { orgId: session?.orgId, userId: session?.user?.id } });
    const result = safeParseJson(raw);

    if (!result.ok) {
      throw new Error(result.error);
    }

    const data = result.data;

    // Validate response has minimum required structure
    if (!Array.isArray(data.issues)) {
      throw new Error('Response missing "issues" array — Claude may have returned partial JSON');
    }

    // Validate each issue has the required fields; filter out malformed ones
    const validIssues = data.issues.filter(
      (iss: any) =>
        iss &&
        typeof iss.id === 'string' &&
        typeof iss.severity === 'string' &&
        typeof iss.description === 'string' &&
        typeof iss.fix === 'string',
    );

    return NextResponse.json({
      issues: validIssues,
      overallScore: typeof data.overallScore === 'number' ? data.overallScore : null,
      overallAssessment: data.overallAssessment ?? null,
      readyForDecision: data.readyForDecision ?? false,
      wordCount,
    });
  } catch (primaryErr: any) {
    console.error('[sonic-review] Primary attempt failed:', primaryErr.message);

    // Fallback: simplified prompt requesting fewer fields — more likely to complete in token budget
    try {
      const fallbackPrompt = `List 3-5 quality issues in this JD (${wordCount} words):\n\n${jdText.slice(0, 3000)}\n\nReturn JSON: {"issues":[{"id":"ai_001","severity":"warning","type":"vague","title":"Issue title","description":"Specific issue","sonicNote":"Sonic metaphor","location":"quote or section","fix":"Fix recommendation","fixedSnippet":""}],"overallScore":60,"overallAssessment":"Brief assessment","readyForDecision":false}`;

      const fallbackRaw = await callClaude(
        'Return valid JSON only. No markdown. No explanation.',
        fallbackPrompt,
        2000,
        { operation: 'jd.sonicReview.fallback', context: { orgId: session?.orgId, userId: session?.user?.id } },
      );

      const fallbackResult = safeParseJson(fallbackRaw);
      if (fallbackResult.ok && Array.isArray(fallbackResult.data.issues)) {
        return NextResponse.json({
          ...fallbackResult.data,
          wordCount,
          _fallback: true, // signal to client that this used the reduced prompt
        });
      }
    } catch (fallbackErr: any) {
      console.error('[sonic-review] Fallback also failed:', fallbackErr.message);
    }

    return NextResponse.json(
      {
        error: 'AI analysis failed',
        hint: 'Sonic heuristic issues are still shown. Try again or check your API key.',
        wordCount,
      },
      { status: 500 },
    );
  }
}
