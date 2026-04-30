import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { auth } from '@/lib/auth';
import { sanitizeText } from '@/lib/admin/sanitize';

export const dynamic = 'force-dynamic';

interface SavePayload {
  roles: string[];
  steps: Array<{
    step: string;
    rasci: Record<string, string>;
    confirmed?: boolean;
    note?: string;
  }>;
  replaceExisting?: boolean;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Scope to user's org (multi-tenant safety)
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { org: { createdAt: 'desc' } },
    select: { orgId: true },
  });
  if (!membership) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 });
  }
  const orgId = membership.orgId;

  const body = (await req.json().catch(() => null)) as SavePayload | null;
  if (!body || !Array.isArray(body.steps) || !Array.isArray(body.roles)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const cleanRoles = Array.from(new Set(
    body.roles.map((r) => sanitizeText(r, 200)).filter(Boolean)
  ));

  await db.$transaction(async (tx) => {
    if (body.replaceExisting) {
      await tx.process.deleteMany({ where: { orgId } });
      await tx.processRole.deleteMany({ where: { orgId } });
    }
    // Upsert roles
    for (const name of cleanRoles) {
      await tx.processRole.upsert({
        where: { orgId_name: { orgId, name } },
        create: { orgId, name },
        update: {},
      });
    }
    // Insert steps
    let order = 0;
    for (const s of body.steps) {
      const stepText = sanitizeText(s.step, 1000);
      if (!stepText) continue;
      const cleanRasci: Record<string, string> = {};
      for (const [role, val] of Object.entries(s.rasci || {})) {
        const v = String(val).toUpperCase();
        if (['R', 'A', 'S', 'C', 'I'].includes(v)) {
          cleanRasci[sanitizeText(role, 200)] = v;
        }
      }
      await tx.process.create({
        data: {
          orgId,
          step: stepText,
          rasci: cleanRasci,
          confirmed: !!s.confirmed,
          note: s.note ? sanitizeText(s.note, 1000) : null,
          sortOrder: order++,
        },
      });
    }
  });

  return NextResponse.json({ ok: true, savedSteps: body.steps.length, savedRoles: cleanRoles.length });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { org: { createdAt: 'desc' } },
    select: { orgId: true },
  });
  if (!membership) {
    return NextResponse.json({ steps: [], roles: [] });
  }
  const [processes, roles] = await Promise.all([
    db.process.findMany({
      where: { orgId: membership.orgId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    db.processRole.findMany({
      where: { orgId: membership.orgId },
      orderBy: { name: 'asc' },
    }),
  ]);
  return NextResponse.json({
    steps: processes.map((p) => ({
      id: p.id,
      step: p.step,
      rasci: p.rasci,
      confirmed: p.confirmed,
      note: p.note ?? '',
    })),
    roles: roles.map((r) => r.name),
  });
}
