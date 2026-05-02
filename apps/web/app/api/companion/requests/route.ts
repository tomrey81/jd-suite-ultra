import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';

const saveSchema = z.object({
  prompt: z.string().min(1).max(8000),
  reply: z.string().min(1).max(8000),
  context: z.record(z.unknown()).optional(),
});

export async function GET() {
  const session = await getSession().catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requests = await db.companionRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, prompt: true, reply: true, context: true, createdAt: true },
  });

  return NextResponse.json({ requests });
}

export async function POST(req: Request) {
  const session = await getSession().catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { prompt, reply, context } = parsed.data;

  const record = await db.companionRequest.create({
    data: {
      userId: session.user.id,
      orgId: session.orgId ?? null,
      prompt,
      reply,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      context: (context ?? {}) as any,
    },
  });

  return NextResponse.json({ id: record.id }, { status: 201 });
}
