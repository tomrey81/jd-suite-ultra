import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/jd/[id]/eval — record an Axiomera evaluation result for this JD.
// Auto-places the JD in the Job Architecture matrix at the suggested grade
// (computed from R+S+E sub-scores or overall score) when a familyId is provided.
const evalSchema = z.object({
  /** Overall score 0-100 (proxy for evaluation strength) */
  overallScore: z.number().int().min(0).max(100),
  /** Optional R/S/E/WC sub-scores from Axiomera */
  subScores: z.object({
    R: z.number().optional(),
    S: z.number().optional(),
    E: z.number().optional(),
    WC: z.number().optional(),
  }).optional(),
  /** Axiomera band code (A1..E5) — if provided, used directly for matrix grade */
  bandCode: z.string().regex(/^[A-E][1-5]$/).optional(),
  /** Source of the evaluation, free-form note */
  source: z.string().max(200).optional(),
  /** Optional family to auto-place the JD in (matrix sync) */
  familyId: z.string().optional(),
  /** Optional explicit grade override (6-30); if set, bypasses score-derived grade */
  manualGrade: z.number().int().min(6).max(30).optional(),
  /** Optional note attached to the matrix slot */
  placementNote: z.string().max(500).optional(),
});

function bandCodeToGrade(code: string): number | null {
  const m = /^([A-E])([1-5])$/i.exec(code.trim());
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const offset = parseInt(m[2], 10);
  const bandStart: Record<string, number> = { A: 6, B: 11, C: 16, D: 21, E: 26 };
  return bandStart[letter] + offset - 1;
}

function overallScoreToGrade(score: number): number {
  return Math.max(6, Math.min(30, Math.round(6 + (score / 100) * 24)));
}

function gradeFromSubScores(subs: { R?: number; S?: number; E?: number }): number | null {
  if (subs.R == null && subs.S == null && subs.E == null) return null;
  const sum = (subs.R ?? 0) + (subs.S ?? 0) + (subs.E ?? 0);
  return Math.max(6, Math.min(30, Math.round(sum / 50)));
}

export async function POST(req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = session.orgId;
  const { id } = await params;

  let body: z.infer<typeof evalSchema>;
  try {
    body = evalSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json({ error: 'Invalid request', details: err.message }, { status: 400 });
  }

  const jd = await db.jobDescription.findFirst({
    where: { id, orgId },
    include: { evalResults: { orderBy: { version: 'desc' }, take: 1, select: { version: true } } },
  });
  if (!jd) return NextResponse.json({ error: 'JD not found' }, { status: 404 });

  // 1. Create the EvalResult
  const nextVersion = (jd.evalResults[0]?.version ?? 0) + 1;
  const criteria = body.subScores
    ? Object.entries(body.subScores).map(([k, v]) => ({ id: k, label: k, score: v }))
    : [];

  // 2. Compute the suggested grade from inputs (priority: manual > band > R+S+E > overall)
  let suggestedGrade: number;
  let gradeSource: string;
  if (body.manualGrade != null) {
    suggestedGrade = body.manualGrade;
    gradeSource = 'manual';
  } else if (body.bandCode) {
    suggestedGrade = bandCodeToGrade(body.bandCode) ?? overallScoreToGrade(body.overallScore);
    gradeSource = `band ${body.bandCode}`;
  } else if (body.subScores) {
    suggestedGrade = gradeFromSubScores(body.subScores) ?? overallScoreToGrade(body.overallScore);
    gradeSource = 'R+S+E formula';
  } else {
    suggestedGrade = overallScoreToGrade(body.overallScore);
    gradeSource = `overallScore proxy`;
  }

  const result = await db.$transaction(async (tx) => {
    const evalResult = await tx.evalResult.create({
      data: {
        jdId: id,
        version: nextVersion,
        criteria: criteria as any,
        overallScore: body.overallScore,
        createdById: session!.user.id,
      },
    });

    // 3. Audit trail
    await tx.jDVersion.create({
      data: {
        jdId: id,
        authorId: session!.user.id,
        authorType: 'USER',
        changeType: 'EVALUATION',
        note: `Axiomera evaluation v${nextVersion} · score ${body.overallScore} · grade ${suggestedGrade} (${gradeSource})${body.source ? ` · source: ${body.source}` : ''}`,
      },
    });

    // 4. If a family is given, upsert the matrix slot at the suggested grade
    let slot = null;
    if (body.familyId) {
      const family = await tx.jobFamily.findFirst({ where: { id: body.familyId, orgId } });
      if (family) {
        slot = await tx.jobArchitectureSlot.upsert({
          where: { jdId: id },
          create: {
            orgId: orgId!,
            familyId: body.familyId,
            jdId: id,
            level: suggestedGrade,
            note: body.placementNote || `Auto-placed from Axiomera evaluation (grade ${suggestedGrade}, ${gradeSource})`,
            placedBy: session!.user.id,
          },
          update: {
            familyId: body.familyId,
            level: suggestedGrade,
            note: body.placementNote || `Updated from Axiomera evaluation v${nextVersion}`,
            placedBy: session!.user.id,
            placedAt: new Date(),
          },
        });
      }
    }

    return { evalResult, slot, suggestedGrade, gradeSource };
  });

  return NextResponse.json({
    ok: true,
    evalResult: result.evalResult,
    slot: result.slot,
    suggestedGrade: result.suggestedGrade,
    gradeSource: result.gradeSource,
  }, { status: 201 });
}
