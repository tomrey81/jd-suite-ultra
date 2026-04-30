import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { z } from 'zod';
import { headers } from 'next/headers';
import { generateToken, hashToken, newAuthTokenId, MAGIC_LINK_TTL_MS } from '@/lib/auth/tokens';
import { sendEmail, MagicLinkEmail } from '@/lib/auth/email';
import { checkRateLimit } from '@/lib/admin/rate-limit';

export const dynamic = 'force-dynamic';

const Body = z.object({ email: z.string().email().max(254) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Provide a valid email' }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  const rl = await checkRateLimit(`magic:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many sign-in requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  const user = await db.user.findUnique({ where: { email } });

  // Same security posture as forgot-password: don't leak existence.
  // Magic link is only sent if account exists. (We don't auto-create accounts
  // here — registration goes through /register with the access-code gate.)
  if (user) {
    const raw = generateToken();
    await db.authToken.create({
      data: {
        id: newAuthTokenId(),
        kind: 'magic',
        tokenHash: hashToken(raw),
        email,
        userId: user.id,
        expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS),
        issuedIp: ip === 'unknown' ? null : ip,
      },
    });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jd-suite-pro.vercel.app';
    const link = `${appUrl}/api/auth/magic-link/verify?token=${raw}`;
    await sendEmail({
      to: email,
      subject: MagicLinkEmail.subject,
      text: MagicLinkEmail.text(link),
      html: MagicLinkEmail.html(link),
    });
  }

  return NextResponse.json({
    ok: true,
    message: 'If an account exists for that email, a sign-in link has been sent.',
  });
}
