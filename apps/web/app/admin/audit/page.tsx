import { db } from '@jd-suite/db';

export const dynamic = 'force-dynamic';

export default async function AdminAuditPage() {
  const log = await db.adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  // Resolve actor emails in one query
  const actorIds = Array.from(new Set(log.map((l) => l.actorId).filter(Boolean) as string[]));
  const users = actorIds.length > 0 ? await db.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, email: true },
  }) : [];
  const userMap = new Map(users.map((u) => [u.id, u.email]));

  return (
    <>
      <header className="admin-page-head">
        <div>
          <h1>Admin log</h1>
          <p>Every panel-level write is recorded here. Latest 200 entries.</p>
        </div>
      </header>

      <div className="admin-card">
        {log.length === 0 ? (
          <div className="admin-empty">No admin actions yet. Try editing a user, creating a code, or running a JD checkout.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th><th>Actor</th><th>Action</th><th>Detail</th><th>IP</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="admin-hash">{new Date(l.createdAt).toISOString().replace('T', ' ').slice(0, 19)}</td>
                  <td>{l.actorId ? userMap.get(l.actorId) || l.actorId.slice(0, 8) : '—'}</td>
                  <td><span className="admin-pill info">{l.action}</span></td>
                  <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', maxWidth: 480, wordBreak: 'break-all' }}>
                    {l.detail ? JSON.stringify(l.detail) : '—'}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--ink-4)' }}>{l.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
