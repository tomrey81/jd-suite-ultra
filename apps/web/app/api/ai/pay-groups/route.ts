import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { z } from 'zod';
import { buildText } from '@/lib/jd-helpers';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/lib/default-template';
import type { TemplateSection } from '@jd-suite/types';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// ── POST /api/ai/pay-groups — AI-powered initial pay group suggestion ─────────
// Based on EIGE toolkit & EUPTD 2023/970 Article 4 criteria:
// Skills, Effort, Responsibility, Working Conditions

const schema = z.object({
  jdIds: z.array(z.string()).min(2).max(50),
});

function safeParseJson(text: string): any {
  try { return JSON.parse(text); } catch { /* fallthrough */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fallthrough */ } }
  const arr = text.match(/\[[\s\S]*\]/);
  if (arr) { try { return JSON.parse(arr[0]); } catch { /* fallthrough */ } }
  return null;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = session.orgId;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Provide jdIds array (2-50 items)' }, { status: 400 });
  }
  const { jdIds } = parsed.data;

  // Fetch all JDs with their eval results
  const jds = await db.jobDescription.findMany({
    where: { id: { in: jdIds }, orgId },
    include: {
      template: true,
      evalResults: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  if (jds.length < 2) {
    return NextResponse.json({ error: 'At least 2 JDs required for grouping' }, { status: 400 });
  }

  // Build JD summaries for the AI prompt
  const jdSummaries = jds.map((jd) => {
    const sections: TemplateSection[] =
      (jd.template?.sections as TemplateSection[]) ?? DEFAULT_TEMPLATE_SECTIONS;
    const data = (jd.data as Record<string, string>) ?? {};
    const evalResult = jd.evalResults[0];
    const criteria = evalResult ? ((evalResult.criteria as any[]) ?? []) : [];

    const suffCount = criteria.filter((c: any) => c.status === 'sufficient').length;
    const gapCount  = criteria.filter((c: any) => c.status === 'insufficient').length;
    const partCount = criteria.filter((c: any) => c.status === 'partial').length;

    const text = buildText(data, sections).slice(0, 1200);

    return {
      id: jd.id,
      title: jd.jobTitle || data.jobTitle || 'Untitled',
      orgUnit: jd.orgUnit || data.orgUnit || '',
      family: data.jobFamily || '',
      positionType: data.positionType || '',
      evalScore: evalResult?.overallScore ?? null,
      suffCount,
      partCount,
      gapCount,
      criteria: criteria.map((c: any) => ({ n: c.criterion, s: c.status })).slice(0, 16),
      snippet: text.slice(0, 600),
    };
  });

  const prompt = `You are an expert in job evaluation and EU Pay Transparency Directive 2023/970 compliance.

Your task: group the following ${jds.length} job descriptions into pay equity groups based on EIGE gender-neutral job evaluation criteria:
1. **Skills & Knowledge** (education, experience, technical expertise)
2. **Effort & Complexity** (cognitive demands, problem-solving, planning scope)
3. **Responsibility** (people managed, budget authority, decision scope, impact)
4. **Working Conditions** (physical/emotional demands, environment, travel)

Per Article 4 of the Directive, jobs of "equal value" — meaning jobs that are similar across these 4 dimensions — should be grouped together, regardless of job title.

JOBS TO GROUP:
${JSON.stringify(jdSummaries, null, 2)}

RULES:
- Create 2-${Math.min(6, Math.ceil(jds.length / 2))} pay groups based on the actual spread of role complexity/scope
- Each group must have a name that describes the VALUE level (e.g., "Operational Support", "Specialist Professional", "Senior Expert", "Senior Manager", "Executive/Director")
- Assign EVERY JD to exactly one group
- Write a brief rationale for each group (max 2 sentences)
- For each JD placement, write a one-sentence justification

Return ONLY valid JSON with this structure:
{
  "groups": [
    {
      "name": "Group name (value level descriptor)",
      "color": "#HEX color from this set: #8A7560 | #2D7A4F | #A0601A | #5B6CB5 | #9E2B1D",
      "description": "Brief rationale (max 2 sentences)",
      "jdIds": ["id1", "id2"]
    }
  ],
  "rationale": "Overall grouping rationale in 2-3 sentences referencing EUPTD Article 4 criteria"
}`;

  // Two-attempt pattern for robustness
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const promptToUse = attempt === 2
        ? prompt + '\n\nIMPORTANT: Return ONLY the JSON object. No markdown, no explanation. Start with { and end with }.'
        : prompt;

      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        messages: [{ role: 'user', content: promptToUse }],
      });

      const rawText = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');

      const data = safeParseJson(rawText);

      if (!data || !Array.isArray(data.groups) || data.groups.length < 1) {
        if (attempt === 2) throw new Error('AI returned malformed grouping data');
        continue;
      }

      // Validate all JD IDs are accounted for
      const assignedIds = data.groups.flatMap((g: any) => g.jdIds ?? []);
      const unassigned = jdIds.filter((id) => !assignedIds.includes(id));

      if (unassigned.length > 0 && attempt === 2) {
        // Assign unassigned JDs to the most appropriate group (largest)
        const largestGroup = data.groups.reduce((a: any, b: any) =>
          (b.jdIds?.length ?? 0) > (a.jdIds?.length ?? 0) ? b : a
        );
        largestGroup.jdIds = [...(largestGroup.jdIds ?? []), ...unassigned];
      }

      return NextResponse.json({
        groups: data.groups,
        rationale: data.rationale ?? '',
        jdCount: jds.length,
        _attempt: attempt,
      });
    } catch (err) {
      if (attempt === 2) {
        return NextResponse.json(
          { error: 'AI grouping failed after 2 attempts', detail: String(err) },
          { status: 502 },
        );
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
}
