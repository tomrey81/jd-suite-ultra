'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { JobDescription, Template, User } from '@jd-suite/db';
import { cn } from '@/lib/utils';
import { HubNav } from '@/components/layout/hub-nav';

type JDWithRelations = JobDescription & {
  owner: Pick<User, 'name' | 'email'>;
  _count: { comments: number; versions: number };
};

interface WorkspaceViewProps {
  jds: JDWithRelations[];
  templates: Template[];
}

const STATUS_OPTIONS = ['DRAFT', 'UNDER_REVISION', 'APPROVED', 'ARCHIVED'] as const;
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  DRAFT:         { bg: 'bg-brand-gold-lighter', text: 'text-text-secondary',  dot: 'bg-brand-gold',   label: 'Draft' },
  UNDER_REVISION:{ bg: 'bg-warning-bg',          text: 'text-warning',         dot: 'bg-warning',      label: 'Under Revision' },
  APPROVED:      { bg: 'bg-success-bg',           text: 'text-success',         dot: 'bg-success',      label: 'Approved' },
  ARCHIVED:      { bg: 'bg-surface-page',         text: 'text-text-muted',      dot: 'bg-text-muted',   label: 'Archived' },
};

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

type SortKey = 'jobTitle' | 'status' | 'folder' | 'careerFamily' | 'updatedAt' | 'owner';
type ViewMode = 'all' | 'trash' | 'career' | string;

// ── SVG icons ──────────────────────────────────────────────────────────────

