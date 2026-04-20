'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface JDSlot {
  id: string;
  jdId: string;
  level: number;
  note?: string;
  jd: { id: string; jobTitle: string; orgUnit?: string; status: string; evalResults: { overallScore: number }[] };
}

interface JobFamily {
  id: string;
  name: string;
  description?: string;
  color: string;
  sortOrder: number;
  slots: JDSlot[];
}

interface UnplacedJD {
  id: string;
  jobTitle: string;
  orgUnit?: string;
  status: string;
  data: Record<string, string>;
}

// Grade levels shown in the matrix
const LEVELS = Array.from({ length: 15 }, (_, i) => i + 1); // 1–15

const FAMILY_COLORS = ['#8A7560', '#2D7A4F', '#5B6CB5', '#A0601A', '#9E2B1D', '#4A7FA5', '#7B5EA7'];

const STATUS_DOT: Record<string, string> = {
  APPROVED: 'bg-green-500',
  DRAFT: 'bg-amber-400',
  UNDER_REVISION: 'bg-blue-400',
  ARCHIVED: 'bg-gray-400',
};

// ── API helpers ────────────────────────────────────────────────────────────────

async function createFamily(name: string, description: string, color: string) {
  const res = await fetch('/api/architecture/families', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, color }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create family');
  return res.json();
}

async function placeJD(familyId: string, jdId: string, level: number, note: string) {
  const res = await fetch('/api/architecture/slots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familyId, jdId, level, note }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to place JD');
  return res.json();
}

