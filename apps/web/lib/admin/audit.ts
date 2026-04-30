import { db } from '@jd-suite/db';
import { headers } from 'next/headers';

/**
 * Append a panel-level audit entry. Mirrors the playbook's `logHistory` —
 * every admin write must go through this, no exceptions.
 */
export async function logAdminAction(
  actorId: string | null,
  action: string,
  detail?: Record<string, unknown> | null,
): Promise<void> {
  let ip: string | null = null;
  try {
    const h = await headers();
    ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  } catch {
    // not in request scope
  }
  try {
    await db.adminAuditLog.create({
      data: {
        actorId,
        action,
        detail: (detail as object | undefined) ?? undefined,
        ip,
      },
    });
  } catch (err) {
    // Audit MUST not block the user's action; log to console instead.
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write entry:', (err as Error).message);
  }
}