function IconFolder({ className }: { className?: string }) {
  return (
    <svg className={cn('shrink-0', className)} width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M1 3.5A1.5 1.5 0 012.5 2h2.086a1.5 1.5 0 011.06.44L6.5 3.5H11.5A1.5 1.5 0 0113 5v5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 011 10V3.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function IconLink({ className }: { className?: string }) {
  return (
    <svg className={cn('shrink-0', className)} width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M5.5 8.5l3-3M8 3.5l1.5-1.5a2.121 2.121 0 013 3L11 6.5M3 7.5l-1.5 1.5a2.121 2.121 0 003 3L6 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={cn('shrink-0', className)} width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M2 3.5h10M5.5 3.5V2.5h3v1M3.5 3.5l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={cn('shrink-0', className)} width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconChevron({ up, className }: { up?: boolean; className?: string }) {
  return (
    <svg className={cn('shrink-0 transition-transform', up ? 'rotate-180' : '', className)} width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function WorkspaceView({ jds: initialJds, templates }: WorkspaceViewProps) {
  const router = useRouter();
  const [jds, setJds] = useState(initialJds);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const bulkRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close bulk dropdown on click outside
  useEffect(() => {
    if (!bulkOpen) return;
    const handler = (e: MouseEvent) => {
      if (bulkRef.current && !bulkRef.current.contains(e.target as Node)) setBulkOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bulkOpen]);

  // Derived
  const active = jds.filter((j) => !j.archivedAt);
  const trashed = jds.filter((j) => j.archivedAt);
  const folders = [...new Set(active.map((j) => j.folder).filter(Boolean))] as string[];
  const families = [...new Set(active.map((j) => j.careerFamily).filter(Boolean))] as string[];

  // Filter
  let filtered: JDWithRelations[];
  if (viewMode === 'trash') filtered = trashed;
  else if (viewMode === 'career') filtered = active.filter((j) => j.careerFamily);
  else if (viewMode !== 'all') filtered = active.filter((j) => j.folder === viewMode);
  else filtered = active;

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (j) => j.jobTitle?.toLowerCase().includes(q) || j.orgUnit?.toLowerCase().includes(q),
    );
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let c = 0;
    switch (sortKey) {
      case 'jobTitle':     c = (a.jobTitle || '').localeCompare(b.jobTitle || ''); break;
      case 'status':       c = a.status.localeCompare(b.status); break;
      case 'folder':       c = (a.folder || '').localeCompare(b.folder || ''); break;
      case 'careerFamily': c = (a.careerFamily || '').localeCompare(b.careerFamily || ''); break;
      case 'updatedAt':    c = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(); break;
      case 'owner':        c = (a.owner.name || '').localeCompare(b.owner.name || ''); break;
    }
    return sortAsc ? c : -c;
  });

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(true); }
  };

  // API
  const patch = useCallback(async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`/api/jd/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setJds((p) => p.map((j) => (j.id === id ? { ...j, ...updated } : j)));
    }
  }, []);

  const duplicate = useCallback(async (src: JDWithRelations, family?: string) => {
    await fetch('/api/jd', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: src.data, jobTitle: `${src.jobTitle || 'Untitled'} (Copy)`,
        jobCode: src.jobCode, orgUnit: src.orgUnit, folder: src.folder,
        careerFamily: family || src.careerFamily, duplicatedFromId: src.id, templateId: src.templateId,
      }),
    });
    router.refresh();
  }, [router]);

  const hardDelete = useCallback(async (id: string) => {
    if (!confirm('Permanently delete? This cannot be undone.')) return;
    await fetch(`/api/jd/${id}`, { method: 'DELETE' });
    setJds((p) => p.filter((j) => j.id !== id));
  }, []);

  const saveTitle = async (id: string) => {
    if (editingTitleValue.trim()) await patch(id, { jobTitle: editingTitleValue.trim() });
    setEditingTitle(null);
  };

  // Select
  const tog = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const togAll = () => setSelected(selected.size === sorted.length ? new Set() : new Set(sorted.map((j) => j.id)));

  // Bulk
  const bulkPatch = async (data: Record<string, unknown>) => {
    for (const id of selected) await patch(id, data);
    setSelected(new Set()); setBulkOpen(false);
  };

  // Sortable header
  const SH = ({ label, k, w }: { label: string; k: SortKey; w?: string }) => (
    <th
      onClick={() => toggleSort(k)}
      style={w ? { width: w } : undefined}
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-text-muted transition-colors hover:text-text-primary"
    >
      <span className="flex items-center gap-1">
        {label}
        {sortKey === k ? (
          <span className="text-brand-gold">{sortAsc ? '↑' : '↓'}</span>
        ) : (
          <span className="opacity-0 group-hover:opacity-30">↕</span>
        )}
      </span>
    </th>
  );

  const viewLabel = viewMode === 'all' ? 'All JDs'
    : viewMode === 'trash' ? 'Trash'
    : viewMode === 'career' ? 'Career Paths'
    : viewMode;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border-default bg-surface-page py-3">
        <HubNav />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Folder sidebar ─────────────────────────────────────────────── */}
        <div
          className={cn(
            'flex shrink-0 flex-col border-r border-border-default bg-white transition-all duration-200',
            sidebarCollapsed ? 'w-10' : 'w-[188px]',
          )}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-3 pb-2 pt-3">
            {!sidebarCollapsed && (
              <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-text-muted">Folders</span>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="ml-auto rounded p-0.5 text-text-muted transition-colors hover:bg-surface-page hover:text-text-primary"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d={sidebarCollapsed ? 'M4 7h6M4 4h6M4 10h6' : 'M2 4h10M2 7h10M2 10h10'}
                  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {!sidebarCollapsed && (
            <div className="flex-1 overflow-y-auto pb-2">
              <FolderBtn active={viewMode === 'all'} onClick={() => setViewMode('all')} label="All JDs" count={active.length} />
              {folders.map((f) => (
                <FolderBtn
                  key={f}
                  active={viewMode === f}
                  onClick={() => setViewMode(f)}
                  label={f}
                  count={active.filter((j) => j.folder === f).length}
                  icon={<IconFolder className="text-text-muted" />}
                />
              ))}

              {showNewFolder ? (
                <div className="px-2 py-1">
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newFolderName.trim()) {
                        setShowNewFolder(false); setViewMode(newFolderName.trim()); setNewFolderName('');
                      }
                      if (e.key === 'Escape') setShowNewFolder(false);
                    }}
                    onBlur={() => setShowNewFolder(false)}
                    placeholder="Folder name…"
                    className="w-full rounded border border-brand-gold bg-surface-page px-2 py-1 text-[12px] outline-none"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setShowNewFolder(true)}
                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[12px] text-text-muted transition-colors hover:text-brand-gold"
                >
                  <span className="text-[14px] leading-none">+</span>
                  <span>New Folder</span>
                </button>
              )}

              <div className="mx-3 my-2 border-t border-border-default" />

              <FolderBtn
                active={viewMode === 'career'}
                onClick={() => setViewMode('career')}
                label="Career Paths"
                count={active.filter((j) => j.careerFamily).length}
                icon={<IconLink className="text-cat-skills" />}
              />
              <FolderBtn
                active={viewMode === 'trash'}
                onClick={() => setViewMode('trash')}
                label="Trash"
                count={trashed.length}
                icon={<IconTrash className={viewMode === 'trash' ? 'text-danger' : 'text-text-muted'} />}
                className={viewMode === 'trash' ? 'text-danger' : ''}
              />
            </div>
          )}
        </div>

        {/* ── Main panel ──────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex shrink-0 items-center gap-3 border-b border-border-default bg-white px-4 py-2.5">
            <h2 className="text-sm font-semibold text-text-primary">{viewLabel}</h2>
            <span className="rounded-full bg-surface-page px-2 py-0.5 text-[11px] font-semibold text-text-muted">
              {sorted.length}
            </span>
            <div className="flex-1" />

            {/* Search */}
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-text-muted">
                <IconSearch />
              </span>
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search JDs…"
                className="w-[240px] rounded-lg border border-border-default bg-surface-page py-1.5 pl-8 pr-7 text-[12px] outline-none transition-all placeholder:text-text-muted focus:border-brand-gold focus:bg-white"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 right-2 flex items-center text-text-muted transition-colors hover:text-text-primary"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>

            <Link
              href="/analyse"
              className="flex items-center gap-1.5 rounded-lg bg-cat-skills px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
            >
              <span>⌖</span>
              <span>Analyse</span>
            </Link>
            <Link
              href="/jd/new"
              className="flex items-center gap-1.5 rounded-lg bg-surface-header px-3 py-1.5 text-[12px] font-medium text-text-on-dark transition-opacity hover:opacity-90"
            >
              <span>✦</span>
              <span>New JD</span>
            </Link>
          </div>

          {/* Status quality bar — visible in All JDs view when there are JDs */}
          {viewMode === 'all' && active.length > 0 && (
            <div className="flex shrink-0 items-center gap-4 border-b border-border-default bg-surface-page px-4 py-1.5">
              {STATUS_OPTIONS.map((s) => {
                const count = active.filter((j) => j.status === s).length;
                if (count === 0) return null;
                const c = STATUS_COLORS[s];
                return (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
                    <span className={`text-[11px] ${c.text}`}>{c.label}</span>
                    <span className="text-[11px] font-semibold text-text-primary">{count}</span>
                  </div>
                );
              })}
              <div className="flex-1" />
              {(() => {
                const approved = active.filter((j) => j.status === 'APPROVED').length;
                const rate = Math.round((approved / active.length) * 100);
                return (
                  <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                    <span>Approved</span>
                    <span className={`font-semibold ${rate >= 75 ? 'text-success' : rate >= 40 ? 'text-warning' : 'text-danger'}`}>
                      {rate}%
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Bulk action bar — slides in when items selected */}
          {selected.size > 0 && (
            <div className="flex shrink-0 items-center gap-2 border-b border-border-default bg-brand-gold-lighter px-4 py-2">
              <span className="text-[12px] font-medium text-text-primary">
                {selected.size} selected
              </span>
              <div className="h-4 w-px bg-border-default" />
              {viewMode === 'trash' ? (
                <>
                  <BulkBarBtn label="Restore" onClick={() => bulkPatch({ archivedAt: null })} />
                  <BulkBarBtn
                    label="Delete permanently"
                    danger
                    onClick={() => { selected.forEach(hardDelete); setSelected(new Set()); }}
                  />
                </>
              ) : (
                <div className="relative" ref={bulkRef}>
                  <button
                    onClick={() => setBulkOpen(!bulkOpen)}
                    className="flex items-center gap-1 rounded-lg border border-border-default bg-white px-2.5 py-1 text-[12px] font-medium text-text-primary transition-colors hover:border-brand-gold"
                  >
                    Actions
                    <IconChevron up={bulkOpen} />
                  </button>
                  {bulkOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-[200px] rounded-lg border border-border-default bg-white py-1.5 shadow-lg">
                      <div className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Move to folder</div>
                      {folders.map((f) => (
                        <BulkItem key={f} label={f} icon={<IconFolder className="text-text-muted" />} onClick={() => bulkPatch({ folder: f })} />
                      ))}
                      <BulkItem label="Remove folder" onClick={() => bulkPatch({ folder: null })} />
                      <div className="mx-2 my-1.5 border-t border-border-default" />
                      <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Change status</div>
                      {STATUS_OPTIONS.map((s) => (
                        <BulkItem
                          key={s}
                          label={STATUS_COLORS[s].label}
                          dot={STATUS_COLORS[s].dot}
                          onClick={() => bulkPatch({ status: s })}
                        />
                      ))}
                      <div className="mx-2 my-1.5 border-t border-border-default" />
                      <BulkItem
                        label="Move to Trash"
                        icon={<IconTrash className="text-danger" />}
                        onClick={() => bulkPatch({ archivedAt: new Date().toISOString() })}
                        danger
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setSelected(new Set())}
                className="rounded px-2 py-1 text-[11px] text-text-muted transition-colors hover:text-text-primary"
              >
                Clear
              </button>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {sorted.length === 0 ? (
              <EmptyState viewMode={viewMode} search={search} onClearSearch={() => setSearch('')} />
            ) : (
              <table className="w-full min-w-[720px] border-collapse text-[12px]">
                <thead className="sticky top-0 z-10 bg-surface-page">
                  <tr className="border-b-2 border-border-default">
                    <th className="w-9 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.size === sorted.length && sorted.length > 0}
                        onChange={togAll}
                        className="h-3.5 w-3.5 cursor-pointer accent-brand-gold"
                      />
                    </th>
                    <SH label="Title" k="jobTitle" w="32%" />
                    <SH label="Folder" k="folder" />
                    <SH label="Status" k="status" />
                    <SH label="Family" k="careerFamily" />
                    <SH label="Edited" k="updatedAt" />
                    <SH label="By" k="owner" />
                    <th className="w-[120px] px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.07em] text-text-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((jd) => {
                    const st = STATUS_COLORS[jd.status] || STATUS_COLORS.DRAFT;
                    const sel = selected.has(jd.id);
                    return (
                      <tr
                        key={jd.id}
                        className={cn(
                          'group border-b border-border-default transition-colors',
                          sel ? 'bg-brand-gold-lighter' : 'hover:bg-surface-page',
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => tog(jd.id)}
                            className="h-3.5 w-3.5 cursor-pointer accent-brand-gold"
                          />
                        </td>

                        {/* Title */}
                        <td className="px-3 py-2.5">
                          {editingTitle === jd.id ? (
                            <input
                              autoFocus
                              value={editingTitleValue}
                              onChange={(e) => setEditingTitleValue(e.target.value)}
                              onBlur={() => saveTitle(jd.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveTitle(jd.id);
                                if (e.key === 'Escape') setEditingTitle(null);
                              }}
                              className="w-full rounded-md border border-brand-gold bg-white px-2 py-0.5 text-[12px] font-medium outline-none"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/jd/${jd.id}`}
                                className="truncate font-medium text-text-primary transition-colors hover:text-brand-gold"
                              >
                                {jd.jobTitle || 'Untitled'}
                              </Link>
                              <button
                                onClick={() => { setEditingTitle(jd.id); setEditingTitleValue(jd.jobTitle || ''); }}
                                className="shrink-0 rounded p-0.5 text-[11px] text-text-muted opacity-0 transition-opacity group-hover:opacity-70 hover:bg-surface-page hover:text-brand-gold hover:!opacity-100"
                                title="Rename"
                              >
                                ✎
                              </button>
                            </div>
                          )}
                          {jd.orgUnit && (
                            <div className="mt-0.5 truncate text-[11px] text-text-muted">{jd.orgUnit}</div>
                          )}
                        </td>

                        {/* Folder */}
                        <td className="px-3 py-2.5">
                          <select
                            value={jd.folder || ''}
                            onChange={(e) => patch(jd.id, { folder: e.target.value || null })}
                            className="w-full max-w-[100px] truncate rounded border border-transparent bg-transparent py-0.5 pl-0.5 text-[12px] text-text-secondary outline-none transition-colors hover:border-border-default hover:bg-white"
                          >
                            <option value="">—</option>
                            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </td>

                        {/* Status badge + select */}
                        <td className="px-3 py-2.5">
                          <div className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5', st.bg)}>
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', st.dot)} />
                            <select
                              value={jd.status}
                              onChange={(e) => patch(jd.id, { status: e.target.value })}
                              className={cn('bg-transparent text-[11px] font-semibold outline-none cursor-pointer', st.text)}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{STATUS_COLORS[s].label}</option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* Family */}
                        <td className="px-3 py-2.5">
                          <select
                            value={jd.careerFamily || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === '__new') { const n = prompt('Career family name:'); if (n) patch(jd.id, { careerFamily: n }); }
                              else patch(jd.id, { careerFamily: v || null });
                            }}
                            className="w-full max-w-[100px] truncate rounded border border-transparent bg-transparent py-0.5 pl-0.5 text-[12px] text-text-secondary outline-none transition-colors hover:border-border-default hover:bg-white"
                          >
                            <option value="">—</option>
                            {families.map((f) => <option key={f} value={f}>{f}</option>)}
                            <option value="__new">+ New…</option>
                          </select>
                        </td>

                        {/* Date */}
                        <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-text-muted">{fmtDate(jd.updatedAt)}</td>

                        {/* By */}
                        <td className="px-3 py-2.5 text-[12px] text-text-secondary">
                          {(jd.owner.name || jd.owner.email).split(' ')[0]}
                        </td>

                        {/* Actions — visible at low opacity, full on hover */}
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-0.5 opacity-30 transition-opacity group-hover:opacity-100">
                            <Link
                              href={`/jd/${jd.id}`}
                              className="rounded px-1.5 py-1 text-[11px] font-medium text-text-muted transition-colors hover:bg-surface-page hover:text-text-primary"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => duplicate(jd)}
                              className="rounded px-1.5 py-1 text-[11px] text-text-muted transition-colors hover:bg-surface-page hover:text-text-primary"
                            >
                              Copy
                            </button>
                            <button
                              onClick={() => duplicate(jd, jd.careerFamily || prompt('Family:') || undefined)}
                              className="rounded px-1.5 py-1 text-[11px] text-cat-skills transition-colors hover:bg-info-bg"
                              title="Add to career path"
                            >
                              <IconLink />
                            </button>
                            {viewMode === 'trash' ? (
                              <>
                                <button
                                  onClick={() => patch(jd.id, { archivedAt: null })}
                                  className="rounded px-1.5 py-1 text-[11px] text-success transition-colors hover:bg-success-bg"
                                >
                                  Restore
                                </button>
                                <button
                                  onClick={() => hardDelete(jd.id)}
                                  className="rounded px-1.5 py-1 text-[11px] text-danger transition-colors hover:bg-danger-bg"
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => patch(jd.id, { archivedAt: new Date().toISOString() })}
                                className="rounded px-1.5 py-1 text-[11px] text-text-muted transition-colors hover:bg-danger-bg hover:text-danger"
                                title="Move to Trash"
                              >
                                <IconTrash />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Career paths cards */}
            {viewMode === 'career' && families.length > 0 && (
              <div className="border-t border-border-default bg-surface-page p-5">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-text-muted">
                  Career Families
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {families.map((fam) => {
                    const fJds = active.filter((j) => j.careerFamily === fam);
                    return (
                      <div key={fam} className="rounded-xl border border-border-default bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
                            <IconLink className="text-cat-skills" />
                            {fam}
                          </span>
                          <span className="rounded-full bg-surface-page px-1.5 py-0.5 text-[11px] text-text-muted">
                            {fJds.length}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {fJds.map((j) => {
                            const s = STATUS_COLORS[j.status] || STATUS_COLORS.DRAFT;
                            return (
                              <Link
                                key={j.id}
                                href={`/jd/${j.id}`}
                                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[12px] transition-colors hover:bg-surface-page"
                              >
                                <span className="truncate text-text-secondary">{j.jobTitle || 'Untitled'}</span>
                                <span className={cn('ml-2 flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', s.bg, s.text)}>
                                  <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
                                  {s.label}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function FolderBtn({
  active, onClick, label, count, icon, className,
}: {
  active: boolean; onClick: () => void; label: string; count: number;
  icon?: React.ReactNode; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-[12px] transition-colors',
        active
          ? 'border-l-2 border-brand-gold bg-brand-gold-lighter font-semibold text-text-primary'
          : 'border-l-2 border-transparent text-text-secondary hover:bg-surface-page hover:text-text-primary',
        className,
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="flex-1 truncate text-left">{label}</span>
      <span className={cn('shrink-0 text-[11px]', active ? 'text-text-muted' : 'text-text-muted')}>{count}</span>
    </button>
  );
}

function BulkBarBtn({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-1 text-[12px] font-medium transition-colors',
        danger
          ? 'text-danger hover:bg-danger-bg'
          : 'bg-white text-text-primary shadow-sm ring-1 ring-border-default hover:ring-brand-gold',
      )}
    >
      {label}
    </button>
  );
}

function BulkItem({
  label, onClick, danger, icon, dot,
}: {
  label: string; onClick: () => void; danger?: boolean;
  icon?: React.ReactNode; dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-surface-page',
        danger ? 'text-danger hover:bg-danger-bg' : 'text-text-secondary',
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {dot && <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} />}
      {label}
    </button>
  );
}

function EmptyState({
  viewMode, search, onClearSearch,
}: {
  viewMode: ViewMode; search: string; onClearSearch: () => void;
}) {
  if (viewMode === 'trash') {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-page text-text-muted opacity-40">
          <IconTrash className="h-6 w-6" />
        </div>
        <p className="text-[13px] text-text-muted">Trash is empty</p>
      </div>
    );
  }

  if (search) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-page opacity-40">
          <IconSearch className="h-6 w-6 text-text-muted" />
        </div>
        <p className="text-[13px] font-medium text-text-primary">No results for &ldquo;{search}&rdquo;</p>
        <p className="text-[12px] text-text-muted">Try a different search term or clear the filter.</p>
        <button
          onClick={onClearSearch}
          className="mt-1 rounded-lg border border-border-default px-4 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:border-brand-gold hover:text-brand-gold"
        >
          Clear search
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-page opacity-40">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 8h8M8 12h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-[13px] font-medium text-text-primary">No job descriptions yet</p>
      <p className="text-[12px] text-text-muted">Create your first JD or import one from a URL.</p>
      <Link
        href="/jd/new"
        className="mt-1 flex items-center gap-1.5 rounded-lg bg-surface-header px-4 py-1.5 text-[12px] font-medium text-text-on-dark transition-opacity hover:opacity-90"
      >
        <span>✦</span>
        <span>New JD</span>
      </Link>
    </div>
  );
}
