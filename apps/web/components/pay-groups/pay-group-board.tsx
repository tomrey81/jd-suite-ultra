'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface JDMember {
  id: string;
  jdId: string;
  addedAt: string;
  jd: {
    id: string;
    jobTitle: string;
    orgUnit?: string;
    status: string;
    data: Record<string, string>;
    evalResults: { overallScore: number; criteria: any[] }[];
    owner?: { name: string };
  };
}

interface AuditEntry {
  id: string;
  jdId?: string;
  action: string;
  fromGroup?: string;
  toGroup?: string;
  comment: string;
  authorId?: string;
  timestamp: string;
}

interface PayGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  sortOrder: number;
  members: JDMember[];
  auditLog: AuditEntry[];
}

interface UnassignedJD {
  id: string;
  jobTitle: string;
  orgUnit?: string;
  status: string;
  data: Record<string, string>;
  evalResults: { overallScore: number }[];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-block h-1.5 w-1.5 rounded-full',
        status === 'APPROVED' ? 'bg-green-500' :
        status === 'DRAFT' ? 'bg-amber-400' :
        'bg-gray-400'
      )}
    />
  );
}

function AuditBadge({ action }: { action: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    GROUP_CREATED:  { label: 'Created',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    GROUP_RENAMED:  { label: 'Renamed',   cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    JD_ADDED:       { label: 'Added',     cls: 'bg-green-50 text-green-700 border-green-200' },
    JD_REMOVED:     { label: 'Removed',   cls: 'bg-red-50 text-red-700 border-red-200' },
    JD_MOVED:       { label: 'Moved',     cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    AI_GROUPED:     { label: 'AI',        cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  };
  const m = map[action] ?? { label: action, cls: 'bg-gray-50 text-gray-600 border-gray-200' };
  return (
    <span className={cn('inline-block rounded border px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide', m.cls)}>
      {m.label}
    </span>
  );
}

function relTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ── Comment dialog ────────────────────────────────────────────────────────────

function CommentDialog({
  title,
  hint,
  minLen,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  hint: string;
  minLen?: number;
  onConfirm: (comment: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [comment, setComment] = useState('');
  const min = minLen ?? 10;
  const ok = comment.trim().length >= min;

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-[460px] rounded-xl bg-white shadow-2xl">
        <div className="border-b border-border-default p-5">
          <h3 className="font-semibold text-text-primary">{title}</h3>
          <p className="mt-1 text-xs text-text-secondary">{hint}</p>
        </div>
        <div className="p-5">
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-text-primary">
              Reason for this change <span className="text-danger">*</span>
            </label>
            <span className={cn('text-[10px]', ok ? 'text-green-600' : 'text-text-muted')}>
              {comment.trim().length}/{min}+ chars required
            </span>
          </div>
          <textarea
            className="w-full rounded-lg border border-border-default bg-surface-page p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40 resize-none"
            rows={3}
            placeholder="e.g. Adjusted grouping after reviewing scope of financial authority..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            autoFocus
          />
          <p className="mt-1.5 text-[10px] text-text-muted">
            Required by EU Pay Transparency Directive 2023/970 Article 4 — all grouping decisions must be documented.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border-default p-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border-default px-4 py-1.5 text-xs text-text-secondary hover:bg-surface-page"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ok || loading}
            onClick={() => onConfirm(comment.trim())}
            className="inline-flex items-center gap-2 rounded-md bg-brand-gold px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            {loading && <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ── JD Card in board ──────────────────────────────────────────────────────────

function JDCard({
  member,
  groups,
  currentGroupId,
  onRemove,
  onMove,
}: {
  member: JDMember;
  groups: PayGroup[];
  currentGroupId: string;
  onRemove: (jdId: string) => void;
  onMove: (jdId: string, toGroupId: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const { jd } = member;
  const evalScore = jd.evalResults[0]?.overallScore;
  const data = jd.data ?? {};
  const posType = data.positionType ?? '';
  const otherGroups = groups.filter((g) => g.id !== currentGroupId);

  return (
    <div className="group relative rounded-lg border border-border-default bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <StatusDot status={jd.status} />
            <span className="truncate text-[11px] font-semibold text-text-primary">{jd.jobTitle || 'Untitled'}</span>
          </div>
          {jd.orgUnit && (
            <div className="text-[10px] text-text-muted truncate">{jd.orgUnit}</div>
          )}
          {posType && (
            <div className="mt-1 text-[9px] text-text-muted">{posType}</div>
          )}
        </div>
        {evalScore !== undefined && (
          <div className="shrink-0 text-right">
            <div className="text-[10px] font-bold text-text-primary">{evalScore}%</div>
            <div className="text-[9px] text-text-muted">eval</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Link
          href={`/jd/${jd.id}`}
          className="rounded text-[9px] text-text-muted hover:text-brand-gold px-1.5 py-0.5 border border-border-default hover:border-brand-gold/40 transition-colors"
        >
          Edit ↗
        </Link>
        {otherGroups.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="rounded text-[9px] text-text-muted hover:text-amber-600 px-1.5 py-0.5 border border-border-default hover:border-amber-400/40 transition-colors"
            >
              Move →
            </button>
            {showMenu && (
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-border-default bg-white shadow-xl">
                <div className="p-1.5 text-[9px] font-bold uppercase tracking-wide text-text-muted px-2.5 pt-2">Move to</div>
                {otherGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => { setShowMenu(false); onMove(jd.id, g.id); }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-text-primary hover:bg-surface-page"
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: g.color }} />
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => onRemove(jd.id)}
          className="ml-auto rounded text-[9px] text-text-muted hover:text-danger px-1.5 py-0.5 border border-border-default hover:border-danger/40 transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// ── Main board component ──────────────────────────────────────────────────────

export function PayGroupBoard({
  initialGroups,
  allJDs,
  orgId,
}: {
  initialGroups: PayGroup[];
  allJDs: UnassignedJD[];
  orgId: string;
}) {
  const [groups, setGroups] = useState<PayGroup[]>(initialGroups);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'board' | 'audit'>('board');

  // Dialog states
  const [pendingAction, setPendingAction] = useState<null | {
    type: 'remove' | 'move' | 'add' | 'create-group';
    jdId?: string;
    fromGroupId?: string;
    toGroupId?: string;
    groupId?: string;
    newGroupName?: string;
  }>(null);

  // New group form
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#8A7560');

  // Add JD panel
  const [selectedGroupForAdd, setSelectedGroupForAdd] = useState<string | null>(null);
  const [searchJD, setSearchJD] = useState('');

  // Active audit log
  const [auditGroupId, setAuditGroupId] = useState<string | null>(null);

  const assignedJdIds = new Set(groups.flatMap((g) => g.members.map((m) => m.jdId)));
  const unassigned = allJDs.filter((j) => !assignedJdIds.has(j.id));
  const filteredUnassigned = unassigned.filter(
    (j) => !searchJD || j.jobTitle.toLowerCase().includes(searchJD.toLowerCase()) || (j.orgUnit ?? '').toLowerCase().includes(searchJD.toLowerCase())
  );

  const allAuditEntries = groups
    .flatMap((g) => g.auditLog.map((a) => ({ ...a, groupName: g.name, groupColor: g.color })))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 100);

  const refetch = useCallback(async () => {
    const res = await fetch('/api/pay-groups');
    if (res.ok) {
      const data = await res.json();
      setGroups(data.groups ?? []);
    }
  }, []);

  // ── Create group ────────────────────────────────────────────
  const handleCreateGroup = async (comment: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pay-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName, description: newGroupDesc, color: newGroupColor, comment }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create group');
      await refetch();
      setShowNewGroup(false);
      setNewGroupName('');
      setNewGroupDesc('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  // ── Remove JD from group ────────────────────────────────────
  const handleRemove = async (groupId: string, jdId: string, comment: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pay-groups/${groupId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdId, comment }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to remove');
      await refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  // ── Move JD between groups ──────────────────────────────────
  const handleMove = async (jdId: string, fromGroupId: string, toGroupId: string, comment: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pay-groups/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdId, fromGroupId, toGroupId, comment }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to move');
      await refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  // ── Add JD to group ─────────────────────────────────────────
  const handleAdd = async (groupId: string, jdId: string, comment: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pay-groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdId, comment }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to add');
      await refetch();
      setSelectedGroupForAdd(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  // ── AI grouping ─────────────────────────────────────────────
  const handleAIGrouping = async () => {
    if (allJDs.length < 2) return;
    setAiLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/pay-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdIds: allJDs.map((j) => j.id) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'AI grouping failed');
      }
      const suggestion = await res.json();

      // Create all suggested groups and add members
      for (const sg of suggestion.groups) {
        // Create the group
        const createRes = await fetch('/api/pay-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: sg.name,
            description: sg.description,
            color: sg.color ?? '#8A7560',
            comment: `AI-generated grouping. ${suggestion.rationale ?? ''} Criteria: Skills, Effort, Responsibility, Working Conditions per EUPTD 2023/970 Article 4.`,
          }),
        });
        if (!createRes.ok) continue;
        const { group: newGroup } = await createRes.json();

        // Add members
        for (const jdId of sg.jdIds ?? []) {
          await fetch(`/api/pay-groups/${newGroup.id}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jdId,
              comment: `AI-assigned based on ${sg.name} value criteria. ${suggestion.rationale?.slice(0, 200) ?? ''}`,
            }),
          });
        }
      }

      await refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const GROUP_COLORS = ['#8A7560', '#2D7A4F', '#A0601A', '#5B6CB5', '#9E2B1D', '#4A7FA5'];

  return (
    <div className="flex h-full gap-0">
      {/* ── Left: Unassigned JDs ─────────────────────────────── */}
      <div className="w-[260px] shrink-0 border-r border-border-default bg-surface-page flex flex-col">
        <div className="border-b border-border-default p-4">
          <div className="text-xs font-semibold text-text-primary mb-1">
            Unassigned JDs
            {unassigned.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0 text-[9px] font-bold text-amber-700">
                {unassigned.length}
              </span>
            )}
          </div>
          <p className="text-[10px] text-text-muted">Drag into a group or use the + button</p>
          <input
            type="search"
            placeholder="Search by title or unit…"
            value={searchJD}
            onChange={(e) => setSearchJD(e.target.value)}
            className="mt-2 w-full rounded-md border border-border-default bg-white px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-gold/40"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredUnassigned.length === 0 ? (
            <div className="py-8 text-center text-[10px] text-text-muted">
              {unassigned.length === 0 ? 'All JDs are assigned ✓' : 'No results'}
            </div>
          ) : (
            filteredUnassigned.map((jd) => (
              <div key={jd.id} className="rounded-lg border border-border-default bg-white p-2.5">
                <div className="flex items-start gap-1.5">
                  <StatusDot status={jd.status} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[10.5px] font-semibold text-text-primary">{jd.jobTitle || 'Untitled'}</div>
                    {jd.orgUnit && <div className="text-[9px] text-text-muted truncate">{jd.orgUnit}</div>}
                  </div>
                </div>
                {/* Add to group buttons */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {groups.slice(0, 4).map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setSelectedGroupForAdd(g.id);
                        setPendingAction({ type: 'add', jdId: jd.id, groupId: g.id });
                      }}
                      className="flex items-center gap-1 rounded border border-border-default px-1.5 py-0.5 text-[8.5px] text-text-muted hover:border-brand-gold/40 hover:text-brand-gold transition-colors"
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: g.color }} />
                      {g.name.slice(0, 18)}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Groups + Audit ────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top toolbar */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-3 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActivePanel('board')}
              className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                activePanel === 'board' ? 'bg-surface-nav text-white' : 'text-text-secondary hover:bg-surface-page')}
            >
              ⊞ Groups ({groups.length})
            </button>
            <button
              type="button"
              onClick={() => setActivePanel('audit')}
              className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                activePanel === 'audit' ? 'bg-surface-nav text-white' : 'text-text-secondary hover:bg-surface-page')}
            >
              ◷ Audit Trail ({allAuditEntries.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {error && (
              <div className="text-[10px] text-danger bg-danger-bg border border-danger/30 rounded px-2 py-1">
                {error}
              </div>
            )}
            {unassigned.length > 0 && groups.length === 0 && (
              <button
                type="button"
                onClick={handleAIGrouping}
                disabled={aiLoading || allJDs.length < 2}
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-gold/40 bg-brand-gold-light px-3 py-1.5 text-xs font-semibold text-brand-gold hover:bg-brand-gold hover:text-white transition-colors disabled:opacity-40"
              >
                {aiLoading ? (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand-gold/30 border-t-brand-gold" />
                ) : '✦'}
                {aiLoading ? 'AI grouping…' : 'Auto-group with AI'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowNewGroup(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-surface-nav px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
            >
              + New Group
            </button>
          </div>
        </div>

        {/* Board view */}
        {activePanel === 'board' && (
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <div className="mb-3 text-4xl">⊞</div>
                <div className="mb-1 text-sm font-semibold text-text-primary">No pay groups yet</div>
                <div className="mb-6 text-xs text-text-muted max-w-sm">
                  Create groups manually or let AI suggest groupings based on EUPTD 2023/970 Article 4 criteria
                  (Skills, Effort, Responsibility, Working Conditions).
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNewGroup(true)}
                    className="rounded-md bg-surface-nav px-4 py-2 text-xs font-semibold text-white"
                  >
                    + Create First Group
                  </button>
                  {allJDs.length >= 2 && (
                    <button
                      type="button"
                      onClick={handleAIGrouping}
                      disabled={aiLoading}
                      className="rounded-md border border-brand-gold px-4 py-2 text-xs font-semibold text-brand-gold"
                    >
                      {aiLoading ? 'Grouping…' : '✦ Auto-group with AI'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex gap-4 p-5 min-w-max">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="w-[260px] shrink-0 flex flex-col rounded-xl border border-border-default bg-surface-page overflow-hidden"
                  >
                    {/* Group header */}
                    <div
                      className="px-4 py-3 border-b border-border-default"
                      style={{ borderTopColor: group.color, borderTopWidth: 3 }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-text-primary truncate">{group.name}</div>
                          {group.description && (
                            <div className="text-[10px] text-text-muted mt-0.5 line-clamp-2">{group.description}</div>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-1">
                          <span className="text-[10px] font-semibold text-text-muted bg-white border border-border-default rounded-full px-2 py-0.5">
                            {group.members.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => { setAuditGroupId(group.id); setActivePanel('audit'); }}
                            title="View audit log"
                            className="text-[11px] text-text-muted hover:text-brand-gold transition-colors"
                          >
                            ◷
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Members */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[500px]">
                      {group.members.length === 0 ? (
                        <div className="py-6 text-center text-[10px] text-text-muted">
                          No JDs yet — add from the left panel
                        </div>
                      ) : (
                        group.members.map((m) => (
                          <JDCard
                            key={m.id}
                            member={m}
                            groups={groups}
                            currentGroupId={group.id}
                            onRemove={(jdId) => setPendingAction({ type: 'remove', jdId, groupId: group.id })}
                            onMove={(jdId, toGroupId) => setPendingAction({ type: 'move', jdId, fromGroupId: group.id, toGroupId })}
                          />
                        ))
                      )}
                    </div>

                    {/* Add from unassigned */}
                    {unassigned.length > 0 && (
                      <div className="border-t border-border-default p-2">
                        <button
                          type="button"
                          onClick={() => setSelectedGroupForAdd(selectedGroupForAdd === group.id ? null : group.id)}
                          className="w-full rounded-md py-1.5 text-[10px] text-text-muted hover:text-brand-gold hover:bg-white transition-colors border border-dashed border-border-default"
                        >
                          + Add JD
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit trail view */}
        {activePanel === 'audit' && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="max-w-2xl mx-auto">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-text-primary">Complete Audit Trail</div>
                  <div className="text-xs text-text-muted">Every pay group decision — required by EUPTD 2023/970 Article 4</div>
                </div>
                {auditGroupId && (
                  <button
                    type="button"
                    onClick={() => setAuditGroupId(null)}
                    className="text-xs text-text-muted hover:text-brand-gold"
                  >
                    Show all groups ×
                  </button>
                )}
              </div>

              {allAuditEntries.length === 0 ? (
                <div className="py-12 text-center text-xs text-text-muted">No actions recorded yet</div>
              ) : (
                <div className="space-y-2">
                  {allAuditEntries
                    .filter((e) => !auditGroupId || (e as any).groupName === groups.find((g) => g.id === auditGroupId)?.name)
                    .map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-border-default bg-white p-3.5">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <AuditBadge action={entry.action} />
                            <span className="text-[10px] font-semibold text-text-primary">
                              {(entry as any).groupName}
                            </span>
                            {entry.fromGroup && entry.toGroup && entry.fromGroup !== entry.toGroup && (
                              <span className="text-[10px] text-text-muted">
                                {entry.fromGroup} → {entry.toGroup}
                              </span>
                            )}
                          </div>
                          <div className="shrink-0 text-[10px] text-text-muted">{relTime(entry.timestamp)}</div>
                        </div>
                        {entry.jdId && (
                          <div className="mb-1.5">
                            <span className="text-[9.5px] text-text-muted">JD: </span>
                            <Link href={`/jd/${entry.jdId}`} className="text-[9.5px] text-brand-gold hover:underline">
                              {allJDs.find((j) => j.id === entry.jdId)?.jobTitle ?? entry.jdId.slice(0, 8) + '…'}
                            </Link>
                          </div>
                        )}
                        <div className="rounded bg-surface-page border border-border-default px-2.5 py-1.5 text-[11px] text-text-secondary italic">
                          "{entry.comment}"
                        </div>
                        <div className="mt-1.5 text-[9px] text-text-muted">
                          {new Date(entry.timestamp).toLocaleString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── New Group Panel ──────────────────────────────────── */}
      {showNewGroup && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[420px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-border-default p-5">
              <h3 className="font-semibold text-text-primary">Create Pay Group</h3>
              <p className="mt-1 text-xs text-text-muted">
                Groups must be named to describe the value level, not the job category — per EUPTD Article 4.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">Group Name *</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Senior Professional, Operational Expert…"
                  className="w-full rounded-lg border border-border-default bg-surface-page px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">Description</label>
                <textarea
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Describe the value level characteristics (skills, responsibility, effort, working conditions)…"
                  rows={3}
                  className="w-full rounded-lg border border-border-default bg-surface-page px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-gold/40 resize-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">Colour</label>
                <div className="flex gap-2">
                  {GROUP_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewGroupColor(c)}
                      className={cn('h-6 w-6 rounded-full border-2 transition-transform', newGroupColor === c ? 'border-text-primary scale-110' : 'border-transparent')}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border-default p-4">
              <button
                type="button"
                onClick={() => { setShowNewGroup(false); setNewGroupName(''); }}
                className="rounded-md border border-border-default px-4 py-1.5 text-xs text-text-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={newGroupName.trim().length < 2}
                onClick={() => setPendingAction({ type: 'create-group' })}
                className="rounded-md bg-brand-gold px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                Continue →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm dialogs ──────────────────────────────────── */}
      {pendingAction?.type === 'create-group' && (
        <CommentDialog
          title="Document group creation"
          hint="Explain the rationale for creating this pay group. Required for EUPTD Article 4 audit trail."
          minLen={10}
          loading={loading}
          onCancel={() => setPendingAction(null)}
          onConfirm={(comment) => handleCreateGroup(comment)}
        />
      )}
      {pendingAction?.type === 'remove' && pendingAction.groupId && pendingAction.jdId && (
        <CommentDialog
          title="Document JD removal"
          hint="Why is this JD being removed from the group? Required for audit trail."
          minLen={10}
          loading={loading}
          onCancel={() => setPendingAction(null)}
          onConfirm={(comment) => handleRemove(pendingAction.groupId!, pendingAction.jdId!, comment)}
        />
      )}
      {pendingAction?.type === 'move' && pendingAction.fromGroupId && pendingAction.toGroupId && pendingAction.jdId && (
        <CommentDialog
          title="Document group move"
          hint="Mandatory: explain why this role belongs to a different pay group. Every re-classification must be documented per EUPTD 2023/970."
          minLen={10}
          loading={loading}
          onCancel={() => setPendingAction(null)}
          onConfirm={(comment) => handleMove(pendingAction.jdId!, pendingAction.fromGroupId!, pendingAction.toGroupId!, comment)}
        />
      )}
      {pendingAction?.type === 'add' && pendingAction.groupId && pendingAction.jdId && (
        <CommentDialog
          title="Document JD assignment"
          hint="Why does this role belong to this pay group? Reference the 4 EUPTD criteria: skills, effort, responsibility, working conditions."
          minLen={10}
          loading={loading}
          onCancel={() => setPendingAction(null)}
          onConfirm={(comment) => handleAdd(pendingAction.groupId!, pendingAction.jdId!, comment)}
        />
      )}
    </div>
  );
}
