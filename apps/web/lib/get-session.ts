import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { logger } from '@/lib/logger';

export async function getSession() {
  const session = await auth();
  if (!session?.user?.id) return null;

  let membership = null;
  try {
    membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    });
  } catch (err) {
    logger.warn('db.cold-start', err, { userId: session.user.id });
  }

  return {
    user: { id: session.user.id, email: session.user.email ?? '', name: session.user.name ?? null },
    orgId: (session as any).orgId ?? membership?.orgId,
    orgRole: (session as any).orgRole ?? membership?.role,
  };
}
