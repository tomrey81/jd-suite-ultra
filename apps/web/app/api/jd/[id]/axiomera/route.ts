/**
 * POST /api/jd/[id]/axiomera/run
 * GET  /api/jd/[id]/axiomera          (latest run + history)
 *
 * Gated by ENABLE_AXIOMERA_ENGINE feature flag. Returns 404 when off, so
 * Ultra behaves identically to Pro for any client probing this URL.
 *
 * In SHADOW mode (ENABLE_AXIOMERA_SHADOW_MODE=true, default), GET only
 * returns runs to admin/platform-admin users. Everyone else gets 404.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { FLAGS } from '@/lib/feature-flags';
import { runAxiomera } from '@/lib/axiomera/run';

const runInputSchema = z.object({
  declaredEdu: z.number().int().min(1).max(5).optional(),
  declaredExp: z.number().int().min(1).max(5).optional(),
  declaredIsco2: z.number().int().min(1).max(99).optional(),
  declaredJobZone: z.number().int().min(1).max(5).optional(),
  programId: z.string().uuid().optional(),
});

function flagDisabled() {
  return NextResponse.json({ error: 'feature_disabled' }, { status: 404 });
}

async function isAdmin(session: Awaited<ReturnType<typeof getSession>>): Promise<boolean> {
  if (!session?.user) return false;
  // Platform-admin lookup (session may not include the flag directly)
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (user?.isPlatformAdmin) return true;
  return session.orgRole === 'OWNER' || session.orgRole === 'ADMIN';
}

async function loadJdWithText(
  jdId: string,
  orgId: string | undefined,
): Promise<{ id: string; text: string; orgId: string } | null> {
  if (!orgId) return null;
  const jd = await db.jobDescription.findFirst({
    where: { id: jdId, orgId },
    select: { id: true, orgId: true, data: true, jobTitle: true },
  });
  if (!jd) return null;

  // Flatten the JD data JSON into a single text block for the engine.
  // Pro stores JD content as { fieldId: stringOrNull } map; concatenate populated values.
  let text = '';
  if (jd.jobTitle) text += `${jd.jobTitle}\n\n`;
  const data = (jd.data as Record<string, unknown>) || {};
  for (const [fieldId, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      text += `[${fieldId}]\n${value.trim()}\n\n`;
    }
  }
  return { id: jd.id, text, orgId: jd.orgId };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!FLAGS.AXIOMERA_ENGINE) return flagDisabled();

  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const jd = await loadJdWithText(id, session.orgId);
  if (!jd) {
    return NextResponse.json({ error: 'JD not found' }, { status: 404 });
  }
  if (jd.text.trim().length < 80) {
    return NextResponse.json(
      { error: 'JD content too short for Axiomera evaluation', minChars: 80 },
      { status: 400 },
    );
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parse = runInputSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parse.error.flatten() },
      { status: 400 },
    );
  }
  const declared = parse.data;

  try {
    const result = await runAxiomera({
      jdId: jd.id,
      jdText: jd.text,
      declaredEdu: declared.declaredEdu as 1 | 2 | 3 | 4 | 5 | undefined,
      declaredExp: declared.declaredExp as 1 | 2 | 3 | 4 | 5 | undefined,
      declaredIsco2: declared.declaredIsco2,
      declaredJobZone: declared.declaredJobZone as 1 | 2 | 3 | 4 | 5 | undefined,
      programId: declared.programId,
      context: { orgId: session.orgId, userId: session.user.id, jdId: jd.id },
      createdById: session.user.id,
    });
    return NextResponse.json({ ok: true, run: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: 'axiomera_run_failed', message: msg }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!FLAGS.AXIOMERA_ENGINE) return flagDisabled();

  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Shadow mode: only admins see results until ENABLE_AXIOMERA_SHADOW_MODE=false
  if (FLAGS.AXIOMERA_SHADOW_MODE && !(await isAdmin(session))) {
    return flagDisabled();
  }

  const { id } = await params;
  const jd = await loadJdWithText(id, session.orgId);
  if (!jd) {
    return NextResponse.json({ error: 'JD not found' }, { status: 404 });
  }

  const dbAny = db as unknown as {
    axiomeraRun: {
      findMany: (args: unknown) => Promise<unknown[]>;
    };
  };

  const runs = await dbAny.axiomeraRun.findMany({
    where: { jdId: jd.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return NextResponse.json({ runs });
}
