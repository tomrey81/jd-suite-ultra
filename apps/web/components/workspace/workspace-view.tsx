'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { JobDescription, Template, User } from '@jd-suite/db';
import { cn } from '@/lib/utils';

type JDWithRelations = JobDescription & {
  owner: Pick<User, 'name' | 'email'>;
  _count: { comments: number; versions: number };
};

interface WorkspaceViewProps {
  jds: JDWithRelations[];
  templates: Template[];
}

const STATUS_OPTIONS = ['DRAFT', 'UNDER_REVISION', 'APPROVED', 'ARCHIVED'] as const;
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-brand-gold-lighter', text: 'text-text-secondary', label: 'Draft' },
  UNDER_REVISION: { bg: 'bg-warning-bg', text: 'text-warning', label: 'Under Revision' },
  APPROVED: { bg: 'bg-success-bg', text: 'text-success', label: 'Approved' },
  ARCHIVED: { bg: 'bg-surface-page', text: 'text-text-muted', label: 'Archived' },
};

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

type SortKey = 'jobTitle' | 'status' | 'folder' | 'careerFamily' | 'updatedAt' | 'owner';
type ViewMode = 'all' | 'trash' | 'career' | string;

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
  const bulkRef = useRef<HTMLDivElement>(null);

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
      case 'jobTitle': c = (a.jobTitle || '').localeCompare(b.jobTitle || ''); break;
      case 'status': c = a.status.localeCompare(b.status); break;
      case 'folder': c = (a.folder || '').localeCompare(b.folder || ''); break;
      case 'careerFamily': c = (a.careerFamily || '').localeCompare(b.careerFamily || ''); break;
      case 'updatedAt': c = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(); break;
      case 'owner': c = (a.owner.name || '').localeCompare(b.owner.name || ''); break;
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

  const SH = ({ label, k, w }: { label: string; k: SortKey; w?: string }) => (
    <th onClick={() => toggleSort(k)} style={w ? { width: w } : undefined}
      className="cursor-pointer select-none whitespace-nowrap px-2 py-2 text-left text-[9px] font-bold uppercase tracking-[0.08em] text-text-muted hover:text-text-primary">
      {label}{sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Folder sidebar ── */}
      <div className="flex w-[170px] shrink-0 flex-col border-r border-border-default bg-white">
        <div className="px-3 pb-2 pt-3 text-[9px] font-bold uppercase tracking-[0.1em] text-text-muted">
          Folders
        </div>
        <div className="flex-1 overflow-y-auto">
          <FolderBtn active={viewMode === 'all'} onClick={() => setViewMode('all')} label="All JDs" count={active.length} />
          {folders.map((f) => (
            <FolderBtn key={f} active={viewMode === f} onClick={() => setViewMode(f)}
              label={`📁 ${f}`} count={active.filter((j) => j.folder === f).length} />
          ))}
          {showNewFolder ? (
            <div className="px-2 py-1">
              <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newFolderName.trim()) { setShowNewFolder(false); setViewMode(newFolderName.trim()); setNewFolderName(''); } if (e.key === 'Escape') setShowNewFolder(false); }}
                onBlur={() => setShowNewFolder(false)}
                placeholder="Name..." className="w-full rounded border border-brand-gold bg-surface-page px-2 py-1 text-[11px] outline-none" />
            </div>
          ) : (
            <button onClick={() => setShowNewFolder(true)} className="w-full px-3 py-1.5 text-left text-[10px] text-text-muted hover:text-brand-gold">
              + New Folder
            </button>
          )}
          <div className="mx-3 my-1.5 border-t border-border-default" />
          <FolderBtn active={viewMode === 'career'} onClick={() => setViewMode('career')} label="🔗 Career Paths" count={active.filter((j) => j.careerFamily).length} />
          <FolderBtn active={viewMode === 'trash'} onClick={() => setViewMode('trash')} label="🗑 Trash" count={trashed.length}
            className={viewMode === 'trash' ? 'bg-danger-bg text-danger' : ''} />
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border-default bg-white px-4 py-2">
          <h2 className="text-sm font-semibold text-text-primary">
            {viewMode === 'all' ? 'All JDs' : viewMode === 'trash' ? 'Trash' : viewMode === 'career' ? 'Career Paths' : `📁 ${viewMode}`}
          </h2>
          <span className="rounded-full bg-surface-page px-1.5 py-0.5 text-[9px] font-bold text-text-muted">{sorted.length}</span>
          <div className="flex-1" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
            className="w-[140px] rounded border border-border-default bg-surface-page px-2 py-1 text-[11px] outline-none" />
          {selected.size > 0 && (
            <div className="relative" ref={bulkRef}>
              <button onClick={() => setBulkOpen(!bulkOpen)} className="rounded bg-brand-gold px-2.5 py-1 text-[11px] font-medium text-white">
                Actions ({selected.size}) ▾
              </button>
              {bulkOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-[180px] rounded-lg border border-border-default bg-white py-1 shadow-lg">
                  {viewMode === 'trash' ? (
                    <>
                      <BulkItem label="Restore" onClick={() => bulkPatch({ archivedAt: null })} />
                      <BulkItem label="Delete permanently" onClick={() => { selected.forEach(hardDelete); setSelected(new Set()); setBulkOpen(false); }} danger />
                    </>
                  ) : (
                    <>
                      <div className="px-3 py-1 text-[8px] font-bold uppercase text-text-muted">Folder</div>
                      {folders.map((f) => <BulkItem key={f} label={`📁 ${f}`} onClick={() => bulkPatch({ folder: f })} />)}
                      <BulkItem label="Remove folder" onClick={() => bulkPatch({ folder: null })} />
                      <div className="mx-2 my-1 border-t border-border-default" />
                      <div className="px-3 py-1 text-[8px] font-bold uppercase text-text-muted">Status</div>
                      {STATUS_OPTIONS.map((s) => <BulkItem key={s} label={STATUS_COLORS[s].label} onClick={() => bulkPatch({ status: s })} />)}
                      <div className="mx-2 my-1 border-t border-border-default" />
                      <BulkItem label="🗑 Trash" onClick={() => bulkPatch({ archivedAt: new Date().toISOString() })} danger />
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          <Link href="/analyse" className="rounded bg-cat-skills px-2.5 py-1 text-[11px] font-medium text-white">⌖ Analyse</Link>
          <Link href="/jd/new" className="rounded bg-surface-header px-2.5 py-1 text-[11px] font-medium text-text-on-dark">✦ New JD</Link>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <div className="text-2xl opacity-30">{viewMode === 'trash' ? '🗑' : '📄'}</div>
              <p className="text-xs text-text-muted">{viewMode === 'trash' ? 'Trash is empty' : search ? `No results for "${search}"` : 'No JDs yet'}</p>
            </div>
          ) : (
            <table className="w-full min-w-[700px] border-collapse text-[11px]">
              <thead className="sticky top-0 z-10 bg-surface-page">
                <tr className="border-b border-border-default">
                  <th className="w-8 px-2 py-2"><input type="checkbox" checked={selected.size === sorted.length && sorted.length > 0} onChange={togAll} /></th>
                  <SH label="Title" k="jobTitle" w="30%" />
                  <SH label="Folder" k="folder" />
                  <SH label="Status" k="status" />
                  <SH label="Family" k="careerFamily" />
                  <SH label="Edited" k="updatedAt" />
                  <SH label="By" k="owner" />
                  <th className="w-[100px] px-2 py-2 text-right text-[9px] font-bold uppercase tracking-[0.08em] text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((jd) => {
                  const st = STATUS_COLORS[jd.status] || STATUS_COLORS.DRAFT;
                  const sel = selected.has(jd.id);
                  return (
                    <tr key={jd.id} className={cn('group border-b border-border-default transition-colors', sel ? 'bg-brand-gold-lighter' : 'hover:bg-surface-page')}>
                      <td className="px-2 py-1.5"><input type="checkbox" checked={sel} onChange={() => tog(jd.id)} /></td>

                      {/* Title */}
                      <td className="px-2 py-1.5">
                        {editingTitle === jd.id ? (
                          <input autoFocus value={editingTitleValue}
                            onChange={(e) => setEditingTitleValue(e.target.value)}
                            onBlur={() => saveTitle(jd.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(jd.id); if (e.key === 'Escape') setEditingTitle(null); }}
                            className="w-full rounded border border-brand-gold bg-white px-1.5 py-0.5 text-[11px] font-medium outline-none" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <Link href={`/jd/${jd.id}`} className="truncate font-medium text-text-primary hover:text-brand-gold">
                              {jd.jobTitle || 'Untitled'}
                            </Link>
                            <button onClick={() => { setEditingTitle(jd.id); setEditingTitleValue(jd.jobTitle || ''); }}
                              className="shrink-0 text-[10px] text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-brand-gold" title="Rename">✎</button>
                          </div>
                        )}
                        {jd.orgUnit && <div className="mt-0.5 truncate text-[9px] text-text-muted">{jd.orgUnit}</div>}
                      </td>

                      {/* Folder */}
                      <td className="px-2 py-1.5">
                        <select value={jd.folder || ''} onChange={(e) => patch(jd.id, { folder: e.target.value || null })}
                          className="w-full max-w-[90px] truncate rounded border border-transparent bg-transparent px-0.5 py-0.5 text-[10px] text-text-secondary outline-none hover:border-border-default">
                          <option value="">—</option>
                          {folders.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </td>

                      {/* Status */}
                      <td className="px-2 py-1.5">
                        <select value={jd.status} onChange={(e) => patch(jd.id, { status: e.target.value })}
                          className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold outline-none', st.bg, st.text)}>
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_COLORS[s].label}</option>)}
                        </select>
                      </td>

                      {/* Family */}
                      <td className="px-2 py-1.5">
                        <select value={jd.careerFamily || ''} onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__new') { const n = prompt('Career family name:'); if (n) patch(jd.id, { careerFamily: n }); }
                          else patch(jd.id, { careerFamily: v || null });
                        }}
                          className="w-full max-w-[90px] truncate rounded border border-transparent bg-transparent px-0.5 py-0.5 text-[10px] text-text-secondary outline-none hover:border-border-default">
                          <option value="">—</option>
                          {families.map((f) => <option key={f} value={f}>{f}</option>)}
                          <option value="__new">+ New...</option>
                        </select>
                      </td>

                      {/* Date */}
                      <td className="whitespace-nowrap px-2 py-1.5 text-[10px] text-text-muted">{fmtDate(jd.updatedAt)}</td>

                      {/* By */}
                      <td className="px-2 py-1.5 text-[10px] text-text-secondary">{(jd.owner.name || jd.owner.email).split(' ')[0]}</td>

                      {/* Actions */}
                      <td className="px-2 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <Link href={`/jd/${jd.id}`} className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:bg-surface-page hover:text-text-primary">Edit</Link>
                          <button onClick={() => duplicate(jd)} className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:bg-surface-page hover:text-text-primary">Copy</button>
                          <button onClick={() => duplicate(jd, jd.careerFamily || prompt('Family:') || undefined)}
                            className="rounded px-1.5 py-0.5 text-[10px] text-cat-skills hover:bg-info-bg" title="Career path">🔗</button>
                          {viewMode === 'trash' ? (
                            <>
                              <button onClick={() => patch(jd.id, { archivedAt: null })} className="rounded px-1.5 py-0.5 text-[10px] text-success hover:bg-success-bg">Restore</button>
                              <button onClick={() => hardDelete(jd.id)} className="rounded px-1.5 py-0.5 text-[10px] text-danger hover:bg-danger-bg">Delete</button>
                            </>
                          ) : (
                            <button onClick={() => patch(jd.id, { archivedAt: new Date().toISOString() })}
                              className="rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:bg-danger-bg hover:text-danger">🗑</button>
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
            <div className="border-t border-border-default bg-surface-page p-4">
              <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.1em] text-text-muted">Career Families</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {families.map((fam) => {
                  const fJds = active.filter((j) => j.careerFamily === fam);
                  return (
                    <div key={fam} className="rounded-lg border border-border-default bg-white p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-text-primary">🔗 {fam}</span>
                        <span className="text-[9px] text-text-muted">{fJds.length}</span>
                      </div>
                      {fJds.map((j) => (
                        <Link key={j.id} href={`/jd/${j.id}`}
                          className="flex items-center justify-between rounded px-2 py-1 text-[10px] hover:bg-surface-page">
                          <span className="truncate text-text-secondary">{j.jobTitle || 'Untitled'}</span>
                          <span className={cn('rounded px-1 py-0.5 text-[8px] font-semibold', STATUS_COLORS[j.status].bg, STATUS_COLORS[j.status].text)}>
                            {STATUS_COLORS[j.status].label}
                          </span>
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FolderBtn({ active, onClick, label, count, className }: {
  active: boolean; onClick: () => void; label: string; count: number; className?: string;
}) {
  return (
    <button onClick={onClick}
      className={cn('flex w-full items-center justify-between px-3 py-1.5 text-[11px] transition-colors',
        active ? 'bg-brand-gold-light font-medium text-text-primary' : 'text-text-secondary hover:bg-surface-page', className)}>
      <span className="truncate">{label}</span>
      <span className="text-[9px] text-text-muted">{count}</span>
    </button>
  );
}

function BulkItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('w-full px-3 py-1.5 text-left text-[11px] hover:bg-surface-page', danger ? 'text-danger hover:bg-danger-bg' : 'text-text-secondary')}>
      {label}
    </button>
  );
}
