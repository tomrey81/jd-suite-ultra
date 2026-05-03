import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { FLAGS } from '@/lib/feature-flags';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

const DEFAULT_WEIGHTS = { R: 0.472, S: 0.333, E: 0.195 };

export async function GET(_req: NextRequest) {
  if (!FLAGS.SEALED_PROGRAMS) {
    return NextResponse.json({ error: 'Not enabled' }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const membership = await db.membership.findFirst({
    where: { userId },
    select: { orgId: true },
  });
  if (!membership) {
    return NextResponse.json({ error: 'No org membership found' }, { status: 403 });
  }

  const programs = await db.jdqProgram.findMany({
    where: { orgId: membership.orgId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ programs });
}

export async function POST(req: NextRequest) {
  if (!FLAGS.SEALED_PROGRAMS) {
    return NextResponse.json({ error: 'Not enabled' }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const membership = await db.membership.findFirst({
    where: { userId },
    select: { orgId: true, role: true },
  });
  if (!membership) {
    return NextResponse.json({ error: 'No org membership found' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, description, weights } = body as {
    name?: string;
    description?: string;
    weights?: Record<string, number>;
  };

  if (!name || name.trim() === '') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const program = await db.jdqProgram.create({
    data: {
      id: randomUUID(),
      orgId: membership.orgId,
      name: name.trim(),
      description: description?.trim() || null,
      weights: weights || DEFAULT_WEIGHTS,
      status: 'DRAFT',
      sealed: false,
      createdById: userId,
    },
  });

  return NextResponse.json({ ok: true, program }, { status: 201 });
}
