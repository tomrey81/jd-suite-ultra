import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { z } from 'zod';
import { headers } from 'next/headers';
import { generateToken, hashToken, newAuthTokenId, RESET_TOKEN_TTL_MS } from '@/lib/auth/tokens';
import { sendEmail, ResetEmail } from '@/lib/auth/email';
import { checkRateLimit } from '@/lib/admin/rate-limit';

export const dynamic = 'force-dynamic';

const Body = z.object({ email: z.string().email().max(254) });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Provide a valid email' }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  // Rate limit: 5 reset requests / hour / IP
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  const rl = await checkRateLimit(`forgot:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many reset requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  const user = await db.user.findUnique({ where: { email } });

  // Always return success — don't leak whether the email exists.
  // If user found, issue token and send email.
  if (user) {
    const raw = generateToken();
    await db.authToken.create({
      data: {
        id: newAuthTokenId(),
        kind: 'reset',
        tokenHash: hashToken(raw),
        email,
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        issuedIp: ip === 'unknown' ? null : ip,
      },
    });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jd-suite-pro.vercel.app';
    const link = `${appUrl}/reset-password?token=${raw}`;
    await sendEmail({
      to: email,
      subject: ResetEmail.subject,
      text: ResetEmail.text(link),
      html: ResetEmail.html(link),
    });
  }

  return NextResponse.json({ ok: true, message: 'If an account exists for that email, a reset link has been sent.' });
}
