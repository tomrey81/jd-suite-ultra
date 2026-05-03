'use client';

import { useEffect, useState, useCallback } from 'react';

interface JdqProgram {
  id: string;
  name: string;
  description: string | null;
  status: string;
  engineVersion: string;
  sealed: boolean;
  sealedAt: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-300',
  SEALED: 'bg-amber-100 text-amber-700 border-amber-300',
  SUPERSEDED: 'bg-stone-100 text-stone-600 border-stone-300',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-700 border-gray-300';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return iso;
  }
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<JdqProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [flagOff, setFlagOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Seal
  const [sealingId, setSealingId] = useState<string | null>(null);

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jdq/programs');
      if (res.status === 404) {
        setFlagOff(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError('Failed to load programs.');
        setLoading(false);
        return;
      }
      const json = await res.json();
      setPrograms(json.programs ?? []);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/jdq/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setCreateError(body.error || 'Failed to create program.');
        return;
      }
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      await fetchPrograms();
    } catch {
      setCreateError('Network error.');
    } finally {
      setCreating(false);
    }
  }

  async function handleSeal(id: string) {
    if (!window.confirm('Seal this program? Sealed programs cannot be edited.')) return;
    setSealingId(id);
    try {
      const res = await fetch(`/api/jdq/programs/${id}/seal`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || 'Failed to seal program.');
        return;
      }
      await fetchPrograms();
    } catch {
      alert('Network error.');
    } finally {
      setSealingId(null);
    }
  }

  if (flagOff) {
    return (
      <>
        <header className="admin-page-head">
          <div>
            <h1>JDQ Programs</h1>
            <p>Sealed Programs feature is not enabled.</p>
          </div>
        </header>
      </>
    );
  }

  return (
    <>
      <header className="admin-page-head">
        <div>
          <h1>JDQ Programs</h1>
          <p>Manage sealed scoring programs for the Axiomera/JDQ engine.</p>
        </div>
        <div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="text-sm px-4 py-2 rounded bg-brand-gold text-white font-medium hover:opacity-90 transition-opacity"
          >
            {showCreate ? 'Cancel' : 'New Program'}
          </button>
        </div>
      </header>

      {showCreate && (
        <div className="admin-card mb-4">
          <h2 className="text-sm font-semibold text-text-primary mb-3">New Program</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full text-sm rounded border border-border-default bg-surface-primary px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-gold"
                placeholder="e.g. Standard Scoring v1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Description
              </label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
                className="w-full text-sm rounded border border-border-default bg-surface-primary px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-gold resize-none"
                placeholder="Optional description…"
              />
            </div>
            {createError && (
              <p className="text-xs text-red-600">{createError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="text-sm px-4 py-2 rounded bg-brand-gold text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {creating ? 'Creating…' : 'Create Program'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setCreateError(null); }}
                className="text-sm px-4 py-2 rounded border border-border-default text-text-secondary hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-card">
        {loading ? (
          <p className="text-sm text-text-secondary py-4">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600 py-4">{error}</p>
        ) : programs.length === 0 ? (
          <p className="text-sm text-text-secondary py-4">
            No programs yet. Create the first one above.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-left">
                <th className="pb-2 pr-4 text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                  Name
                </th>
                <th className="pb-2 pr-4 text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                  Status
                </th>
                <th className="pb-2 pr-4 text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                  Engine Version
                </th>
                <th className="pb-2 pr-4 text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                  Created
                </th>
                <th className="pb-2 text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {programs.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 pr-4">
                    <div className="font-medium text-text-primary">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-text-tertiary mt-0.5">{p.description}</div>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="py-3 pr-4 text-text-secondary font-mono text-xs">
                    {p.engineVersion}
                  </td>
                  <td className="py-3 pr-4 text-text-secondary text-xs">
                    {formatDate(p.createdAt)}
                  </td>
                  <td className="py-3">
                    {p.status === 'DRAFT' && (
                      <button
                        onClick={() => handleSeal(p.id)}
                        disabled={sealingId === p.id}
                        className="text-xs px-3 py-1.5 rounded border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 transition-colors font-medium"
                      >
                        {sealingId === p.id ? 'Sealing…' : 'Seal'}
                      </button>
                    )}
                    {p.status !== 'DRAFT' && (
                      <span className="text-xs text-text-tertiary">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
