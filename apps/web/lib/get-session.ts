import { db } from '@jd-suite/db';

// TEMPORARY BYPASS — returns first user and org for all requests
// Replace with real auth() call when auth is properly configured
export async function getSession() {
  const user = await db.user.findFirst();
  if (!user) return null;

  const membership = await db.membership.findFirst({
    where: { userId: user.id },
  });

  return {
    user: { id: user.id, email: user.email, name: user.name },
    orgId: membership?.orgId,
    orgRole: membership?.role,
  };
}
