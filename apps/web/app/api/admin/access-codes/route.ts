import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@jd-suite/db';
import { requireAdminApi, requireAdminApiThrottled, isAdminResponse } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { sanitizeText } from '@/lib/admin/sanitize';

export const dynamic = 'force-dynamic';

function generateCode(prefix = 'JDS'): string {
  // 32 bits of entropy in base32-ish form. Easy to read aloud.
  const raw = randomBytes(8).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8);
  return `${prefix}-${raw}`;
}

export async function GET() {
  const admin = await requireAdminApi();
  if (isAdminResponse(admin)) return admin;
  const codes = await db.accessCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { uses: true } } },
  });
  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApiThrottled();
  if (isAdminResponse(admin)) return admin;

  const body = await req.json().catch(() => ({})) as {
    code?: string; label?: string; maxUses?: number | null; expiresAt?: string | null;
  };

  const code = sanitizeText(body.code, 80) || generateCode();
  const label = sanitizeText(body.label, 120) || null;
  const maxUses = typeof body.maxUses === 'number' && body.maxUses > 0 ? body.maxUses : null;
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: 'Invalid expiry date' }, { status: 400 });
  }

  try {
    const created = await db.accessCode.create({
      data: { code, label, maxUses, expiresAt, createdById: admin.id },
    });
    await logAdminAction(admin.id, 'access_code_created', { id: created.id, code: created.code, label });
    return NextResponse.json({ ok: true, code: created });
  } catch (err) {
    if ((err as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
