'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  jobFunction: string | null;
  isPlatformAdmin: boolean;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  memberships: { role: string; org: { id: string; name: string } }[];
};

export function UsersTable({ initialUsers }: { initialUsers: User[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(fn: () => Promise<Response>, key: string) {
    setBusy(key); setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Failed' }));
        setError(e.error || 'Failed');
      } else {
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function toggleAdmin(u: User) {
    await call(() => fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, isPlatformAdmin: !u.isPlatformAdmin }),
    }), `admin-${u.id}`);
  }

  async function deactivate(u: User) {
    if (!confirm(`Deactivate ${u.email}? They'll no longer be able to log in.`)) return;
    await call(() => fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' }), `del-${u.id}`);
  }

  async function resetPassword(u: User) {
    const verb = u.active ? 'New password' : 'Reactivate — set new password';
    const pw = prompt(`${verb} for ${u.email} (min 12 chars):`);
    if (!pw) return;
    await call(() => fetch(`/api/admin/users/${u.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_password', newPassword: pw }),
    }), `pw-${u.id}`);
  }

  return (
    <>
      {error && <div style={{ background: 'var(--err-bg)', color: 'var(--danger)', padding: 8, borderRadius: 6, marginBottom: 12, fontSize: 12 }}>{error}</div>}
      <table className="admin-table">
        <thead>
          <tr>
            <th>Email</th><th>Name</th><th>Country</th><th>Function</th>
            <th>Org</th><th>Role</th><th>Last login</th><th></th>
          </tr>
        </thead>
        <tbody>
          {initialUsers.map((u) => (
            <tr key={u.id}>
              <td>
                {u.email}
                {!u.active && <span className="admin-pill err" style={{ marginLeft: 6 }}>inactive</span>}
              </td>
              <td>{u.name || '—'}</td>
              <td>{u.country || '—'}</td>
              <td>{u.jobFunction || '—'}</td>
              <td>{u.memberships[0]?.org.name || '—'}</td>
              <td>
                {u.isPlatformAdmin ? (
                  <span className="admin-pill ok">platform admin</span>
                ) : (
                  <span className="admin-pill muted">{u.memberships[0]?.role.toLowerCase() || 'user'}</span>
                )}
              </td>
              <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toISOString().slice(0, 10) : '—'}</td>
              <td>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="admin-btn sm" disabled={busy === `admin-${u.id}`} onClick={() => toggleAdmin(u)}>
                    {u.isPlatformAdmin ? 'Remove admin' : 'Make admin'}
                  </button>
                  <button className="admin-btn sm" disabled={busy === `pw-${u.id}`} onClick={() => resetPassword(u)}>
                    {u.active ? 'Reset PW' : 'Reactivate'}
                  </button>
                  {u.active && (
                    <button className="admin-btn sm danger" disabled={busy === `del-${u.id}`} onClick={() => deactivate(u)}>Deactivate</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
