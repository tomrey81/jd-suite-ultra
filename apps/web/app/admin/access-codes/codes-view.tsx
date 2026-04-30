'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Code = {
  id: string; code: string; label: string | null;
  maxUses: number | null; usesCount: number;
  expiresAt: Date | null; active: boolean; createdAt: Date;
};

export function CodesView({ initialCodes }: { initialCodes: Code[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ code: '', label: '', maxUses: '', expiresAt: '' });

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy('new'); setError(null);
    const res = await fetch('/api/admin/access-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: form.code || undefined,
        label: form.label || undefined,
        maxUses: form.maxUses ? parseInt(form.maxUses, 10) : null,
        expiresAt: form.expiresAt || null,
      }),
    });
    setBusy(null);
    if (!res.ok) { setError((await res.json()).error || 'Failed'); return; }
    setShowNew(false); setForm({ code: '', label: '', maxUses: '', expiresAt: '' });
    router.refresh();
  }

  async function toggle(c: Code) {
    setBusy(`t-${c.id}`); setError(null);
    const res = await fetch(`/api/admin/access-codes/${c.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    });
    setBusy(null);
    if (!res.ok) { setError((await res.json()).error || 'Failed'); return; }
    router.refresh();
  }

  async function del(c: Code) {
    if (!confirm(`Delete code ${c.code}? Use-history will also be deleted.`)) return;
    setBusy(`d-${c.id}`); setError(null);
    const res = await fetch(`/api/admin/access-codes/${c.id}`, { method: 'DELETE' });
    setBusy(null);
    if (!res.ok) { setError((await res.json()).error || 'Failed'); return; }
    router.refresh();
  }

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="admin-btn primary" onClick={() => setShowNew((s) => !s)}>
          {showNew ? 'Cancel' : '+ New code'}
        </button>
      </div>

      {error && <div style={{ background: 'var(--err-bg)', color: 'var(--danger)', padding: 8, borderRadius: 6, marginBottom: 12, fontSize: 12 }}>{error}</div>}

      {showNew && (
        <div className="admin-card">
          <h2>New access code</h2>
          <form className="admin-form" onSubmit={create}>
            <label>
              Code (leave blank to auto-generate)
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="JDS-XXXXXXXX" style={{ fontFamily: 'var(--font-mono)' }} />
            </label>
            <label>
              Label (e.g. "Beta wave 1")
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </label>
            <label>
              Max uses (blank = unlimited)
              <input type="number" min={1} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
            </label>
            <label>
              Expires (blank = never)
              <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </label>
            <button className="admin-btn action" type="submit" disabled={busy === 'new'}>
              {busy === 'new' ? 'Creating…' : 'Create code'}
            </button>
          </form>
        </div>
      )}

      <div className="admin-card">
        <h2>All codes</h2>
        {initialCodes.length === 0 ? (
          <div className="admin-empty">No access codes yet. Create one above.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th><th>Label</th><th>Uses</th><th>Limit</th><th>Expires</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {initialCodes.map((c) => {
                const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
                const exhausted = c.maxUses != null && c.usesCount >= c.maxUses;
                return (
                  <tr key={c.id}>
                    <td><code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.code}</code></td>
                    <td>{c.label || '—'}</td>
                    <td>{c.usesCount}</td>
                    <td>{c.maxUses ?? '∞'}</td>
                    <td>{c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 10) : '—'}</td>
                    <td>
                      {!c.active ? <span className="admin-pill muted">disabled</span> :
                       expired ? <span className="admin-pill err">expired</span> :
                       exhausted ? <span className="admin-pill warn">exhausted</span> :
                       <span className="admin-pill ok">active</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="admin-btn sm" disabled={busy === `t-${c.id}`} onClick={() => toggle(c)}>
                          {c.active ? 'Disable' : 'Enable'}
                        </button>
                        <button className="admin-btn sm danger" disabled={busy === `d-${c.id}`} onClick={() => del(c)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
