import Link from 'next/link';
import { db } from '@jd-suite/db';

export const dynamic = 'force-dynamic';

export default async function JDsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string; status?: string }>;
}) {
  const sp = await searchParams;

  const where: Record<string, unknown> = {};
  if (sp.orgId) where.orgId = sp.orgId;
  if (sp.status) where.status = sp.status;

  const [jds, orgs] = await Promise.all([
    db.jobDescription.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true, jobTitle: true, jobCode: true, orgUnit: true,
        status: true, folder: true, updatedAt: true,
        org: { select: { id: true, name: true } },
        owner: { select: { email: true } },
        _count: { select: { versions: true, payGroupMembers: true } },
      },
    }),
    db.organisation.findMany({ orderBy: { name: 'asc' } }),
  ]);

  // Mark JDs with active checkouts (red dot)
  const openCheckouts = await db.jDCheckout.findMany({
    where: { status: 'CHECKED_OUT', jdId: { in: jds.map((j) => j.id) } },
    select: { jdId: true, tamperFlag: true },
  });
  const openMap = new Map(openCheckouts.map((c) => [c.jdId, c.tamperFlag]));

  return (
    <>
      <header className="admin-page-head">
        <div>
          <h1>JDs &amp; Audit</h1>
          <p>Cross-tenant job descriptions. Click a JD to view its full audit timeline and run checkout/check-in with hash verification.</p>
        </div>
      </header>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <h2>Filter</h2>
        <form method="GET" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '.12em' }}>Organisation</span>
            <select name="orgId" defaultValue={sp.orgId ?? ''} className="admin-input" style={{ padding: '6px 10px', border: '1px solid var(--hair-strong)', borderRadius: 6, minWidth: 220 }}>
              <option value="">All</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '.12em' }}>Status</span>
            <select name="status" defaultValue={sp.status ?? ''} style={{ padding: '6px 10px', border: '1px solid var(--hair-strong)', borderRadius: 6 }}>
              <option value="">All</option>
              <option value="DRAFT">Draft</option>
              <option value="UNDER_REVISION">Under revision</option>
              <option value="APPROVED">Approved</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <button className="admin-btn primary" type="submit">Apply</button>
          {(sp.orgId || sp.status) && (
            <Link href="/admin/jds" className="admin-btn">Clear</Link>
          )}
        </form>
      </div>

      <div className="admin-card">
        <h2>{jds.length} job descriptions {sp.orgId || sp.status ? '(filtered)' : ''}</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Title</th>
              <th>Org</th>
              <th>Folder</th>
              <th>Status</th>
              <th>Audit entries</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jds.map((jd) => {
              const isCheckedOut = openMap.has(jd.id);
              const tamperOnOpen = openMap.get(jd.id);
              return (
                <tr key={jd.id}>
                  <td style={{ width: 16 }}>
                    {isCheckedOut && (
                      <span title={tamperOnOpen ? 'Tamper flag raised' : 'Checked out'} style={{
                        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                        background: tamperOnOpen ? 'var(--danger)' : 'var(--warn)',
                      }} />
                    )}
                  </td>
                  <td>
                    <Link href={`/admin/jds/${jd.id}`} style={{ color: 'var(--ink-1)', fontWeight: 500, textDecoration: 'none' }}>
                      {jd.jobTitle || <em style={{ color: 'var(--ink-5)' }}>(untitled)</em>}
                    </Link>
                    {jd.jobCode && <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{jd.jobCode}</div>}
                  </td>
                  <td><span style={{ fontSize: 12 }}>{jd.org.name}</span></td>
                  <td>{jd.folder ? <span className="admin-pill muted">{jd.folder}</span> : '—'}</td>
                  <td>
                    <span className={`admin-pill ${jd.status === 'APPROVED' ? 'ok' : jd.status === 'ARCHIVED' ? 'muted' : 'info'}`}>
                      {jd.status.toLowerCase().replace('_', ' ')}
                    </span>
                  </td>
                  <td>{jd._count.versions}</td>
                  <td>{new Date(jd.updatedAt).toISOString().slice(0, 16).replace('T', ' ')}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link href={`/admin/jds/${jd.id}`} className="admin-btn sm">Open →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
