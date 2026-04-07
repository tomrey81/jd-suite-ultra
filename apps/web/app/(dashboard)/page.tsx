import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { redirect } from 'next/navigation';
import { WorkspaceView } from '@/components/workspace/workspace-view';

export default async function WorkspacePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const orgId = (session as any).orgId;
  if (!orgId) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center text-text-muted">
          <p>No organisation found. Please contact support.</p>
        </div>
      </div>
    );
  }

  const [jds, templates] = await Promise.all([
    db.jobDescription.findMany({
      where: { orgId },
      orderBy: { updatedAt: 'desc' },
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
}
