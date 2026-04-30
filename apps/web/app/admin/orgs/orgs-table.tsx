'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Org = {
  id: string; name: string; plan: string;
  createdAt: Date; memberCount: number; jdCount: number;
};

export function OrgsTable({ initialOrgs }: { initialOrgs: Org[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rename(o: Org) {
    const next = prompt(`Rename organisation "${o.name}" to:`, o.name);
    if (!next || next === o.name) return;
    setBusy(`r-${o.id}`); setError(null);
    const res = await fetch('/api/admin/orgs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: o.id, name: next }),
    });
    setBusy(null);
    if (!res.ok) { setError((await res.json()).error || 'Failed'); return; }
    router.refresh();
  }

  async function del(o: Org) {
    const confirmText = `DELETE ${o.name}`;
    const got = prompt(`This will DELETE the organisation, all its ${o.memberCount} members, all ${o.jdCount} JDs, and ALL audit history. This cannot be undone.\n\nType exactly:  ${confirmText}\nto confirm:`);
    if (got !== confirmText) return;
    setBusy(`d-${o.id}`); setError(null);
    const res = await fetch(`/api/admin/orgs/${o.id}`, { method: 'DELETE' });
    setBusy(null);
    if (!res.ok) { setError((await res.json()).error || 'Failed'); return; }
    router.refresh();
  }

  return (
    <>
      {error && <div style={{ background: 'var(--err-bg)', color: 'var(--danger)', padding: 8, borderRadius: 6, marginBottom: 12, fontSize: 12 }}>{error}</div>}
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th><th>Plan</th><th>Members</th><th>JDs</th><th>Created</th><th></th>
          </tr>
        </thead>
        <tbody>
          {initialOrgs.map((o) => (
            <tr key={o.id}>
              <td><span style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}>{o.name}</span></td>
              <td><span className="admin-pill muted">{o.plan}</span></td>
              <td>{o.memberCount}</td>
              <td>{o.jdCount}</td>
              <td>{new Date(o.createdAt).toISOString().slice(0, 10)}</td>
              <td>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="admin-btn sm" disabled={busy === `r-${o.id}`} onClick={() => rename(o)}>Rename</button>
                  <button className="admin-btn sm danger" disabled={busy === `d-${o.id}`} onClick={() => del(o)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
