'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ExportMenu } from '@/components/export/export-menu';

interface JDLite {
  id: string;
  jobTitle: string;
  status: string;
  folder: string | null;
  orgUnit: string | null;
  hasSlot: boolean;
  hasEval: boolean;
}

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: 'bg-amber-100', fg: 'text-amber-700', label: 'Draft' },
  UNDER_REVISION: { bg: 'bg-blue-100', fg: 'text-blue-700', label: 'Under review' },
  APPROVED: { bg: 'bg-emerald-100', fg: 'text-emerald-700', label: 'Approved' },
  ARCHIVED: { bg: 'bg-stone-100', fg: 'text-stone-500', label: 'Archived' },
};

interface Props {
  jds: JDLite[];
  unplacedCount: number;
  totalPlaced: number;
  familiesCount: number;
}

/**
 * Top bar for the Job Architecture matrix that surfaces the JD Hub:
 * — quick search across all JDs
 * — filter by status
 * — quick-add new JD
 * — counts of placed / unplaced / per-status
 *
 * Acts as a contextual command bar so users don't have to leave the matrix
 * to find or create a JD.
 */
export function ArchitectureJDBar({ jds, unplacedCount, totalPlaced, familiesCount }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { DRAFT: 0, UNDER_REVISION: 0, APPROVED: 0, ARCHIVED: 0 };
    for (const j of jds) c[j.status] = (c[j.status] || 0) + 1;
    return c;
  }, [jds]);

  const filtered = useMemo(() => {
    let out = jds;
    if (statusFilter) out = out.filter((j) => j.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((j) =>
        j.jobTitle.toLowerCase().includes(q) ||
        (j.folder || '').toLowerCase().includes(q) ||
        (j.orgUnit || '').toLowerCase().includes(q),
      );
    }
    return out.slice(0, 50);
  }, [jds, search, statusFilter]);

  const quickCreate = async () => {
    if (!search.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: search.trim(),
          data: { jobTitle: search.trim() },
          folder: 'Created from architecture',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const created = await res.json();
      router.push(`/jd/${created.id}`);
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="border-b border-border-default bg-white">
      {/* Top row — title + counts + quick actions */}
      <div className="flex items-center gap-3 px-6 py-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">
          JD Hub · Architecture
        </div>
        <div className="h-3 w-px bg-border-default" />
        <Link
          href="/jd"
          className="rounded-full border border-border-default bg-white px-3 py-1 text-[11px] text-text-secondary hover:border-brand-gold hover:text-text-primary"
        >
          ◇ All JDs
        </Link>
        <Link
          href="/sources"
          className="rounded-full border border-border-default bg-white px-3 py-1 text-[11px] text-text-secondary hover:border-brand-gold hover:text-text-primary"
        >
          ⊕ Live openings
        </Link>
        <Link
          href="/jd-editor"
          className="rounded-full border border-border-default bg-white px-3 py-1 text-[11px] text-text-secondary hover:border-brand-gold hover:text-text-primary"
        >
          ✦ Editor
        </Link>
        <div className="ml-auto flex items-center gap-2 text-[10px] text-text-muted">
          <span>{familiesCount} families</span>
          <span>·</span>
          <span>{totalPlaced} placed</span>
          {unplacedCount > 0 && (
            <>
              <span>·</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-700">
                {unplacedCount} to place
              </span>
            </>
          )}
        </div>
      </div>

      {/* Search + status filters */}
      <div className="flex items-center gap-2 border-t border-border-default px-6 py-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search JDs by title, folder, unit — or type a new title to create"
            className="w-full rounded-full border border-border-default bg-surface-page px-4 py-1.5 text-[11px] outline-none focus:border-brand-gold focus:bg-white"
          />
          {open && (search.trim() || statusFilter) && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[400px] overflow-y-auto rounded-lg border border-border-default bg-white shadow-xl">
              {filtered.length === 0 && search.trim() ? (
                <div className="p-4">
                  <p className="text-xs text-text-muted">No JD matches &quot;{search}&quot;.</p>
                  <button
                    onClick={quickCreate}
                    disabled={creating}
                    className="mt-2 rounded-full bg-brand-gold px-4 py-1.5 text-[11px] font-medium text-white hover:bg-brand-gold/90 disabled:opacity-50"
                  >
                    {creating ? 'Creating…' : `+ Create JD: "${search}"`}
                  </button>
                  {createError && <p className="mt-2 text-[10px] text-danger">{createError}</p>}
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-border-default">
                    {filtered.map((j) => {
                      const pill = STATUS_PILL[j.status] || STATUS_PILL.DRAFT;
                      return (
                        <li key={j.id}>
                          <Link
                            href={`/jd/${j.id}`}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-surface-page"
                          >
                            <span className="flex-1 truncate text-[12px] text-text-primary">
                              {j.jobTitle || 'Untitled'}
                            </span>
                            <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider', pill.bg, pill.fg)}>
                              {pill.label}
                            </span>
                            {j.hasEval && (
                              <span className="rounded-full bg-success-bg px-1.5 py-0.5 text-[8px] font-bold text-success" title="Has evaluation score">
                                Eval
                              </span>
                            )}
                            {j.hasSlot && (
                              <span className="rounded-full bg-info-bg px-1.5 py-0.5 text-[8px] font-bold text-info" title="Already placed in matrix">
                                Placed
                              </span>
                            )}
                            {!j.hasSlot && (
                              <span className="rounded-full bg-warning-bg px-1.5 py-0.5 text-[8px] font-bold text-warning">
                                Unplaced
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {search.trim() && (
                    <div className="border-t border-border-default p-2">
                      <button
                        onClick={quickCreate}
                        disabled={creating}
                        className="rounded-full bg-brand-gold px-4 py-1.5 text-[11px] font-medium text-white hover:bg-brand-gold/90 disabled:opacity-50"
                      >
                        {creating ? 'Creating…' : `+ Create JD: "${search}"`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Status pills */}
        <div className="flex shrink-0 items-center gap-1">
          {(['DRAFT', 'UNDER_REVISION', 'APPROVED', 'ARCHIVED'] as const).map((s) => {
            const pill = STATUS_PILL[s];
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => { setStatusFilter(active ? null : s); setOpen(true); }}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-all',
                  active ? `${pill.bg} ${pill.fg} ring-2 ring-brand-gold/30` : `${pill.bg} ${pill.fg} opacity-60 hover:opacity-100`,
                )}
                title={`Filter ${pill.label}`}
              >
                {pill.label} {counts[s] || 0}
              </button>
            );
          })}
        </div>

        <ExportMenu
          data={{
            title: 'Job Architecture · all JDs',
            subtitle: `${familiesCount} families · ${totalPlaced} placed · ${unplacedCount} unplaced`,
            rows: jds,
            columns: [
              { key: 'jobTitle',  label: 'Job title',  width: 32 },
              { key: 'status',    label: 'Status',     width: 14 },
              { key: 'orgUnit',   label: 'Org unit',   width: 22 },
              { key: 'folder',    label: 'Folder',     width: 18 },
              { key: 'hasEval',   label: 'Evaluated',  width: 10, get: (r) => (r.hasEval ? 'yes' : 'no') },
              { key: 'hasSlot',   label: 'Placed',     width: 10, get: (r) => (r.hasSlot ? 'yes' : 'no') },
            ],
          }}
          fileName="architecture-jds"
          initialPageFormat="A4"
          initialOrientation="landscape"
          className="shrink-0"
        />

        <Link
          href="/jd/new"
          className="shrink-0 rounded-full bg-brand-gold px-3 py-1 text-[11px] font-medium text-white hover:bg-brand-gold/90"
        >
          + New JD
        </Link>
      </div>

      {/* Click-outside catch */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
    </div>
  );
}
