import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { runLint } from '@/lib/lint/score';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-opus-4-6';

const SYSTEM = `You are a governance-grade JD rewriter.
Your output must comply with the EU Pay Transparency Directive (2023/970), remove bias-coded language, and follow the 25-rule rubric used by the JD Governance Console:
 · Structure 30% — title, purpose, responsibilities (≥3), min education & experience, org unit, length 150–1200 words, no HTML.
 · Bias 35% — no masculine/feminine-coded words, no age-coded terms, no "native speaker", no ableist language, no gendered pronouns, reasonable years of experience.
 · EUPTD 35% — disclose pay range (or note TBD), gender-neutral title, objective & gender-neutral criteria, include work-value factors (skills, effort, responsibility, working conditions), no salary-history question, transparent progression criteria, proposed grade, local language.

Return ONLY a JSON object: {"rewritten": "...", "changes": ["bullet 1", "bullet 2", ...]}.
Keep the JD concise (400–900 words). Preserve the applicant's locale and industry context. Use plain, inclusive language.`;

export async function POST(req: NextRequest) {
  try {
    const { text = '', fields = {} } = await req.json();
    if (!text || typeof text !== 'string' || text.trim().length < 20) {
      return NextResponse.json({ error: 'text must be at least 20 chars' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

    const beforeLint = runLint(text, fields);

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Rewrite this JD for governance compliance. Current lint score: ${beforeLint.total}/100 (Structure ${beforeLint.structure.score}, Bias ${beforeLint.bias.score}, EUPTD ${beforeLint.euptd.score}).\n\nTop findings:\n${beforeLint.findings.slice(0, 10).map(f => `- [${f.severity}] ${f.ruleId}: ${f.message}`).join('\n')}\n\nCurrent JD:\n\n${text}`,
        },
      ],
    });

    const rawText = msg.content
      .filter((b: Anthropic.ContentBlock) => b.type === 'text')
      .map((b) => ('text' in b ? b.text : ''))
      .join('\n');

    let parsed: { rewritten: string; changes: string[] } = { rewritten: '', changes: [] };
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
    }
    if (!parsed.rewritten) parsed = { rewritten: rawText.trim(), changes: [] };

    const afterLint = runLint(parsed.rewritten, fields);

    return NextResponse.json({
      before: { text, lint: beforeLint },
      after: { text: parsed.rewritten, lint: afterLint },
      changes: parsed.changes,
      delta: afterLint.total - beforeLint.total,
      model: MODEL,
      usage: msg.usage,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'rewrite failed' },
      { status: 500 },
    );
  }
}
