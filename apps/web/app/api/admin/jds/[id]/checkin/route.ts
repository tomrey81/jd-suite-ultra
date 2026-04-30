import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { requireAdminApi, requireAdminApiThrottled, isAdminResponse } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { computeJDHash } from '@/lib/admin/hash';

export const dynamic = 'force-dynamic';

// POST /api/admin/jds/[id]/checkin
// Recomputes hash on current JD content and compares with the open checkout's
// stored checkoutHash. Mismatch → tamperFlag = true.
//
// Body (optional): { abandon: true } to mark checkout abandoned without
// comparing — use when you decide not to bring changes back in.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApiThrottled();
  if (isAdminResponse(admin)) return admin;
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as { abandon?: boolean };

  const open = await db.jDCheckout.findFirst({
    where: { jdId: id, status: 'CHECKED_OUT' },
    orderBy: { checkedOutAt: 'desc' },
  });
  if (!open) return NextResponse.json({ error: 'No open checkout for this JD' }, { status: 404 });

  if (body.abandon) {
    await db.jDCheckout.update({
      where: { id: open.id },
      data: { status: 'ABANDONED', checkedInAt: new Date() },
    });
    await logAdminAction(admin.id, 'jd_checkout_abandoned', { jdId: id, checkoutId: open.id });
    return NextResponse.json({ ok: true, status: 'ABANDONED' });
  }

  const jd = await db.jobDescription.findUnique({ where: { id } });
  if (!jd) return NextResponse.json({ error: 'JD not found' }, { status: 404 });

  const currentHash = computeJDHash(jd);
  const tampered = currentHash !== open.checkoutHash;

  await db.jDCheckout.update({
    where: { id: open.id },
    data: {
      status: 'CHECKED_IN',
      checkinHash: currentHash,
      tamperFlag: tampered,
      checkedInAt: new Date(),
    },
  });

  await logAdminAction(admin.id, tampered ? 'jd_checkin_tamper_detected' : 'jd_checkin_ok', {
    jdId: id, checkoutId: open.id,
    checkoutHash: open.checkoutHash, currentHash,
  });

  return NextResponse.json({
    ok: true,
    tampered,
    checkoutHash: open.checkoutHash,
    currentHash,
    status: 'CHECKED_IN',
  });
}
