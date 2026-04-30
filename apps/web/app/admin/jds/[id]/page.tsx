import Link from 'next/link';
import { db } from '@jd-suite/db';
import { computeJDHash } from '@/lib/admin/hash';
import { CheckoutPanel } from './checkout-panel';

export const dynamic = 'force-dynamic';

export default async function JDDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const jd = await db.jobDescription.findUnique({
    where: { id },
    include: {
      org: true,
      owner: { select: { email: true, name: true } },
      versions: {
        orderBy: { timestamp: 'desc' },
        take: 100,
        include: { author: { select: { email: true, name: true } } },
      },
    },
  });

  if (!jd) {
    return (
      <>
        <header className="admin-page-head"><h1>JD not found</h1></header>
        <div className="admin-card admin-empty">No job description with id {id}.</div>
      </>
    );
  }

  const checkouts = await db.jDCheckout.findMany({
    where: { jdId: id },
    orderBy: { checkedOutAt: 'desc' },
    take: 50,
  });

  const currentHash = computeJDHash(jd);
  const openCheckout = checkouts.find((c) => c.status === 'CHECKED_OUT');

  return (
    <>
      <header className="admin-page-head">
        <div>
          <Link href="/admin/jds" style={{ color: 'var(--action)', fontSize: 12, textDecoration: 'none' }}>← All JDs</Link>
          <h1 style={{ marginTop: 4 }}>{jd.jobTitle || '(untitled JD)'}</h1>
          <p>{jd.org.name} · {jd.orgUnit || 'no orgUnit'} · owner: {jd.owner.email}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '.12em' }}>Current hash (sha256)</div>
          <div className="admin-hash" style={{ wordBreak: 'break-all', maxWidth: 360 }}>{currentHash}</div>
        </div>
      </header>

      <CheckoutPanel
        jdId={jd.id}
        currentHash={currentHash}
        openCheckout={openCheckout ? {
          id: openCheckout.id,
          checkoutHash: openCheckout.checkoutHash,
          checkedOutAt: openCheckout.checkedOutAt,
          note: openCheckout.note,
        } : null}
      />

      <div className="admin-card">
        <h2>Checkout history ({checkouts.length})</h2>
        {checkouts.length === 0 ? (
          <div className="admin-empty">No checkouts yet for this JD.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th><th>Status</th><th>Checkout hash</th><th>Check-in hash</th><th>Tamper?</th><th>Note</th>
              </tr>
            </thead>
            <tbody>
              {checkouts.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    {new Date(c.checkedOutAt).toISOString().replace('T', ' ').slice(0, 19)}
                    {c.checkedInAt && <div style={{ color: 'var(--ink-4)' }}>→ {new Date(c.checkedInAt).toISOString().replace('T', ' ').slice(0, 19)}</div>}
                  </td>
                  <td>
                    <span className={`admin-pill ${c.status === 'CHECKED_OUT' ? 'warn' : c.status === 'CHECKED_IN' ? 'ok' : 'muted'}`}>
                      {c.status.toLowerCase().replace('_', ' ')}
                    </span>
                  </td>
                  <td><span className="admin-hash">{c.checkoutHash.slice(0, 12)}…</span></td>
                  <td><span className="admin-hash">{c.checkinHash ? c.checkinHash.slice(0, 12) + '…' : '—'}</span></td>
                  <td>
                    {c.tamperFlag
                      ? <span className="admin-pill err">⚠ tampered</span>
                      : c.status === 'CHECKED_IN' ? <span className="admin-pill ok">match</span> : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-card">
        <h2>Audit timeline ({jd.versions.length} entries)</h2>
        {jd.versions.length === 0 ? (
          <div className="admin-empty">No version entries yet. JD changes will appear here.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th><th>Actor</th><th>Type</th><th>Field</th><th>Change</th><th>Note</th>
              </tr>
            </thead>
            <tbody>
              {jd.versions.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    {new Date(v.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                  </td>
                  <td>{v.author?.email || `[${v.authorType.toLowerCase()}]`}</td>
                  <td><span className="admin-pill info">{v.changeType.toLowerCase().replace('_', ' ')}</span></td>
                  <td>{v.fieldChanged || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)', maxWidth: 280 }}>
                    {v.oldValue || v.newValue ? (
                      <>
                        {v.oldValue && <div><span style={{ color: 'var(--danger)' }}>−</span> {v.oldValue.slice(0, 60)}</div>}
                        {v.newValue && <div><span style={{ color: 'var(--success)' }}>+</span> {v.newValue.slice(0, 60)}</div>}
                      </>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{v.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
