import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { encode } from 'next-auth/jwt';
import { hashToken } from '@/lib/auth/tokens';

export const dynamic = 'force-dynamic';

const COOKIE_NAME_PROD = '__Secure-authjs.session-token';
const COOKIE_NAME_DEV = 'authjs.session-token';
const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60; // match auth.ts (7 days)

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const raw = url.searchParams.get('token') || '';
  if (!raw) return errorResponse('Missing token');

  const tokenHash = hashToken(raw);
  const record = await db.authToken.findUnique({ where: { tokenHash } });
  if (!record || record.kind !== 'magic' || record.usedAt || record.expiresAt < new Date() || !record.userId) {
    return errorResponse('Invalid or expired link. Request a new one.');
  }

  const user = await db.user.findUnique({
    where: { id: record.userId },
    include: {
      memberships: { include: { org: true }, take: 1, orderBy: { org: { createdAt: 'desc' } } },
    },
  });
  if (!user) return errorResponse('Account not found.');

  // Atomically: consume token + bump lastLoginAt
  await db.$transaction([
    db.authToken.update({ where: { tokenHash }, data: { usedAt: new Date() } }),
    db.authToken.updateMany({
      where: { userId: record.userId, kind: 'magic', usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);

  // Build session JWT in the exact shape auth.ts callbacks expect.
  const membership = user.memberships[0];
  const tokenPayload = {
    sub: user.id,
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    picture: user.image ?? null,
    orgId: membership?.orgId,
    orgRole: membership?.role,
  };

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return errorResponse('Server misconfigured (missing AUTH_SECRET).');

  const isProd = process.env.NODE_ENV === 'production';
  const cookieName = isProd ? COOKIE_NAME_PROD : COOKIE_NAME_DEV;
  const salt = cookieName;

  const encoded = await encode({
    token: tokenPayload,
    secret,
    salt,
    maxAge: SESSION_MAX_AGE_S,
  });

  const res = NextResponse.redirect(new URL('/', req.url));
  res.cookies.set(cookieName, encoded, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}

function errorResponse(msg: string): NextResponse {
  // Tiny styled HTML so the user lands on something coherent if the link is dead.
  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>JD Suite — link issue</title>
<style>
  body { font-family: -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif; background:#FAF7F2; color:#1A1A1A; margin:0; min-height:100vh; display:grid; place-items:center; padding:24px; }
  .card { max-width:440px; background:#fff; border-radius:14px; padding:28px; box-shadow:0 4px 24px rgba(0,0,0,0.06); }
  h1 { font-family: Georgia, serif; font-size:22px; margin:0 0 6px; }
  p { font-size:14px; line-height:1.6; color:#55524A; }
  a { color:#8A7560; }
  .btn { display:inline-block; background:#1A1A1A; color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; font-size:13px; font-weight:500; margin-top:14px; }
</style></head>
<body><div class="card">
<h1>JD Suite</h1>
<p>${escapeHtml(msg)}</p>
<a class="btn" href="/login">← Back to sign in</a>
</div></body></html>`;
  return new NextResponse(html, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
