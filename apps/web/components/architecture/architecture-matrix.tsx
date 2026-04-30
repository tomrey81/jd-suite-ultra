'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { abbrevFamily, formatPositionCode } from '@/lib/position-code';
import { AXIOMERA_BANDS, gradeToBandCode, getBand, visibleGrades } from '@/lib/architecture/axiomera-bands';

interface JDSlot {
  id: string;
  jdId: string;
  level: number;
  note?: string;
  jd: { id: string; jobTitle: string; orgUnit?: string; jobCode?: string | null; status: string; evalResults: { overallScore: number }[] };
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
  jobCode?: string | null;
  status: string;
  data: Record<string, string>;
}

// Axiomera grades 6-30, descending (E5 executive at top → A1 entry at bottom).
const ALL_GRADES_DESC = Array.from({ length: 25 }, (_, i) => 30 - i);

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

// ── JD chip (2-line title + 1-line code) ───────────────────────────────────────

function JDChip({
  family,
  slot,
  seqInCell,
  onRemove,
  compact,
}: {
  family: JobFamily;
  slot: JDSlot;
  seqInCell: number;
  onRemove: (slotId: string) => void;
  compact: boolean;
}) {
  const code = slot.jd.jobCode || formatPositionCode(family.name, slot.level, seqInCell);
  const evalScore = slot.jd.evalResults[0]?.overallScore;
  const statusLabel: Record<string, string> = {
    DRAFT: 'Draft',
    UNDER_REVISION: 'Under review',
    APPROVED: 'Approved',
    ARCHIVED: 'Archived',
  };

  return (
    <div
      className="group/chip rounded-md border border-border-default/70 bg-white px-1.5 py-1 transition-colors hover:border-brand-gold"
      title={`${slot.jd.jobTitle}\nStatus: ${statusLabel[slot.jd.status] || slot.jd.status}${evalScore != null ? `\nEvaluation: ${evalScore}%` : '\nNot yet evaluated'}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={cn('mt-1 h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT[slot.jd.status] ?? 'bg-gray-400')}
          title={statusLabel[slot.jd.status] || slot.jd.status}
        />
        <div className="min-w-0 flex-1">
          <Link href={`/jd/${slot.jd.id}`}
            className="block text-[10.5px] font-semibold leading-[1.2] text-text-primary hover:text-brand-gold line-clamp-2">
            {slot.jd.jobTitle || 'Untitled'}
          </Link>
          <div className="mt-0.5 flex items-center gap-1">
            <span className="font-mono text-[8.5px] font-bold tracking-wide" style={{ color: family.color }}>
              {code}
            </span>
            {evalScore != null ? (
              <span
                className={cn(
                  'rounded-full px-1 py-px text-[8px] font-bold',
                  evalScore >= 75 ? 'bg-emerald-100 text-emerald-700' :
                  evalScore >= 50 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700',
                )}
                title={`Axiomera evaluation score ${evalScore}%`}
              >
                {evalScore}
              </span>
            ) : !compact && (
              <span className="text-[8px] text-text-muted/60" title="No evaluation yet">·</span>
            )}
          </div>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(slot.id); }}
          className="shrink-0 text-[11px] leading-none text-text-muted/40 opacity-0 transition-opacity hover:text-danger group-hover/chip:opacity-100"
          aria-label="Remove">
          ×
        </button>
      </div>
    </div>
  );
}

// ── Cell ──────────────────────────────────────────────────────────────────────

function MatrixCell({
  family, level, slots, onPlace, onRemove, dragging, compact,
}: {
  family: JobFamily;
  level: number;
  slots: JDSlot[];
  onPlace: (familyId: string, level: number) => void;
  onRemove: (slotId: string) => void;
  dragging: UnplacedJD | null;
  compact: boolean;
}) {
  const [hover, setHover] = useState(false);
  const canDrop = !!dragging;
  const hasSlots = slots.length > 0;

  return (
    <div
      className={cn(
        'relative h-full border-r border-b border-border-default/60 transition-colors',
        canDrop && hover ? 'bg-brand-gold-light/40 ring-1 ring-brand-gold/30' : '',
        canDrop ? 'cursor-pointer' : '',
        hasSlots ? 'bg-white' : 'bg-surface-page/30',
      )}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => { e.preventDefault(); setHover(false); onPlace(family.id, level); }}
      onClick={() => { if (canDrop) onPlace(family.id, level); }}>
      {hasSlots ? (
        <div className="flex h-full flex-col gap-1 p-1">
          {slots.map((slot, i) => (
            <JDChip key={slot.id} family={family} slot={slot} seqInCell={i + 1}
              onRemove={onRemove} compact={compact} />
          ))}
          {canDrop && hover && (
            <div className="rounded border border-dashed border-brand-gold py-0.5 text-center text-[9px] font-medium text-brand-gold">
              + add here
            </div>
          )}
        </div>
      ) : canDrop && hover ? (
        <div className="flex h-full items-center justify-center text-[10px] font-medium text-brand-gold">
          Drop here
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className="text-[8px] text-text-muted/40">·</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ArchitectureMatrix({
  initialFamilies,
  unplacedJDs,
  orgId: _orgId,
}: {
  initialFamilies: JobFamily[];
  unplacedJDs: UnplacedJD[];
  orgId: string;
}) {
  const [families, setFamilies] = useState<JobFamily[]>(initialFamilies);
  const [unplaced, setUnplaced] = useState<UnplacedJD[]>(unplacedJDs);
  const [dragging, setDragging] = useState<UnplacedJD | null>(null);
  const [showAllGrades, setShowAllGrades] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New family form
  const [showNewFamily, setShowNewFamily] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [familyDesc, setFamilyDesc] = useState('');
  const [familyColor, setFamilyColor] = useState('#8A7560');

  // Auto-rescale: as family count grows, columns shrink to fit one viewport.
  // We compute a column width from the available horizontal space.
  const [viewportWidth, setViewportWidth] = useState<number>(1280);
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const sidebarWidth = 220;       // unplaced rail
  const navWidth = 214;            // app sidebar
  const headerWidth = 56;          // level-label column inside the matrix
  const padding = 32;
  const available = Math.max(640, viewportWidth - sidebarWidth - navWidth - headerWidth - padding);
  const numFamilies = Math.max(1, families.length);
  // Min 110 px per column to keep titles readable, max 220 px to avoid huge gaps
  const colWidth = Math.max(110, Math.min(220, Math.floor(available / numFamilies)));
  const compact = colWidth < 140;

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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlace = useCallback(async (familyId: string, level: number) => {
    if (!dragging) return;
    setLoading(true); setError(null);
    try {
      await placeJD(familyId, dragging.id, level, '');
      setUnplaced((prev) => prev.filter((j) => j.id !== dragging.id));
      setDragging(null);
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [dragging, refetch]);

  const handleRemove = useCallback(async (slotId: string) => {
    setLoading(true); setError(null);
    try {
      const slot = families.flatMap((f) => f.slots).find((s) => s.id === slotId);
      await removeSlot(slotId);
      if (slot) {
        setUnplaced((prev) => [...prev, {
          id: slot.jd.id,
          jobTitle: slot.jd.jobTitle,
          orgUnit: slot.jd.orgUnit,
          jobCode: slot.jd.jobCode,
          status: slot.jd.status,
          data: {},
        }]);
      }
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [families, refetch]);

  // Pre-compute slots[familyId][level] for fast cell lookup
  const slotsIndex = useMemo(() => {
    const idx = new Map<string, Map<number, JDSlot[]>>();
    for (const f of families) {
      const fmap = new Map<number, JDSlot[]>();
      for (const s of f.slots) {
        const list = fmap.get(s.level) || [];
        list.push(s);
        fmap.set(s.level, list);
      }
      idx.set(f.id, fmap);
    }
    return idx;
  }, [families]);

  // Smart grade visibility — show only grades with placements + ±1 buffer,
  // unless user toggles "show all grades".
  const placedGrades = useMemo(() => {
    const set = new Set<number>();
    for (const f of families) for (const s of f.slots) set.add(s.level);
    return Array.from(set);
  }, [families]);
  const visibleGradeList = useMemo(() => {
    if (showAllGrades) return ALL_GRADES_DESC;
    return visibleGrades(placedGrades, 2);
  }, [placedGrades, showAllGrades]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Unplaced JDs ──────────────────────────────── */}
      <div className="flex w-[220px] shrink-0 flex-col border-r border-border-default bg-surface-page">
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
        <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {unplaced.length === 0 ? (
            <div className="py-6 text-center text-[10px] text-text-muted">All JDs placed ✓</div>
          ) : (
            unplaced.map((jd) => (
              <div key={jd.id}
                draggable
                onDragStart={() => setDragging(jd)}
                onDragEnd={() => setDragging(null)}
                className={cn(
                  'cursor-grab rounded-lg border border-border-default bg-white p-2.5 shadow-sm transition-shadow active:cursor-grabbing',
                  dragging?.id === jd.id ? 'opacity-50 shadow-md ring-1 ring-brand-gold/40' : 'hover:shadow-md',
                )}>
                <div className="flex items-start gap-1.5">
                  <span className={cn('mt-0.5 h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT[jd.status] ?? 'bg-gray-400')} />
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-[10.5px] font-semibold leading-[1.2] text-text-primary">
                      {jd.jobTitle || 'Untitled'}
                    </div>
                    {jd.jobCode && (
                      <div className="mt-0.5 truncate font-mono text-[8.5px] text-brand-gold">{jd.jobCode}</div>
                    )}
                    {jd.orgUnit && <div className="truncate text-[9px] text-text-muted">{jd.orgUnit}</div>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Matrix ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-default bg-white px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold text-text-primary">
              {families.length} Job {families.length === 1 ? 'Family' : 'Families'} · 25 levels
            </div>
            {error && (
              <div className="rounded border border-danger/30 bg-danger-bg px-2 py-1 text-[10px] text-danger">{error}</div>
            )}
            {dragging && (
              <div className="rounded bg-brand-gold-light px-2 py-1 text-[10px] font-medium text-brand-gold">
                Drop &quot;{dragging.jobTitle}&quot; into any cell
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAllGrades(!showAllGrades)}
              className={cn(
                'rounded-full border px-3 py-1 text-[10px] font-medium transition-colors',
                showAllGrades
                  ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                  : 'border-border-default bg-white text-text-muted hover:border-brand-gold',
              )}
              title={showAllGrades ? 'Click to show only used grades + buffer' : 'Click to show all grades 6-30'}
            >
              {showAllGrades ? 'Showing all grades 6–30' : `Showing ${visibleGradeList.length} grades (in use)`}
            </button>
            <span className="text-[10px] text-text-muted">
              {colWidth}px / col
            </span>
            <button type="button" onClick={() => setShowNewFamily(true)}
              className="rounded-md bg-surface-nav px-3 py-1.5 text-xs font-semibold text-white">
              + New Family
            </button>
          </div>
        </div>

        {families.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mb-3 text-4xl">⊞</div>
              <div className="text-sm font-semibold text-text-primary">No job families yet</div>
              <div className="mb-5 mt-1 text-xs text-text-muted">
                Create job families (e.g. Technology, HR C&amp;B, Sales) then drag JDs onto the level grid.
              </div>
              <button type="button" onClick={() => setShowNewFamily(true)}
                className="rounded-md bg-surface-nav px-5 py-2 text-xs font-semibold text-white">
                + Create First Family
              </button>
            </div>
          </div>
        ) : (
          /* Transposed matrix: families on top (cols), levels down the side (rows) */
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Axiomera band legend */}
            <div className="flex shrink-0 items-center gap-2 border-b border-border-default bg-surface-page/50 px-5 py-2 text-[10px]">
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Bands</span>
              {AXIOMERA_BANDS.map((b) => (
                <span
                  key={b.letter}
                  className="flex items-center gap-1 rounded-full border border-border-default/50 bg-white px-2 py-0.5"
                  title={b.description}
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: b.color }} />
                  <span className="font-mono font-semibold" style={{ color: b.color }}>
                    {b.letter}1–{b.letter}5
                  </span>
                  <span className="text-text-muted">·</span>
                  <span className="text-text-secondary">{b.label}</span>
                  <span className="text-text-muted">({b.gradeMin}–{b.gradeMax})</span>
                </span>
              ))}
            </div>
            <div className="flex-1 overflow-auto">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `${headerWidth}px repeat(${families.length}, ${colWidth}px)`,
                gridAutoRows: '76px',
              }}>
              {/* ── Header row: corner + family columns ──────────── */}
              <div className="sticky top-0 left-0 z-30 border-b border-r border-border-default bg-surface-page" />
              {families.map((family) => (
                <div key={family.id}
                  className="sticky top-0 z-20 flex flex-col items-stretch justify-center border-b border-r border-border-default bg-white px-2 py-2 text-center"
                  style={{ borderTop: `3px solid ${family.color}` }}>
                  <div className="line-clamp-2 text-[12px] font-bold leading-[1.15] text-text-primary"
                    title={family.name}>
                    {family.name}
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-2 text-[9px]">
                    <span className="font-mono font-bold" style={{ color: family.color }}>
                      {abbrevFamily(family.name)}
                    </span>
                    <span className="text-text-muted">·</span>
                    <span style={{ color: family.color }}>{family.slots.length} role{family.slots.length === 1 ? '' : 's'}</span>
                  </div>
                </div>
              ))}

              {/* ── Body rows: level header + cells per family ─── */}
              {visibleGradeList.map((level) => (
                <RowFragment key={level}
                  level={level}
                  families={families}
                  slotsIndex={slotsIndex}
                  onPlace={handlePlace}
                  onRemove={handleRemove}
                  dragging={dragging}
                  compact={compact} />
              ))}
            </div>

            </div>
            {/* Legend */}
            <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border-default bg-white px-5 py-2 text-[10px] text-text-muted">
              <span>
                Axiomera grades 6–30 · A1 entry → E5 executive. Position code = <strong>FAMILY+GRADE+SEQ</strong>
                (e.g. <code className="font-mono">HRCB1701</code> = HR C&amp;B, grade 17 / C2, slot 1).
              </span>
              <span className="font-mono">{families.reduce((a, f) => a + f.slots.length, 0)} placed · {unplaced.length} unplaced</span>
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
                Job families group related roles across levels. Multi-word names work best — abbreviation auto-derives initials (e.g. &quot;HR Compensation &amp; Benefits&quot; → <code className="font-mono">HRCB</code>).
              </p>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">Family name *</label>
                <input type="text" value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="e.g. HR Compensation & Benefits"
                  className="w-full rounded-lg border border-border-default bg-surface-page px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  autoFocus />
                {familyName.trim() && (
                  <div className="mt-1 text-[10px] text-text-muted">
                    Abbreviation: <span className="font-mono font-bold text-brand-gold">{abbrevFamily(familyName.trim())}</span> ·
                    sample code: <span className="font-mono">{formatPositionCode(familyName.trim(), 5, 1)}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">Description</label>
                <input type="text" value={familyDesc}
                  onChange={(e) => setFamilyDesc(e.target.value)}
                  placeholder="Optional description…"
                  className="w-full rounded-lg border border-border-default bg-surface-page px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-primary">Colour</label>
                <div className="flex gap-2">
                  {FAMILY_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setFamilyColor(c)}
                      className={cn('h-6 w-6 rounded-full border-2 transition-transform', familyColor === c ? 'border-text-primary scale-110' : 'border-transparent hover:scale-105')}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border-default p-4">
              <button type="button" onClick={() => setShowNewFamily(false)}
                className="rounded-md border border-border-default px-4 py-1.5 text-xs text-text-secondary">
                Cancel
              </button>
              <button type="button"
                disabled={familyName.trim().length < 2 || loading}
                onClick={handleCreateFamily}
                className="inline-flex items-center gap-2 rounded-md bg-brand-gold px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
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

// Render one row: bold level label + N cells (one per family).
function RowFragment({
  level, families, slotsIndex, onPlace, onRemove, dragging, compact,
}: {
  level: number;
  families: JobFamily[];
  slotsIndex: Map<string, Map<number, JDSlot[]>>;
  onPlace: (familyId: string, level: number) => void;
  onRemove: (slotId: string) => void;
  dragging: UnplacedJD | null;
  compact: boolean;
}) {
  const band = getBand(level);
  const bandCode = gradeToBandCode(level);
  return (
    <>
      {/* Grade header (sticky left) — Axiomera grade + band code */}
      <div
        className="sticky left-0 z-10 flex flex-col items-center justify-center border-b border-r border-border-default bg-surface-page py-1"
        style={band ? { borderLeft: `3px solid ${band.color}` } : undefined}
        title={band ? `${band.label} band — grades ${band.gradeMin}-${band.gradeMax}` : undefined}
      >
        <div className="font-display text-[13px] font-bold leading-none text-text-primary">{level}</div>
        <div className="mt-0.5 font-mono text-[9px] font-semibold leading-none" style={{ color: band?.color || '#888' }}>
          {bandCode}
        </div>
      </div>
      {families.map((family) => {
        const slots = slotsIndex.get(family.id)?.get(level) || [];
        return (
          <MatrixCell key={`${family.id}-${level}`}
            family={family} level={level} slots={slots}
            onPlace={onPlace} onRemove={onRemove} dragging={dragging}
            compact={compact} />
        );
      })}
    </>
  );
}
