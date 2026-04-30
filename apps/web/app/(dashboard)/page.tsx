import { db } from '@jd-suite/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { WorkspaceView } from '@/components/workspace/workspace-view';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage() {
  try {
    const session = await auth();
    if (!session?.user?.id) redirect('/login?callbackUrl=/');

    // Scope to the logged-in user's org. Without this, every user sees
    // the same (alphabetically-first) org's JDs — a multi-tenant leak.
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      orderBy: { org: { createdAt: 'desc' } },
      select: { orgId: true },
    });
    const orgId = membership?.orgId;

    if (!orgId) {
      return (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="rounded-lg border border-border-default bg-white p-8 text-center">
            <h2 className="mb-2 font-display text-lg font-bold text-text-primary">Welcome to JD Suite</h2>
            <p className="text-sm text-text-muted">Your account isn&apos;t attached to an organisation yet.</p>
            <p className="mt-2 text-xs text-text-muted">Contact your admin to be added.</p>
          </div>
        </div>
      );
    }

    const [jds, templates] = await Promise.all([
      db.jobDescription.findMany({
        where: { orgId },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        include: {
          owner: { select: { name: true, email: true } },
          _count: { select: { comments: true, versions: true } },
        },
      }),
      db.template.findMany({
        where: { OR: [{ orgId }, { orgId: null }] },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return <WorkspaceView jds={jds} templates={templates} />;
  } catch (error: any) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-lg rounded-lg border border-danger bg-danger-bg p-6">
          <h2 className="mb-2 font-display text-lg font-bold text-danger">Database Connection Error</h2>
          <p className="mb-3 text-sm text-text-secondary">{error?.message || 'Unknown error'}</p>
          <pre className="overflow-auto rounded bg-white p-3 text-xs text-text-muted">
            {error?.stack?.slice(0, 500) || 'No stack trace'}
          </pre>
          <p className="mt-3 text-xs text-text-muted">
            DATABASE_URL is {process.env.DATABASE_URL ? 'set (' + process.env.DATABASE_URL.slice(0, 30) + '...)' : 'NOT SET'}
          </p>
        </div>
      </div>
    );
  }
}
