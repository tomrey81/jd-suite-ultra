import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { z } from 'zod';

// Axiomera grade scheme: 6–30 (Bands A1–E5, Tabela 9 in WP).
// We accept 1–30 for backward compatibility with the legacy 1–25 UI; clients
// should prefer 6–30 for Axiomera-aligned grading.
const placeSchema = z.object({
  familyId: z.string().min(1),
  jdId: z.string().min(1),
  level: z.number().int().min(1).max(30),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = session.orgId;

  const body = await req.json().catch(() => null);
  const parsed = placeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  const { familyId, jdId, level, note } = parsed.data;

  const [family, jd] = await Promise.all([
    db.jobFamily.findFirst({ where: { id: familyId, orgId } }),
    db.jobDescription.findFirst({ where: { id: jdId, orgId } }),
  ]);

  if (!family) return NextResponse.json({ error: 'Family not found' }, { status: 404 });
  if (!jd) return NextResponse.json({ error: 'JD not found' }, { status: 404 });

  // Upsert — each JD can only be in one slot (unique constraint on jdId)
  const slot = await db.jobArchitectureSlot.upsert({
    where: { jdId },
    create: { orgId: orgId!, familyId, jdId, level, note, placedBy: session.user.id },
    update: { familyId, level, note, placedBy: session.user.id, placedAt: new Date() },
  });

  return NextResponse.json({ slot }, { status: 201 });
}
