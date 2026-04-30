'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeMouseHandler,
  Position,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

type StepKind = 'start' | 'task' | 'decision' | 'handoff' | 'timer' | 'event' | 'end';

interface OutgoingEdge { targetStepId: string; label?: string; }

interface Step {
  id: string;
  stepOrder: number;
  name: string;
  kind: StepKind;
  actorPositionId: string | null;
  actorRoleName: string | null;
  slaDescription: string | null;
  outgoing: OutgoingEdge[];
}

interface ProcessDTO {
  id: string;
  name: string;
  description: string | null;
  validityFlag: string;
  sourceDocumentIds: string[];
}

interface PositionRef { id: string; name: string; }

const KIND_META: Record<StepKind, { label: string; bg: string; border: string; shape: 'rect' | 'diamond' | 'circle' | 'pill'; icon: string; }> = {
  start:    { label: 'Start',    bg: '#ECFDF5', border: '#059669', shape: 'circle',  icon: '▶' },
  task:     { label: 'Task',     bg: '#FFFFFF', border: '#1A1A1A', shape: 'rect',    icon: '☐' },
  decision: { label: 'Decision', bg: '#FFFBEB', border: '#D97706', shape: 'diamond', icon: '◆' },
  handoff:  { label: 'Hand-off', bg: '#EEF2FF', border: '#4F46E5', shape: 'rect',    icon: '⇌' },
  timer:    { label: 'Timer',    bg: '#FDF2F8', border: '#BE185D', shape: 'circle',  icon: '⏱' },
  event:    { label: 'Event',    bg: '#F0F9FF', border: '#0284C7', shape: 'circle',  icon: '◉' },
  end:      { label: 'End',      bg: '#FEF2F2', border: '#991B1B', shape: 'circle',  icon: '■' },
};

const STEP_BOX = { width: 150, height: 90 };
const LANE_HEIGHT = 130;
const LANE_HEADER_WIDTH = 160;
const HORIZONTAL_GAP = 80;
const PADDING_X = 60;

export default function ProcessMapPageWrapper() {
  return (
    <ReactFlowProvider>
      <ProcessMapPage />
    </ReactFlowProvider>
  );
}

function ProcessMapPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [process, setProcess] = useState<ProcessDTO | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [positions, setPositions] = useState<PositionRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [showChecklist, setShowChecklist] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const flow = useReactFlow();

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pmoa/processes/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProcess(data.process);
        setSteps(data.steps || []);
        setPositions(data.positions || []);
        setDirty(false);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Step mutations ──────────────────────────────────────────────────────
  const patchStep = (stepId: string, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, ...patch } : s));
    setDirty(true);
  };

  const addStep = (kind: StepKind = 'task', after?: Step) => {
    const order = after ? after.stepOrder + 1 : steps.length;
    const newId = crypto.randomUUID();
    const newStep: Step = {
      id: newId,
      stepOrder: order,
      name: KIND_META[kind].label,
      kind,
      actorPositionId: after?.actorPositionId ?? null,
      actorRoleName: after?.actorRoleName ?? null,
      slaDescription: null,
      outgoing: [],
    };

    setSteps((prev) => {
      let next = [...prev];
      // Bump stepOrder for everything ≥ order
      next = next.map((s) => s.stepOrder >= order ? { ...s, stepOrder: s.stepOrder + 1 } : s);
      next.push(newStep);
      // Wire previous step's "linear" outgoing to point at this new one if `after` was given
      if (after) {
        next = next.map((s) => {
          if (s.id !== after.id) return s;
          // Replace any single linear edge with link to new step
          const hadEdge = s.outgoing.length > 0;
          return {
            ...s,
            outgoing: hadEdge && s.outgoing.length === 1
              ? [{ targetStepId: newId, label: '' }]
              : [...s.outgoing, { targetStepId: newId, label: '' }],
          };
        });
      }
      return next.sort((a, b) => a.stepOrder - b.stepOrder);
    });
    setSelectedStepId(newId);
    setDirty(true);
  };

  const removeStep = (stepId: string) => {
    setSteps((prev) => {
      const removed = prev.find((s) => s.id === stepId);
      if (!removed) return prev;
      return prev
        .filter((s) => s.id !== stepId)
        .map((s) => s.stepOrder > removed.stepOrder ? { ...s, stepOrder: s.stepOrder - 1 } : s)
        // remove dangling outgoing references
        .map((s) => ({ ...s, outgoing: s.outgoing.filter((o) => o.targetStepId !== stepId) }));
    });
    if (selectedStepId === stepId) setSelectedStepId(null);
    setDirty(true);
  };

  const addOutgoing = (fromId: string, toId: string, label = '') => {
    if (fromId === toId) return;
    patchStep(fromId, {
      outgoing: [
        ...(steps.find((s) => s.id === fromId)?.outgoing || []),
        { targetStepId: toId, label },
      ],
    });
  };
  const removeOutgoing = (fromId: string, toId: string) => {
    patchStep(fromId, {
      outgoing: (steps.find((s) => s.id === fromId)?.outgoing || []).filter((o) => o.targetStepId !== toId),
    });
  };

  // ── Save ────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!process) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pmoa/processes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: process.name,
          description: process.description,
          steps: steps.map((s) => ({
            id: s.id, stepOrder: s.stepOrder, name: s.name, kind: s.kind,
            actorPositionId: s.actorPositionId, actorRoleName: s.actorRoleName,
            slaDescription: s.slaDescription,
            outgoing: s.outgoing,
          })),
        }),
      });
      if (res.ok) { setSavedAt(new Date()); setDirty(false); }
    } finally {
      setSaving(false);
    }
  };

  // ── Layout: horizontal swim lanes by actor ──────────────────────────────
  // Compute lane labels (one per unique actor, plus "Unassigned" for null)
  const lanes = useMemo(() => {
    const seen = new Map<string, string>(); // key → display label
    for (const s of steps) {
      const key = s.actorPositionId
        ? `pos:${s.actorPositionId}`
        : s.actorRoleName
          ? `txt:${s.actorRoleName.toLowerCase()}`
          : 'unassigned';
      if (!seen.has(key)) {
        const display = s.actorPositionId
          ? positions.find((p) => p.id === s.actorPositionId)?.name || 'Unknown'
          : s.actorRoleName || 'Unassigned';
        seen.set(key, display);
      }
    }
    if (seen.size === 0) seen.set('unassigned', 'Unassigned');
    return Array.from(seen.entries()).map(([key, label], i) => ({ key, label, index: i }));
  }, [steps, positions]);

  const laneIndexFor = useCallback((s: Step) => {
    const key = s.actorPositionId
      ? `pos:${s.actorPositionId}`
      : s.actorRoleName
        ? `txt:${s.actorRoleName.toLowerCase()}`
        : 'unassigned';
    return lanes.findIndex((l) => l.key === key);
  }, [lanes]);

  // X-position by stepOrder so flow reads left-to-right
  const xFor = (order: number) => PADDING_X + LANE_HEADER_WIDTH + order * (STEP_BOX.width + HORIZONTAL_GAP);
  const yFor = (laneIdx: number) =>
    laneIdx * LANE_HEIGHT + (LANE_HEIGHT - STEP_BOX.height) / 2 + 30;
  const canvasWidth = PADDING_X + LANE_HEADER_WIDTH + Math.max(1, steps.length) * (STEP_BOX.width + HORIZONTAL_GAP) + PADDING_X;
  const canvasHeight = lanes.length * LANE_HEIGHT + 60;

  const nodes: Node[] = useMemo(() => {
    return steps.map((s) => {
      const laneIdx = Math.max(0, laneIndexFor(s));
      const meta = KIND_META[s.kind];
      const actorLabel = s.actorPositionId
        ? positions.find((p) => p.id === s.actorPositionId)?.name
        : s.actorRoleName;
      return {
        id: s.id,
        position: { x: xFor(s.stepOrder), y: yFor(laneIdx) },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        type: 'default',
        data: {
          label: <StepBox step={s} actor={actorLabel ?? null} meta={meta}
            selected={selectedStepId === s.id} />,
        },
        style: {
          background: 'transparent',
          border: 'none',
          padding: 0,
          width: STEP_BOX.width,
          height: STEP_BOX.height,
        },
      } satisfies Node;
    });
  }, [steps, positions, selectedStepId, laneIndexFor]);

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    for (const s of steps) {
      for (const o of s.outgoing || []) {
        if (!steps.find((t) => t.id === o.targetStepId)) continue;
        out.push({
          id: `e-${s.id}-${o.targetStepId}`,
          source: s.id,
          target: o.targetStepId,
          type: 'smoothstep',
          label: o.label || undefined,
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 4,
          labelStyle: { fontSize: 9, fill: '#1A1A1A' },
          labelBgStyle: { fill: '#FFFBEB', stroke: '#D97706', strokeWidth: 1 },
          style: { stroke: '#8A7560', strokeWidth: 1.4 },
        });
      }
    }
    return out;
  }, [steps]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedStepId(node.id);
  }, []);

  const selected = selectedStepId ? steps.find((s) => s.id === selectedStepId) : null;

  // ── Exports ────────────────────────────────────────────────────────────
  const exportJSON = () => {
    if (!process) return;
    const payload = {
      process: {
        id: process.id, name: process.name, description: process.description,
        validityFlag: process.validityFlag, sourceDocumentIds: process.sourceDocumentIds,
      },
      steps: steps.map((s) => ({ ...s })),
      lanes: lanes.map((l) => ({ key: l.key, label: l.label })),
      exportedAt: new Date().toISOString(),
      exportedBy: 'JD Suite — PMOA',
    };
    download(`${slug(process.name)}.json`, JSON.stringify(payload, null, 2), 'application/json');
    setExportOpen(false);
  };

  const exportBPMN = () => {
    if (!process) return;
    download(`${slug(process.name)}.bpmn`, generateBPMN(process, steps, positions), 'application/xml');
    setExportOpen(false);
  };

  const exportPDF = () => {
    // Use the browser's print dialog — works without extra deps and lets the user
    // "save as PDF". The print stylesheet hides chrome and prints the canvas only.
    window.print();
    setExportOpen(false);
  };

  // ── Checklist (process completeness wizard) ────────────────────────────
  const checklist = useMemo(() => buildChecklist(steps), [steps]);

  if (loading) return <div className="flex h-full items-center justify-center text-[13px] text-text-muted">Loading…</div>;
  if (!process) return <div className="flex h-full items-center justify-center text-[13px] text-text-muted">Process not found.</div>;

  const PALETTE: StepKind[] = ['start', 'task', 'decision', 'handoff', 'timer', 'event', 'end'];

  return (
    <div className="flex h-full flex-1 flex-col bg-[#FAF7F2] print:bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-border-default bg-white px-6 py-3 print:hidden">
        <div className="flex-1 min-w-0">
          <input value={process.name}
            onChange={(e) => { setProcess({ ...process, name: e.target.value }); setDirty(true); }}
            className="w-full font-display text-lg font-semibold text-text-primary outline-none" />
          <input value={process.description || ''}
            onChange={(e) => { setProcess({ ...process, description: e.target.value }); setDirty(true); }}
            placeholder="Description (optional)"
            className="w-full text-[11px] text-text-muted outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowChecklist((v) => !v)}
            className="rounded border border-border-default bg-white px-3 py-1.5 text-[11px] text-text-primary">
            {showChecklist ? 'Hide checklist' : `Checklist (${checklist.filter(c => !c.done).length})`}
          </button>
          <div className="relative">
            <button onClick={() => setExportOpen((v) => !v)}
              className="rounded border border-border-default bg-white px-3 py-1.5 text-[11px] text-text-primary">
              ↓ Export
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-md border border-border-default bg-white shadow-lg">
                <button onClick={exportJSON} className="block w-full px-3 py-2 text-left text-[11px] hover:bg-surface-page">JSON</button>
                <button onClick={exportBPMN} className="block w-full px-3 py-2 text-left text-[11px] hover:bg-surface-page">BPMN 2.0 XML</button>
                <button onClick={exportPDF} className="block w-full px-3 py-2 text-left text-[11px] hover:bg-surface-page">PDF (print)</button>
                <div className="border-t border-border-default px-3 py-1.5 text-[9px] italic text-text-muted">
                  Visio (.vsdx) coming next
                </div>
              </div>
            )}
          </div>
          <button onClick={save} disabled={!dirty || saving}
            className="rounded-md bg-brand-gold px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-40">
            {saving ? 'Saving…' : dirty ? 'Save changes' : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : 'Saved'}
          </button>
          <Link href="/pmoa/processes" className="rounded border border-border-default bg-white px-3 py-1.5 text-[11px]">
            ← All processes
          </Link>
        </div>
      </div>

      {/* Body: palette | canvas | side panel */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Palette */}
        <aside className="w-[140px] shrink-0 overflow-y-auto border-r border-border-default bg-white p-3 print:hidden">
          <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-text-muted">Add element</div>
          <div className="space-y-1">
            {PALETTE.map((k) => {
              const m = KIND_META[k];
              return (
                <button key={k} onClick={() => addStep(k)}
                  className="flex w-full items-center gap-2 rounded border border-border-default bg-surface-page px-2 py-1.5 text-left text-[11px] hover:border-brand-gold">
                  <span style={{ color: m.border }}>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-text-muted">Zoom</div>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => flow.zoomIn()} title="Zoom in"
              className="rounded border border-border-default bg-white px-2 py-1.5 text-[11px]">🔍+</button>
            <button onClick={() => flow.zoomOut()} title="Zoom out"
              className="rounded border border-border-default bg-white px-2 py-1.5 text-[11px]">🔍−</button>
            <button onClick={() => flow.fitView({ padding: 0.2 })} title="Fit to screen"
              className="rounded border border-border-default bg-white px-2 py-1.5 text-[11px]">⛶ Fit</button>
          </div>
        </aside>

        {/* Canvas with swim lanes */}
        <div ref={containerRef} className="relative flex-1 overflow-auto">
          {steps.length === 0 ? (
            <EmptyState onAdd={() => addStep('task')} />
          ) : (
            <div style={{ width: canvasWidth, height: canvasHeight, position: 'relative' }}>
              {/* Swim-lane backgrounds */}
              <div className="absolute inset-0">
                {lanes.map((l, i) => (
                  <div key={l.key}
                    className={`flex border-b border-border-default ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAF7F2]'}`}
                    style={{ position: 'absolute', top: i * LANE_HEIGHT, left: 0, height: LANE_HEIGHT, width: '100%' }}>
                    <div className="flex shrink-0 items-center justify-center px-3 text-[10px] font-bold uppercase tracking-wider text-text-muted bg-surface-header text-text-on-dark"
                      style={{ width: LANE_HEADER_WIDTH }}>
                      {l.label}
                    </div>
                  </div>
                ))}
              </div>
              {/* React Flow canvas overlaid */}
              <div className="absolute" style={{ inset: 0 }}>
                <ReactFlow nodes={nodes} edges={edges} onNodeClick={onNodeClick}
                  fitView fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
                  minZoom={0.4} maxZoom={2}
                  proOptions={{ hideAttribution: true }}
                  panOnScroll
                  panOnScrollMode={'horizontal' as never}
                  nodesDraggable={false}
                  nodesConnectable={false}>
                  <Background color="#E5DBC8" gap={32} />
                  <Controls position="bottom-right" showInteractive={false} />
                </ReactFlow>
              </div>
            </div>
          )}
        </div>

        {/* Right panel: checklist + step editor */}
        <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden border-l border-border-default bg-white print:hidden">
          {showChecklist && (
            <div className="border-b border-border-default p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Process completeness ({checklist.filter((c) => c.done).length}/{checklist.length})
                </div>
              </div>
              <ul className="space-y-1">
                {checklist.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-[11px]">
                    <span className={c.done ? 'text-success' : 'text-text-muted'}>{c.done ? '✓' : '○'}</span>
                    <div className="flex-1">
                      <div className={c.done ? 'text-text-muted line-through' : 'text-text-primary'}>{c.label}</div>
                      {!c.done && c.hint && <div className="mt-0.5 text-[10px] italic text-text-muted">{c.hint}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4">
            {selected ? (
              <StepEditor
                step={selected}
                allSteps={steps}
                positions={positions}
                onPatch={(p) => patchStep(selected.id, p)}
                onAddOutgoing={(toId, label) => addOutgoing(selected.id, toId, label)}
                onRemoveOutgoing={(toId) => removeOutgoing(selected.id, toId)}
                onAddAfter={() => addStep('task', selected)}
                onDelete={() => removeStep(selected.id)}
                onClose={() => setSelectedStepId(null)}
              />
            ) : (
              <div className="text-[11px] italic text-text-muted">
                Click a step on the canvas to edit it. Add new elements from the palette on the left.
              </div>
            )}
          </div>
        </aside>
      </div>

      <style jsx global>{`
        @media print {
          .react-flow__minimap, .react-flow__controls { display: none !important; }
          aside { display: none !important; }
          .react-flow__node { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function StepBox({ step, actor, meta, selected }: {
  step: Step; actor: string | null; meta: typeof KIND_META[StepKind]; selected: boolean;
}) {
  const isCircular = meta.shape === 'circle';
  const isDiamond = meta.shape === 'diamond';
  const baseStyle: React.CSSProperties = {
    background: meta.bg,
    border: `2px solid ${selected ? '#8A7560' : meta.border}`,
    boxShadow: selected ? '0 0 0 3px rgba(138,117,96,0.18)' : '0 1px 3px rgba(0,0,0,0.06)',
    width: STEP_BOX.width,
    height: STEP_BOX.height,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    padding: 6,
    borderRadius: isCircular ? '50%' : 8,
    transform: isDiamond ? 'rotate(45deg)' : undefined,
    overflow: 'hidden',
  };
  const inner: React.CSSProperties = isDiamond ? { transform: 'rotate(-45deg)' } : {};
  return (
    <div style={baseStyle}>
      <div style={inner} className="flex flex-col items-center justify-center gap-0.5">
        <div className="flex items-center gap-1 text-[8px] uppercase tracking-wider" style={{ color: meta.border }}>
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
          <span>· #{step.stepOrder + 1}</span>
        </div>
        <div className="line-clamp-2 text-[11px] font-semibold leading-tight text-text-primary">
          {step.name || '(unnamed)'}
        </div>
        {actor && <div className="line-clamp-1 text-[9px] text-text-muted">▸ {actor}</div>}
        {step.slaDescription && (
          <div className="line-clamp-1 text-[8px] italic text-text-muted">{step.slaDescription}</div>
        )}
      </div>
    </div>
  );
}

function StepEditor({ step, allSteps, positions, onPatch, onAddOutgoing, onRemoveOutgoing, onAddAfter, onDelete, onClose }: {
  step: Step;
  allSteps: Step[];
  positions: PositionRef[];
  onPatch: (p: Partial<Step>) => void;
  onAddOutgoing: (toId: string, label: string) => void;
  onRemoveOutgoing: (toId: string) => void;
  onAddAfter: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [newTargetId, setNewTargetId] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const targetCandidates = allSteps.filter(
    (s) => s.id !== step.id && !step.outgoing.some((o) => o.targetStepId === s.id),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Step {step.stepOrder + 1}</div>
          <div className="font-display text-base font-semibold text-text-primary">{step.name || '(unnamed)'}</div>
        </div>
        <button onClick={onClose} className="text-base text-text-muted">×</button>
      </div>

      <Field label="Name">
        <input value={step.name} onChange={(e) => onPatch({ name: e.target.value })}
          className="w-full rounded border border-border-default px-2 py-1.5 text-[12px] outline-none" />
      </Field>
      <Field label="Kind">
        <select value={step.kind} onChange={(e) => onPatch({ kind: e.target.value as StepKind })}
          className="w-full rounded border border-border-default px-2 py-1.5 text-[12px] outline-none">
          {(['start', 'task', 'decision', 'handoff', 'timer', 'event', 'end'] as StepKind[]).map((k) => (
            <option key={k} value={k}>{KIND_META[k].label}</option>
          ))}
        </select>
      </Field>
      <Field label="Actor / lane (formal position)">
        <select value={step.actorPositionId || ''}
          onChange={(e) => onPatch({ actorPositionId: e.target.value || null })}
          className="w-full rounded border border-border-default px-2 py-1.5 text-[12px] outline-none">
          <option value="">— none / use free-text below —</option>
          {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Or actor (free text)">
        <input value={step.actorRoleName || ''}
          onChange={(e) => onPatch({ actorRoleName: e.target.value || null })}
          placeholder="e.g. HR Manager, IT Lead"
          className="w-full rounded border border-border-default px-2 py-1.5 text-[12px] outline-none" />
      </Field>
      <Field label="SLA / timing">
        <input value={step.slaDescription || ''}
          onChange={(e) => onPatch({ slaDescription: e.target.value || null })}
          placeholder="e.g. within 2 business days"
          className="w-full rounded border border-border-default px-2 py-1.5 text-[12px] outline-none" />
      </Field>

      {/* Outgoing connections */}
      <div className="rounded-md border border-border-default p-2.5">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
          Outgoing connections {step.kind === 'decision' && <span className="text-warning">(label each branch)</span>}
        </div>
        {step.outgoing.length === 0 && (
          <div className="mb-2 text-[10px] italic text-text-muted">No connections. This step is a terminal.</div>
        )}
        <ul className="mb-2 space-y-1">
          {step.outgoing.map((o) => {
            const target = allSteps.find((s) => s.id === o.targetStepId);
            return (
              <li key={o.targetStepId} className="flex items-center gap-1 rounded bg-surface-page p-1 text-[11px]">
                <span className="flex-1 truncate">
                  →{' '}<strong>{target?.name || '?'}</strong>
                  {o.label && <span className="ml-1 text-warning">({o.label})</span>}
                </span>
                <button onClick={() => onRemoveOutgoing(o.targetStepId)}
                  className="text-[14px] text-text-muted hover:text-danger">×</button>
              </li>
            );
          })}
        </ul>
        {targetCandidates.length > 0 && (
          <div className="space-y-1.5">
            <select value={newTargetId} onChange={(e) => setNewTargetId(e.target.value)}
              className="w-full rounded border border-border-default px-2 py-1 text-[11px] outline-none">
              <option value="">— add connection to step —</option>
              {targetCandidates.map((s) => (
                <option key={s.id} value={s.id}>#{s.stepOrder + 1} {s.name}</option>
              ))}
            </select>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Branch label (optional, e.g. Yes / No)"
              className="w-full rounded border border-border-default px-2 py-1 text-[11px] outline-none" />
            <button onClick={() => {
              if (!newTargetId) return;
              onAddOutgoing(newTargetId, newLabel);
              setNewTargetId(''); setNewLabel('');
            }} className="w-full rounded bg-text-primary px-2 py-1 text-[10px] font-medium text-white">
              + Add connection
            </button>
          </div>
        )}
      </div>

      <button onClick={onAddAfter}
        className="w-full rounded border border-border-default px-2 py-1.5 text-[10px]">
        + Insert step after this one (auto-link)
      </button>
      <button onClick={onDelete}
        className="w-full rounded border border-danger px-2 py-1.5 text-[10px] text-danger hover:bg-danger-bg">
        Delete step
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      {children}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="text-center">
        <div className="mb-3 text-3xl opacity-30">⊞</div>
        <div className="font-display text-lg text-text-primary">No steps yet</div>
        <p className="mx-auto mt-1 max-w-[420px] text-[11px] text-text-muted">
          Add a step from the palette on the left, or click below.
        </p>
        <button onClick={onAdd}
          className="mt-3 rounded bg-brand-gold px-3 py-1.5 text-[11px] font-medium text-white">
          + Add first step
        </button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

interface ChecklistItem { id: string; label: string; done: boolean; hint?: string; }

function buildChecklist(steps: Step[]): ChecklistItem[] {
  const has = (k: StepKind) => steps.some((s) => s.kind === k);
  const stepsWithoutActor = steps.filter((s) => !s.actorPositionId && !s.actorRoleName).length;
  const stepsWithoutOutgoing = steps.filter((s) => s.kind !== 'end' && s.outgoing.length === 0).length;
  const decisionsWithoutLabels = steps.filter((s) => s.kind === 'decision'
    && s.outgoing.length > 0
    && s.outgoing.some((o) => !o.label?.trim())).length;
  const stepsWithoutSLA = steps.filter((s) => s.kind === 'task' && !s.slaDescription).length;

  return [
    { id: 'has-start', label: 'Has a Start event', done: has('start'),
      hint: 'Drop a Start element from the palette to mark where the process begins.' },
    { id: 'has-end', label: 'Has an End event', done: has('end'),
      hint: 'Drop an End element so the flow has a clear terminator.' },
    { id: 'all-actors', label: 'Every step has an actor (lane)', done: stepsWithoutActor === 0,
      hint: stepsWithoutActor > 0 ? `${stepsWithoutActor} step(s) without an actor — assign positions to populate swim lanes.` : undefined },
    { id: 'no-orphans', label: 'No orphan steps (every non-end step has an outgoing edge)', done: stepsWithoutOutgoing === 0,
      hint: stepsWithoutOutgoing > 0 ? `${stepsWithoutOutgoing} step(s) have no outgoing connection.` : undefined },
    { id: 'decisions-labeled', label: 'Decision branches are labelled (Yes/No, etc.)', done: decisionsWithoutLabels === 0,
      hint: decisionsWithoutLabels > 0 ? `${decisionsWithoutLabels} decision(s) have unlabelled branches.` : undefined },
    { id: 'slas', label: 'Tasks have SLA / timing notes', done: stepsWithoutSLA === 0 && steps.some((s) => s.kind === 'task'),
      hint: stepsWithoutSLA > 0 ? `${stepsWithoutSLA} task(s) without timing — useful for SLA reporting.` : undefined },
    { id: 'rasci-stub', label: 'RASCI assigned (auto-generates from actors)', done: false,
      hint: 'CP6 will compute RASCI per step from these lanes. Coming next.' },
    { id: 'jd-mapped', label: 'Steps mapped to JD responsibilities', done: false,
      hint: 'Once JDs are uploaded for the actor positions, CP7 will surface "this step ↔ that JD bullet" links.' },
  ];
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'process';
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

function generateBPMN(p: ProcessDTO, steps: Step[], positions: PositionRef[]): string {
  const ts = new Date().toISOString();
  const id = `Process_${p.id.replace(/-/g, '')}`;
  const nodeXml = steps.map((s) => bpmnNodeFor(s)).join('\n    ');
  const flowXml = steps.flatMap((s) =>
    s.outgoing.map((o) => `<bpmn:sequenceFlow id="Flow_${s.id.slice(0,8)}_${o.targetStepId.slice(0,8)}" sourceRef="Step_${s.id.replace(/-/g,'')}" targetRef="Step_${o.targetStepId.replace(/-/g,'')}"${o.label ? ` name="${escapeXml(o.label)}"` : ''} />`)
  ).join('\n    ');

  // Lane set — one lane per unique actor
  const laneKeys = new Set<string>();
  const laneMap: Array<{ key: string; label: string; refs: string[] }> = [];
  for (const s of steps) {
    const key = s.actorPositionId
      ? `pos:${s.actorPositionId}`
      : s.actorRoleName
        ? `txt:${s.actorRoleName.toLowerCase()}`
        : 'unassigned';
    if (!laneKeys.has(key)) {
      const label = s.actorPositionId
        ? positions.find((p) => p.id === s.actorPositionId)?.name || 'Unknown'
        : s.actorRoleName || 'Unassigned';
      laneMap.push({ key, label, refs: [] });
      laneKeys.add(key);
    }
    laneMap.find((l) => l.key === key)!.refs.push(`Step_${s.id.replace(/-/g,'')}`);
  }
  const lanesXml = laneMap.map((l, i) => `
      <bpmn:lane id="Lane_${i}" name="${escapeXml(l.label)}">
        ${l.refs.map((r) => `<bpmn:flowNodeRef>${r}</bpmn:flowNodeRef>`).join('\n        ')}
      </bpmn:lane>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="Definitions_${p.id.slice(0,8)}"
  targetNamespace="https://jdsuite.tech/bpmn"
  exporter="JD Suite — PMOA"
  exporterVersion="0.1"
  expressionLanguage="https://www.w3.org/1999/XPath">
  <bpmn:process id="${id}" name="${escapeXml(p.name)}" isExecutable="false">
    <bpmn:laneSet id="LaneSet_${p.id.slice(0,8)}">${lanesXml}
    </bpmn:laneSet>
    ${nodeXml}
    ${flowXml}
  </bpmn:process>
  <!-- exported ${ts} -->
</bpmn:definitions>`;
}

function bpmnNodeFor(s: Step): string {
  const id = `Step_${s.id.replace(/-/g, '')}`;
  const name = escapeXml(s.name || KIND_META[s.kind].label);
  const incoming = ''; // BPMN-readers compute incoming via sequenceFlows
  const outgoingRefs = s.outgoing.map((o) =>
    `<bpmn:outgoing>Flow_${s.id.slice(0,8)}_${o.targetStepId.slice(0,8)}</bpmn:outgoing>`).join('');
  switch (s.kind) {
    case 'start':
      return `<bpmn:startEvent id="${id}" name="${name}">${outgoingRefs}</bpmn:startEvent>`;
    case 'end':
      return `<bpmn:endEvent id="${id}" name="${name}">${incoming}</bpmn:endEvent>`;
    case 'decision':
      return `<bpmn:exclusiveGateway id="${id}" name="${name}">${outgoingRefs}</bpmn:exclusiveGateway>`;
    case 'timer':
      return `<bpmn:intermediateCatchEvent id="${id}" name="${name}"><bpmn:timerEventDefinition/>${outgoingRefs}</bpmn:intermediateCatchEvent>`;
    case 'event':
      return `<bpmn:intermediateThrowEvent id="${id}" name="${name}">${outgoingRefs}</bpmn:intermediateThrowEvent>`;
    case 'handoff':
      return `<bpmn:sendTask id="${id}" name="${name}">${outgoingRefs}</bpmn:sendTask>`;
    case 'task':
    default:
      return `<bpmn:task id="${id}" name="${name}">${outgoingRefs}</bpmn:task>`;
  }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));
}
