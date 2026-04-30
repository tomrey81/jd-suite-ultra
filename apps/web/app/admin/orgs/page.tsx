import { db } from '@jd-suite/db';
import { OrgsTable } from './orgs-table';

export const dynamic = 'force-dynamic';

export default async function OrgsPage() {
  const orgs = await db.organisation.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { memberships: true, jobDescriptions: true } } },
  });

  return (
    <>
      <header className="admin-page-head">
        <div>
          <h1>Organisations</h1>
          <p>Each tenant is a separate organisation. Their JDs are isolated by orgId.</p>
        </div>
      </header>
      <div className="admin-card">
        <OrgsTable initialOrgs={orgs.map((o) => ({
          id: o.id, name: o.name, plan: o.plan,
          createdAt: o.createdAt,
          memberCount: o._count.memberships,
          jdCount: o._count.jobDescriptions,
        }))} />
      </div>
    </>
  );
}
