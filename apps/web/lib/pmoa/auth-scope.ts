import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { NextResponse } from 'next/server';

/**
 * Resolve the logged-in user's primary org. Every PMOA route uses this
 * to enforce multi-tenant scoping. Returns NextResponse on failure for
 * direct return from API handlers.
 */
export async function requireOrgScope(): Promise<
  | { orgId: string; userId: string }
  | NextResponse
> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { org: { createdAt: 'desc' } },
    select: { orgId: true },
  });
  if (!membership) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 });
  }
  return { orgId: membership.orgId, userId: session.user.id };
}

export function isScopeError(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}