async function removeSlot(slotId: string) {
  const res = await fetch(`/api/architecture/slots/${slotId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to remove');
}

// ── JD Card ───────────────────────────────────────────────────────────────────

function MatrixCell({
  family,
  level,
  slots,
  onPlace,
  onRemove,
  dragging,
}: {
  family: JobFamily;
  level: number;
  slots: JDSlot[];
  onPlace: (familyId: string, level: number) => void;
  onRemove: (slotId: string) => void;
  dragging: UnplacedJD | null;
}) {
  const [hover, setHover] = useState(false);
  const canDrop = !!dragging;
  const hasSlots = slots.length > 0;
  // Grow cell height with stack; baseline 72px, add 26px per extra JD, min 72 / max 220
  const minH = hasSlots ? Math.min(220, 44 + slots.length * 28) : 72;

  return (
    <div
      className={cn(
        'border border-border-default rounded-md transition-colors relative',
        hasSlots ? 'bg-white' : 'bg-surface-page',
        canDrop && hover ? 'border-brand-gold bg-brand-gold-light ring-1 ring-brand-gold/30' : '',
        canDrop ? 'cursor-pointer' : '',
      )}
      style={{ minHeight: minH }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => { e.preventDefault(); setHover(false); onPlace(family.id, level); }}
      onClick={() => { if (canDrop && !hasSlots) onPlace(family.id, level); }}
    >
      {hasSlots ? (
        <div className="p-1 h-full flex flex-col gap-0.5">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className="rounded border border-border-default/60 bg-white px-1 py-0.5 group/chip"
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT[slot.jd.status] ?? 'bg-gray-400')} />
                  <Link
                    href={`/jd/${slot.jd.id}`}
                    className="truncate text-[9.5px] font-semibold text-text-primary hover:text-brand-gold leading-tight"
                    title={slot.jd.jobTitle}
                  >
                    {slot.jd.jobTitle || 'Untitled'}
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemove(slot.id); }}
                  className="shrink-0 text-[10px] text-text-muted/50 hover:text-danger transition-colors opacity-0 group-hover/chip:opacity-100"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
              {slot.jd.evalResults[0] && (
                <div className="ml-2.5 text-[7.5px] font-medium" style={{ color: family.color }}>
                  {slot.jd.evalResults[0].overallScore}%
                </div>
              )}
            </div>
          ))}
          {canDrop && hover && (
            <div className="mt-0.5 rounded border border-dashed border-brand-gold bg-brand-gold-light/40 py-0.5 text-center text-[9px] text-brand-gold font-medium">
              + add here
            </div>
          )}
          {!canDrop && (
            <div className="mt-auto pt-0.5 text-[8px] text-text-muted/50 text-right">
              {slots.length} JD{slots.length === 1 ? '' : 's'}
            </div>
          )}
        </div>
      ) : canDrop && hover ? (
        <div className="flex h-full items-center justify-center text-[10px] text-brand-gold font-medium">
          Drop here
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className="text-[9px] text-text-muted/40">—</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ArchitectureMatrix({
  initialFamilies,
  unplacedJDs,
  orgId,
}: {
  initialFamilies: JobFamily[];
  unplacedJDs: UnplacedJD[];
  orgId: string;
}) {
  const [families, setFamilies] = useState<JobFamily[]>(initialFamilies);
  const [unplaced, setUnplaced] = useState<UnplacedJD[]>(unplacedJDs);
  const [dragging, setDragging] = useState<UnplacedJD | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New family form
  const [showNewFamily, setShowNewFamily] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [familyDesc, setFamilyDesc] = useState('');
  const [familyColor, setFamilyColor] = useState('#8A7560');

  const refetch = useCallback(async () => {
    const res = await fetch('/api/architecture/families');
    if (res.ok) {
      const data = await res.json();
      setFamilies(data.families ?? []);
    }
  }, []);

  const handleCreateFamily = async () => {
    if (!familyName.trim()) return;
    setLoading(true);
    try {
      await createFamily(familyName.trim(), familyDesc, familyColor);
      await refetch();
      setShowNewFamily(false);
      setFamilyName('');
      setFamilyDesc('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlace = useCallback(async (familyId: string, level: number) => {
    if (!dragging) return;
    setLoading(true);
    setError(null);
    try {
      await placeJD(familyId, dragging.id, level, '');
      setUnplaced((prev) => prev.filter((j) => j.id !== dragging.id));
      setDragging(null);
      await refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dragging, refetch]);

  const handleRemove = useCallback(async (slotId: string) => {
    setLoading(true);
    setError(null);
    try {
      // Find the JD to put back in unplaced
      const slot = families.flatMap((f) => f.slots).find((s) => s.id === slotId);
      await removeSlot(slotId);
      if (slot) {
        setUnplaced((prev) => [...prev, {
          id: slot.jd.id,
          jobTitle: slot.jd.jobTitle,
          orgUnit: slot.jd.orgUnit,
          status: slot.jd.status,
          data: {},
        }]);
      }
      await refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [families, refetch]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Unplaced JDs ──────────────────────────────── */}
      <div className="w-[220px] shrink-0 border-r border-border-default bg-surface-page flex flex-col">
        <div className="border-b border-border-default p-4">
          <div className="text-xs font-semibold text-text-primary">
            Unplaced JDs
            {unplaced.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0 text-[9px] font-bold text-amber-700">
                {unplaced.length}
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] text-text-muted">Drag onto the matrix to place</div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {unplaced.length === 0 ? (
            <div className="py-6 text-center text-[10px] text-text-muted">All JDs placed ✓</div>
          ) : (
            unplaced.map((jd) => (
              <div
                key={jd.id}
                draggable
                onDragStart={() => setDragging(jd)}
                onDragEnd={() => setDragging(null)}
                className={cn(
                  'cursor-grab rounded-lg border border-border-default bg-white p-2.5 shadow-sm transition-shadow active:cursor-grabbing',
                  dragging?.id === jd.id ? 'opacity-50 shadow-md ring-1 ring-brand-gold/40' : 'hover:shadow-md'
                )}
              >
                <div className="flex items-start gap-1.5">
                  <span className={cn('mt-0.5 h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT[jd.status] ?? 'bg-gray-400')} />
                  <div className="min-w-0">
                    <div className="truncate text-[10.5px] font-semibold text-text-primary">{jd.jobTitle || 'Untitled'}</div>
                    {jd.orgUnit && <div className="text-[9px] text-text-muted truncate">{jd.orgUnit}</div>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Matrix ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border-default bg-white px-5 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold text-text-primary">
              {families.length} Job {families.length === 1 ? 'Family' : 'Families'}
            </div>
            {error && (
              <div className="text-[10px] text-danger bg-danger-bg border border-danger/30 rounded px-2 py-1">{error}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowNewFamily(true)}
            className="rounded-md bg-surface-nav px-3 py-1.5 text-xs font-semibold text-white"
          >
            + New Family
          </button>
        </div>

        {families.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="mb-3 text-4xl">⊞</div>
              <div className="text-sm font-semibold text-text-primary">No job families yet</div>
              <div className="mb-5 mt-1 text-xs text-text-muted">
                Create job families (e.g. Technology, Sales, HR) then drag JDs onto the grade level matrix.
              </div>
              <button
                type="button"
                onClick={() => setShowNewFamily(true)}
                className="rounded-md bg-surface-nav px-5 py-2 text-xs font-semibold text-white"
              >
                + Create First Family
              </button>
            </div>
          </div>
        ) : (
          /* Scrollable matrix */
          <div className="flex-1 overflow-auto p-4">
            {/* Level header row */}
            <div className="flex gap-1 mb-1 pl-[140px]">
              {LEVELS.map((l) => (
                <div key={l} className="w-[100px] shrink-0 text-center text-[9px] font-bold uppercase tracking-wide text-text-muted py-1">
                  L{l}
                </div>
              ))}
            </div>

            {/* Family rows */}
            <div className="space-y-2">
              {families.map((family) => (
                <div key={family.id} className="flex items-stretch gap-1">
                  {/* Family label */}
                  <div
                    className="w-[136px] shrink-0 rounded-lg px-3 py-2 mr-1"
                    style={{ background: family.color + '18', borderLeft: `3px solid ${family.color}` }}
                  >
                    <div className="text-[11px] font-bold text-text-primary truncate">{family.name}</div>
                    {family.description && (
                      <div className="text-[9px] text-text-muted mt-0.5 line-clamp-2">{family.description}</div>
                    )}
                    <div className="mt-1 text-[9px]" style={{ color: family.color }}>
                      {family.slots.length} roles
                    </div>
                  </div>

                  {/* Level cells */}
                  {LEVELS.map((level) => {
                    const cellSlots = family.slots.filter((s) => s.level === level);
                    return (
                      <div key={level} className="w-[100px] shrink-0">
                        <MatrixCell
                          family={family}
                          level={level}
                          slots={cellSlots}
                          onPlace={handlePlace}
                          onRemove={handleRemove}
                          dragging={dragging}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-6 flex items-center gap-4 text-[9px] text-text-muted">
              <span>L1 = Entry level · L15 = Executive/C-suite</span>
              {dragging && <span className="font-semibold text-brand-gold">Drop "{dragging.jobTitle}" onto any empty cell</span>}
            </div>
          </div>
        )}
      </div>

      {/* ── New Family dialog ──────────────────────────────── */}
      {showNewFamily && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[400px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-border-default p-5">
              <h3 className="font-semibold text-text-primary">New Job Family</h3>
              <p className="mt-1 text-xs text-text-muted">
                Job families group related roles across levels (e.g. Technology, Finance, HR, Sales).
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">Family Name *</label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="e.g. Technology, Finance, Operations…"
                  className="w-full rounded-lg border border-border-default bg-surface-page px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">Description</label>
                <input
                  type="text"
                  value={familyDesc}
                  onChange={(e) => setFamilyDesc(e.target.value)}
                  placeholder="Optional description…"
                  className="w-full rounded-lg border border-border-default bg-surface-page px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">Colour</label>
                <div className="flex gap-2">
                  {FAMILY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFamilyColor(c)}
                      className={cn('h-6 w-6 rounded-full border-2 transition-transform', familyColor === c ? 'border-text-primary scale-110' : 'border-transparent hover:scale-105')}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border-default p-4">
              <button
                type="button"
                onClick={() => setShowNewFamily(false)}
                className="rounded-md border border-border-default px-4 py-1.5 text-xs text-text-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={familyName.trim().length < 2 || loading}
                onClick={handleCreateFamily}
                className="inline-flex items-center gap-2 rounded-md bg-brand-gold px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {loading && <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                Create Family
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
