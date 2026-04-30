import { db } from '@jd-suite/db';
import { UsersTable } from './users-table';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, email: true, name: true, firstName: true, lastName: true,
      country: true, jobFunction: true, isPlatformAdmin: true,
      passwordHash: true, lastLoginAt: true, createdAt: true,
      memberships: { select: { role: true, org: { select: { id: true, name: true } } } },
    },
  });

  // Strip passwordHash before sending to client (only used to compute "active")
  const safe = users.map((u) => ({
    ...u,
    active: !!u.passwordHash,
    passwordHash: undefined,
  }));

  return (
    <>
      <header className="admin-page-head">
        <div>
          <h1>Users</h1>
          <p>Platform-wide user management. Showing latest 100. Search-filter coming next.</p>
        </div>
      </header>
      <div className="admin-card">
        <UsersTable initialUsers={safe} />
      </div>
    </>
  );
}
