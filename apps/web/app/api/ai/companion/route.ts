import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import { callClaude } from '@/lib/ai';

export const maxDuration = 60;

/**
 * Krystyna — JD Suite AI Companion endpoint.
 *
 * Accepts a multi-turn conversation plus page context (current route, selected
 * JD, locale) and returns a reply. Uses the existing callClaude() helper so the
 * Anthropic API key stays server-side.
 *
 * This is intentionally a single endpoint that all pages share. Specialised
 * endpoints (honest-review, evaluate, end-session) remain for heavy workflows.
 */

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
  context: z
    .object({
      pathname: z.string().optional(),
      module: z.string().optional(),
      locale: z.string().optional(),
      companionName: z.string().max(32).optional(),
      selectedJD: z
        .object({
          id: z.string().optional(),
          jobTitle: z.string().optional(),
          status: z.string().optional(),
          dqsScore: z.number().optional(),
          ersScore: z.number().optional(),
        })
        .optional(),
      jdList: z
        .array(
          z.object({
            id: z.string(),
            title: z.string().optional(),
            status: z.string().optional(),
          }),
        )
        .max(50)
        .optional(),
      userRole: z.string().optional(),
    })
    .optional(),
});

const KRYSTYNA_SYSTEM = (ctx: z.infer<typeof requestSchema>['context']) => {
  const name = ctx?.companionName?.trim() || 'Krystyna';
  const locale = ctx?.locale || 'en';

  const lines: string[] = [
    `You are ${name} — the JD Suite AI Companion.`,
    '',
    'You help HR, Total Rewards, and Pay Transparency professionals manage Job Descriptions, Job Architecture, Org Structure, Process Maps, and Compliance work in JD Suite.',
    '',
    'PERSONA',
    '— Calm, precise, slightly playful but always professional.',
    '— Plain language, no marketing fluff, no jargon for the sake of it.',
    '— Plain text only: no markdown headers, no asterisks, no emoji icons. A single dash is fine for lists.',
    '— Keep replies short by default. Only go long when the user explicitly asks for detail.',
    '',
    'LANGUAGE',
    `— The user's interface language is: ${locale}.`,
    '— Respond in the same language the user writes in.',
    '— If the interface language is not English, default to that language for your replies unless the user explicitly writes in English.',
    '',
    'OPERATING PRINCIPLES',
    '1. Human decides always. You propose, analyse, detect, question, and summarise.',
    '2. Never overwrite approved JDs, architecture placements, process maps, or regulations. For material changes, prepare a draft and ask for confirmation.',
    '3. Never invent facts. If the JD or process is missing data, say what is missing instead of fabricating.',
    '4. Distinguish source-based content from inference and from your own proposals.',
    '5. Surface conflicts and inconsistencies — do not auto-resolve.',
    '6. Stay in JD Suite scope: JDs, org charts, job families, reporting lines, workflows, review/approval, audit trail, quality and readiness, exports.',
    '7. Job evaluation results come from Axiomera. You interpret evaluation scores, you do not assign them.',
    '',
    'WHAT YOU CAN OFFER',
    '— Quality and readiness assessment of a JD.',
    '— Gap analysis between JD and process map.',
    '— Drafting JD sections in two languages (mark anything that needs review).',
    '— Generating a Command Center task list, a workflow status table, or a reminder draft.',
    '— Explaining why a role sits at a given band based on its evaluation score.',
    '— Pointing the user to the next sensible step.',
    '— Sharing a direct link to a JD when relevant (format: /jd/{id}).',
    '',
    'When you are not sure what the user wants, ask one short clarifying question instead of guessing.',
  ];

  if (ctx?.jdList && ctx.jdList.length > 0) {
    lines.push('', 'WORKSPACE JDS (reference list — use /jd/{id} links when relevant)');
    for (const jd of ctx.jdList) {
      const parts: string[] = [`id=${jd.id}`];
      if (jd.title) parts.push(`title=${jd.title}`);
      if (jd.status) parts.push(`status=${jd.status}`);
      lines.push(`— ${parts.join(', ')}`);
    }
  }

  if (ctx?.pathname) {
    lines.push('', 'CURRENT CONTEXT');
    lines.push(`— Page: ${ctx.pathname}`);
    if (ctx.module) lines.push(`— Module: ${ctx.module}`);
    if (ctx.locale) lines.push(`— UI language: ${ctx.locale}`);
    if (ctx.userRole) lines.push(`— User role: ${ctx.userRole}`);
    if (ctx.selectedJD) {
      const jd = ctx.selectedJD;
      const parts: string[] = [];
      if (jd.jobTitle) parts.push(`title=${jd.jobTitle}`);
      if (jd.status) parts.push(`status=${jd.status}`);
      if (jd.dqsScore != null) parts.push(`DQS=${jd.dqsScore}%`);
      if (jd.ersScore != null) parts.push(`ERS=${jd.ersScore}%`);
      if (parts.length > 0) lines.push(`— Selected JD: ${parts.join(', ')}`);
    }
  }

  return lines.join('\n');
};

export async function POST(req: Request) {
  // Auth — fail closed
  const session = await getSession().catch(() => null);
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  // Parse + validate
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'BAD_REQUEST' },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten(), code: 'BAD_REQUEST' },
      { status: 400 },
    );
  }

  const { messages, context } = parsed.data;

  // Anthropic prefers messages array. callClaude() is single-turn, so we
  // serialise prior turns into a single user message with role markers — this
  // keeps the helper untouched while still giving Krystyna conversational memory.
  const lastUser = messages[messages.length - 1];
  if (lastUser.role !== 'user') {
    return NextResponse.json(
      { error: 'Last message must be from user', code: 'BAD_REQUEST' },
      { status: 400 },
    );
  }

  let userMessage = lastUser.content;
  if (messages.length > 1) {
    const history = messages
      .slice(0, -1)
      .map((m) => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
      .join('\n\n');
    userMessage = `Conversation so far:\n\n${history}\n\nLatest user message:\n${lastUser.content}`;
  }

  // Check API key — return graceful "not configured" instead of opaque 500
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          'AI Companion is not configured on this deployment. Add ANTHROPIC_API_KEY to your environment to enable Krystyna.',
        code: 'NOT_CONFIGURED',
      },
      { status: 503 },
    );
  }

  try {
    const text = await callClaude(KRYSTYNA_SYSTEM(context), userMessage, 1500,
      { operation: 'companion.message', context: { orgId: session?.orgId, userId: session?.user?.id } });
    return NextResponse.json({ reply: text.trim() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed';
    console.error('[Krystyna] error:', message);
    return NextResponse.json(
      { error: message, code: 'AI_ERROR' },
      { status: 502 },
    );
  }
}
