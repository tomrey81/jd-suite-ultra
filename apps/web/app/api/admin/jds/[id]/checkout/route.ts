import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { requireAdminApi, requireAdminApiThrottled, isAdminResponse } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { computeJDHash } from '@/lib/admin/hash';
import { sanitizeText } from '@/lib/admin/sanitize';

export const dynamic = 'force-dynamic';

// POST /api/admin/jds/[id]/checkout
// Creates a snapshot + SHA-256 hash of current JD content. Caller can later
// "check in" by POSTing the (possibly modified) content; if hash differs,
// tamperFlag is raised on the checkout record.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApiThrottled();
  if (isAdminResponse(admin)) return admin;
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as { note?: string };
  const note = sanitizeText(body.note, 500) || null;

  // Refuse if there's already an open checkout — would create ambiguity
  const open = await db.jDCheckout.findFirst({ where: { jdId: id, status: 'CHECKED_OUT' } });
  if (open) {
    return NextResponse.json({
      error: 'JD already has an open checkout. Check it in first.',
      checkoutId: open.id,
    }, { status: 409 });
  }

  const jd = await db.jobDescription.findUnique({ where: { id } });
  if (!jd) return NextResponse.json({ error: 'JD not found' }, { status: 404 });

  const hash = computeJDHash(jd);

  const checkout = await db.jDCheckout.create({
    data: {
      jdId: id,
      actorId: admin.id,
      checkoutHash: hash,
      snapshot: { jobTitle: jd.jobTitle, jobCode: jd.jobCode, orgUnit: jd.orgUnit, status: jd.status, data: jd.data ?? {} } as unknown as object,
      note,
    },
  });

  await logAdminAction(admin.id, 'jd_checkout', { jdId: id, checkoutId: checkout.id, hash });
  return NextResponse.json({
    ok: true,
    checkoutId: checkout.id,
    hash,
    hashAlgo: 'sha256',
    checkedOutAt: checkout.checkedOutAt,
  });
}
