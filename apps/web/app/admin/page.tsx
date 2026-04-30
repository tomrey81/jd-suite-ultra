import { db } from '@jd-suite/db';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const [
    userCount, orgCount, jdCount, draftCount, approvedCount,
    archivedCount, codeCount, activeCheckouts, tamperCount, recentLog,
  ] = await Promise.all([
    db.user.count(),
    db.organisation.count(),
    db.jobDescription.count(),
    db.jobDescription.count({ where: { status: 'DRAFT' } }),
    db.jobDescription.count({ where: { status: 'APPROVED' } }),
    db.jobDescription.count({ where: { status: 'ARCHIVED' } }),
    db.accessCode.count({ where: { active: true } }),
    db.jDCheckout.count({ where: { status: 'CHECKED_OUT' } }),
    db.jDCheckout.count({ where: { tamperFlag: true } }),
    db.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);

  const stats = [
    { label: 'Users', value: userCount },
    { label: 'Organisations', value: orgCount },
    { label: 'Job Descriptions', value: jdCount, delta: `${draftCount} drafts · ${approvedCount} approved` },
    { label: 'Active access codes', value: codeCount },
    { label: 'Open checkouts', value: activeCheckouts, delta: tamperCount ? `${tamperCount} flagged tamper` : 'none flagged' },
    { label: 'Archived JDs', value: archivedCount },
  ];

  return (
    <>
      <header className="admin-page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Cross-tenant overview. Counts include archived rows where applicable.</p>
        </div>
      </header>

      <div className="admin-stats">
        {stats.map((s) => (
          <div key={s.label} className="admin-stat">
            <div className="label">{s.label}</div>
            <div className="value">{s.value}</div>
            {s.delta && <div className="delta">{s.delta}</div>}
          </div>
        ))}
      </div>

      <div className="admin-card">
        <h2>Recent admin actions</h2>
        {recentLog.length === 0 ? (
          <div className="admin-empty">No admin actions yet.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th><th>Actor</th><th>Action</th><th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {recentLog.map((log) => (
                <tr key={log.id}>
                  <td><span className="admin-hash">{new Date(log.createdAt).toISOString().replace('T', ' ').slice(0, 19)}</span></td>
                  <td>{log.actorId?.slice(0, 8) ?? '—'}</td>
                  <td><span className="admin-pill info">{log.action}</span></td>
                  <td><span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{log.detail ? JSON.stringify(log.detail) : '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
