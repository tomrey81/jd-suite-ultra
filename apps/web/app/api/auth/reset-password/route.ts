import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { hashToken } from '@/lib/auth/tokens';

export const dynamic = 'force-dynamic';

const Body = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(12).max(128),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const { token, password } = parsed.data;

  const tokenHash = hashToken(token);
  const record = await db.authToken.findUnique({ where: { tokenHash } });
  if (!record || record.kind !== 'reset' || record.usedAt || record.expiresAt < new Date() || !record.userId) {
    return NextResponse.json({ error: 'Invalid or expired link. Request a new one.' }, { status: 400 });
  }

  const passwordHash = await hash(password, 12);

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId! },
      data: { passwordHash },
    });
    await tx.authToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    });
    // Burn any other reset tokens for this user — defence-in-depth
    await tx.authToken.updateMany({
      where: { userId: record.userId!, kind: 'reset', usedAt: null },
      data: { usedAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true });
}
