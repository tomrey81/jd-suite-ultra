'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ExportMenu } from '@/components/export/export-menu';

interface PositionDTO {
  id: string;
  name: string;
  positionNumber: string | null;
  reportsToId: string | null;
  departmentId: string | null;
  currentHolderName: string | null;
  vacancy: boolean;
  spanOfControl: number;
  linkedJdId: string | null;
  sourceDocumentIds: string[];
}
interface DepartmentDTO { id: string; name: string; parentId: string | null; headPositionId: string | null; }
interface AssignmentDTO {
  id: string;
  positionId: string;
  personName: string;
  kind: 'permanent' | 'acting' | 'split';
  splitAllocations: unknown;
}

type ModalMode = 'add-position' | 'edit-position' | 'add-department' | null;

function layoutTree(positions: PositionDTO[]): Map<string, { x: number; y: number }> {
  const idx = new Map(positions.map((p) => [p.id, p]));
  const children = new Map<string, string[]>();
  for (const p of positions) {
    if (p.reportsToId && idx.has(p.reportsToId)) {
      const list = children.get(p.reportsToId) || [];
      list.push(p.id);
      children.set(p.reportsToId, list);
    }
  }
  const roots = positions.filter((p) => !p.reportsToId || !idx.has(p.reportsToId));
  const out = new Map<string, { x: number; y: number }>();
  const HSPACE = 230;
  const VSPACE = 140;

  function layoutSubtree(id: string, depth: number, leftCursor: { v: number }): number {
    const kids = children.get(id) || [];
    if (kids.length === 0) {
      const x = leftCursor.v * HSPACE;
      out.set(id, { x, y: depth * VSPACE });
      leftCursor.v += 1;
      return x;
    }
    const xs: number[] = [];
    for (const k of kids) xs.push(layoutSubtree(k, depth + 1, leftCursor));
    const x = (xs[0] + xs[xs.length - 1]) / 2;
    out.set(id, { x, y: depth * VSPACE });
    return x;
  }

  const cursor = { v: 0 };
  for (const r of roots) {
    layoutSubtree(r.id, 0, cursor);
    cursor.v += 1;
  }
  return out;
}

// ── Position form state ───────────────────────────────────────────────────────
interface PositionForm {
  name: string;
  positionNumber: string;
  departmentId: string;
  reportsToId: string;
  currentHolderName: string;
  vacancy: boolean;
}
const emptyPositionForm = (): PositionForm => ({
  name: '',
  positionNumber: '',
  departmentId: '',
  reportsToId: '',
  currentHolderName: '',
  vacancy: false,
});

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PmoaOrgPage() {
  const [positions, setPositions] = useState<PositionDTO[]>([]);
  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);
  const [assignments, setAssignments] = useState<AssignmentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [buildErr, setBuildErr] = useState<string | null>(null);
  const [globalClarifications, setGlobalClarifications] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [positionForm, setPositionForm] = useState<PositionForm>(emptyPositionForm());
  const [deptName, setDeptName] = useState('');
  const [deptParentId, setDeptParentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const exportRows = useMemo(() => {
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));
    return positions.map((p) => {
      const acting = assignments.find((a) => a.positionId === p.id && a.kind === 'acting');
      const split = assignments.find((a) => a.positionId === p.id && a.kind === 'split');
      return {
        positionNumber: p.positionNumber || '',
        name: p.name,
        department: p.departmentId ? deptMap.get(p.departmentId) || '' : '',
        holder: p.vacancy ? '(vacant)' : (p.currentHolderName || ''),
        reportsTo: p.reportsToId ? positions.find((x) => x.id === p.reportsToId)?.name || '' : '',
        spanOfControl: p.spanOfControl,
        actingHolder: acting?.personName || '',
        splitAssignment: split ? 'yes' : '',
        linkedJD: p.linkedJdId ? `/jd/${p.linkedJdId}` : '',
      };
    });
  }, [positions, departments, assignments]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pmoa/org-graph');
      if (res.ok) {
        const data = await res.json();
        setPositions(data.positions || []);
        setDepartments(data.departments || []);
        setAssignments(data.assignments || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function buildOrg() {
    setBuilding(true); setBuildErr(null); setGlobalClarifications([]);
    try {
      const res = await fetch('/api/pmoa/build-org', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setBuildErr(data.error || `Build failed (${res.status})`);
      } else {
        setGlobalClarifications(data.globalClarifications || []);
        await load();
      }
    } finally {
      setBuilding(false);
    }
  }

  // Open modal for adding a position, optionally pre-filling reportsToId
  function openAddPosition(defaultReportsToId?: string) {
    const form = emptyPositionForm();
    if (defaultReportsToId) form.reportsToId = defaultReportsToId;
    setPositionForm(form);
    setSaveErr(null);
    setModalMode('add-position');
  }

  function openEditPosition(p: PositionDTO) {
    setPositionForm({
      name: p.name,
      positionNumber: p.positionNumber || '',
      departmentId: p.departmentId || '',
      reportsToId: p.reportsToId || '',
      currentHolderName: p.currentHolderName || '',
      vacancy: p.vacancy,
    });
    setSaveErr(null);
    setModalMode('edit-position');
  }

  function openAddDepartment() {
    setDeptName('');
    setDeptParentId('');
    setSaveErr(null);
    setModalMode('add-department');
  }

  async function savePosition() {
    if (!positionForm.name.trim()) { setSaveErr('Position name is required'); return; }
    setSaving(true); setSaveErr(null);
    try {
      const body = {
        name: positionForm.name.trim(),
        positionNumber: positionForm.positionNumber.trim() || null,
        departmentId: positionForm.departmentId || null,
        reportsToId: positionForm.reportsToId || null,
        currentHolderName: positionForm.currentHolderName.trim() || null,
        vacancy: positionForm.vacancy,
      };

      let res: Response;
      if (modalMode === 'edit-position' && selectedId) {
        res = await fetch(`/api/pmoa/positions/${selectedId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } else {
        res = await fetch('/api/pmoa/positions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }

      const data = await res.json();
      if (!res.ok) { setSaveErr(data.error || 'Save failed'); return; }
      setModalMode(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deletePosition(id: string) {
    if (!confirm('Delete this position? Its direct reports will become top-level nodes.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/pmoa/positions/${id}`, { method: 'DELETE' });
      if (res.ok) { setSelectedId(null); await load(); }
    } finally {
      setDeleting(false);
    }
  }

  async function saveDepartment() {
    if (!deptName.trim()) { setSaveErr('Department name is required'); return; }
    setSaving(true); setSaveErr(null);
    try {
      const res = await fetch('/api/pmoa/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deptName.trim(), parentId: deptParentId || null }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveErr(data.error || 'Save failed'); return; }
      setModalMode(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  const filteredPositions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return positions;
    return positions.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.currentHolderName || '').toLowerCase().includes(q) ||
      (p.positionNumber || '').toLowerCase().includes(q),
    );
  }, [positions, search]);

  const layoutPositions = useMemo(() => layoutTree(positions), [positions]);

  const nodes: Node[] = useMemo(() => {
    return positions.map((p) => {
      const pos = layoutPositions.get(p.id) || { x: 0, y: 0 };
      const matchedSearch = filteredPositions.includes(p);
      const acting = assignments.find((a) => a.positionId === p.id && a.kind === 'acting');
      const split = assignments.find((a) => a.positionId === p.id && a.kind === 'split');
      const dimmed = !!search && !matchedSearch;
      return {
        id: p.id,
        position: pos,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: { label: <NodeBox p={p} acting={acting?.personName} split={!!split} dimmed={dimmed} /> },
        type: 'default',
        style: { background: 'transparent', border: 'none', padding: 0, width: 200 },
      } satisfies Node;
    });
  }, [positions, layoutPositions, assignments, filteredPositions, search]);

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    for (const p of positions) {
      if (p.reportsToId) {
        out.push({
          id: `e-${p.reportsToId}-${p.id}`,
          source: p.reportsToId,
          target: p.id,
          type: 'smoothstep',
          style: { stroke: '#8A7560', strokeWidth: 1.4 },
        });
      }
    }
    for (const a of assignments) {
      if (a.kind === 'split' && Array.isArray(a.splitAllocations)) {
        const allocs = a.splitAllocations as Array<{ positionName?: string; pct?: number }>;
        for (const alloc of allocs) {
          const other = positions.find((p) => p.name === alloc.positionName);
          if (other && other.id !== a.positionId) {
            const id = `split-${a.positionId}-${other.id}`;
            if (!out.find((e) => e.id === id || e.id === `split-${other.id}-${a.positionId}`)) {
              out.push({
                id,
                source: a.positionId,
                target: other.id,
                animated: false,
                style: { stroke: '#C0350A', strokeDasharray: '4 3' },
                label: alloc.pct ? `${alloc.pct}%` : 'split',
                labelStyle: { fontSize: 9, fill: '#C0350A' },
              });
            }
          }
        }
      }
    }
    return out;
  }, [positions, assignments]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedId(node.id);
  }, []);

  const selected = selectedId ? positions.find((p) => p.id === selectedId) ?? null : null;
  const selectedDept = selected?.departmentId ? departments.find((d) => d.id === selected.departmentId) : null;
  const selectedAssignments = selectedId ? assignments.filter((a) => a.positionId === selectedId) : [];

  return (
    <div className="flex h-full flex-1 flex-col bg-[#FAF7F2]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-border-default bg-white px-6 py-3">
        <div>
          <h1 className="font-display text-lg font-semibold text-text-primary">Org map</h1>
          <p className="text-[11px] text-text-muted">
            {positions.length === 0
              ? 'No positions yet — add manually or run "Build org from documents".'
              : `${positions.length} positions · ${departments.length} departments · ${assignments.length} assignments`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search positions…"
            className="w-44 rounded-md border border-border-default bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand-gold" />
          <button onClick={() => openAddDepartment()}
            className="rounded-md border border-border-default bg-white px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-page">
            + Department
          </button>
          <button onClick={() => openAddPosition()}
            className="rounded-md border border-brand-gold bg-amber-50 px-3 py-1.5 text-xs font-medium text-brand-gold hover:bg-amber-100">
            + Position
          </button>
          <ExportMenu
            canvasRef={canvasRef}
            data={{
              title: 'Org map · positions',
              subtitle: `${positions.length} positions · ${departments.length} departments · ${assignments.length} assignments`,
              rows: exportRows,
              columns: [
                { key: 'positionNumber', label: 'Position #', width: 14 },
                { key: 'name', label: 'Position', width: 32 },
                { key: 'department', label: 'Department', width: 22 },
                { key: 'holder', label: 'Holder', width: 24 },
                { key: 'reportsTo', label: 'Reports to', width: 28 },
                { key: 'spanOfControl', label: 'Span', width: 8 },
                { key: 'actingHolder', label: 'Acting', width: 18 },
                { key: 'splitAssignment', label: 'Split', width: 8 },
                { key: 'linkedJD', label: 'Linked JD', width: 26 },
              ],
            }}
            fileName="org-map"
            initialPageFormat="A3"
            initialOrientation="landscape"
          />
          <button onClick={buildOrg} disabled={building}
            className="rounded-md bg-brand-gold px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
            {building ? 'Building…' : '↻ Build from documents'}
          </button>
          <Link href="/pmoa" className="rounded border border-border-default bg-white px-3 py-1.5 text-[11px] text-text-primary">
            ← PMOA
          </Link>
        </div>
      </div>

      {buildErr && (
        <div className="mx-6 mt-3 rounded border border-danger bg-danger-bg px-3 py-2 text-[11px] text-danger">{buildErr}</div>
      )}
      {globalClarifications.length > 0 && (
        <div className="mx-6 mt-3 rounded border border-warning bg-warning-bg px-3 py-2 text-[11px] text-warning">
          <strong>Open questions from extraction:</strong>
          <ul className="mt-1 list-disc pl-4">
            {globalClarifications.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}

      {/* Canvas + side panel */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex-1" ref={canvasRef}>
          {loading ? (
            <div className="flex h-full items-center justify-center text-[13px] text-text-muted">Loading…</div>
          ) : positions.length === 0 ? (
            <div className="flex h-full items-center justify-center p-12">
              <div className="max-w-[460px] rounded-xl border border-dashed border-border-default bg-white p-8 text-center">
                <div className="mb-3 text-3xl opacity-30">⌬</div>
                <div className="font-display text-lg text-text-primary">No org graph yet</div>
                <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
                  Add positions manually with <strong>+ Position</strong>, or upload HR documents on the{' '}
                  <Link href="/pmoa" className="text-brand-gold underline">PMOA dashboard</Link> and click <strong>Build from documents</strong>.
                </p>
                <button onClick={() => openAddPosition()}
                  className="mt-5 rounded-md bg-brand-gold px-4 py-2 text-xs font-medium text-white">
                  + Add first position
                </button>
              </div>
            </div>
          ) : (
            <ReactFlow nodes={nodes} edges={edges} onNodeClick={onNodeClick}
              fitView fitViewOptions={{ padding: 0.2 }}
              minZoom={0.1} maxZoom={2}
              proOptions={{ hideAttribution: true }}>
              <Background color="#E5DBC8" gap={24} />
              <Controls position="bottom-right" />
              <MiniMap position="top-right" pannable zoomable
                nodeColor={(n) => {
                  const p = positions.find((x) => x.id === n.id);
                  if (!p) return '#ddd';
                  if (p.vacancy) return '#FCD34D';
                  return '#8A7560';
                }} />
            </ReactFlow>
          )}
        </div>

        {/* Side panel — position detail + edit */}
        {selected && (
          <aside className="w-[340px] shrink-0 overflow-y-auto border-l border-border-default bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Position</div>
                <div className="font-display text-base font-semibold text-text-primary">{selected.name}</div>
                {selected.positionNumber && (
                  <div className="text-[11px] text-text-muted">#{selected.positionNumber}</div>
                )}
              </div>
              <button onClick={() => setSelectedId(null)} className="text-lg leading-none text-text-muted">×</button>
            </div>

            <div className="mt-3 space-y-2 text-[12px]">
              <Row label="Department" value={selectedDept?.name || '—'} />
              <Row label="Holder" value={selected.vacancy ? <em className="text-warning">vacant</em> : (selected.currentHolderName || '—')} />
              <Row label="Reports to" value={selected.reportsToId ? (positions.find((p) => p.id === selected.reportsToId)?.name || '—') : '—'} />
              <Row label="Span of control" value={String(selected.spanOfControl)} />
              <Row label="Linked JD" value={selected.linkedJdId
                ? <Link href={`/jd/${selected.linkedJdId}`} className="text-brand-gold underline">open →</Link>
                : <em className="text-text-muted">none</em>} />
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => openEditPosition(selected)}
                className="flex-1 rounded border border-border-default bg-surface-page px-3 py-1.5 text-[11px] font-medium text-text-primary hover:bg-gray-100">
                Edit
              </button>
              <button
                onClick={() => openAddPosition(selected.id)}
                className="flex-1 rounded border border-brand-gold bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-brand-gold hover:bg-amber-100">
                + Direct report
              </button>
              <button
                onClick={() => deletePosition(selected.id)}
                disabled={deleting}
                className="w-full rounded border border-danger bg-danger-bg px-3 py-1.5 text-[11px] font-medium text-danger hover:opacity-80 disabled:opacity-40">
                {deleting ? 'Deleting…' : 'Delete position'}
              </button>
            </div>

            {selectedAssignments.length > 0 && (
              <div className="mt-4">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted">Assignments</div>
                <ul className="space-y-1.5">
                  {selectedAssignments.map((a) => (
                    <li key={a.id} className="rounded border border-border-default bg-surface-page p-2 text-[11px]">
                      <div className="font-semibold">{a.personName}</div>
                      <div className="text-text-muted">
                        {a.kind === 'permanent' && 'permanent'}
                        {a.kind === 'acting' && '⚠ acting (temporary)'}
                        {a.kind === 'split' && '↔ split assignment'}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selected.sourceDocumentIds.length > 0 && (
              <div className="mt-4">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted">Source</div>
                <ul className="space-y-1 text-[11px] text-text-muted">
                  {selected.sourceDocumentIds.map((id) => (
                    <li key={id} className="font-mono truncate">{id}</li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) setModalMode(null); }}>
          <div className="w-full max-w-md rounded-xl border border-border-default bg-white p-6 shadow-xl">
            {(modalMode === 'add-position' || modalMode === 'edit-position') && (
              <PositionModal
                mode={modalMode}
                form={positionForm}
                onChange={setPositionForm}
                positions={positions.filter((p) => p.id !== selectedId)}
                departments={departments}
                saving={saving}
                error={saveErr}
                onSave={savePosition}
                onClose={() => setModalMode(null)}
              />
            )}
            {modalMode === 'add-department' && (
              <DeptModal
                name={deptName}
                parentId={deptParentId}
                departments={departments}
                saving={saving}
                error={saveErr}
                onName={setDeptName}
                onParent={setDeptParentId}
                onSave={saveDepartment}
                onClose={() => setModalMode(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Position Modal ────────────────────────────────────────────────────────────
function PositionModal({
  mode, form, onChange, positions, departments, saving, error, onSave, onClose,
}: {
  mode: 'add-position' | 'edit-position';
  form: PositionForm;
  onChange: (f: PositionForm) => void;
  positions: PositionDTO[];
  departments: DepartmentDTO[];
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const set = (k: keyof PositionForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value });

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-text-primary">
          {mode === 'add-position' ? 'Add position' : 'Edit position'}
        </h2>
        <button onClick={onClose} className="text-lg leading-none text-text-muted">×</button>
      </div>

      <div className="space-y-3">
        <FormField label="Position title *">
          <input autoFocus value={form.name} onChange={set('name')} placeholder="e.g. Head of Finance"
            className="field" />
        </FormField>

        <FormField label="Position number">
          <input value={form.positionNumber} onChange={set('positionNumber')} placeholder="e.g. FIN-001"
            className="field" />
        </FormField>

        <FormField label="Department">
          <select value={form.departmentId} onChange={set('departmentId')} className="field">
            <option value="">— none —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </FormField>

        <FormField label="Reports to">
          <select value={form.reportsToId} onChange={set('reportsToId')} className="field">
            <option value="">— top level —</option>
            {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormField>

        <FormField label="Current holder name">
          <input value={form.currentHolderName} onChange={set('currentHolderName')} placeholder="e.g. Anna Kowalska"
            className="field" />
        </FormField>

        <label className="flex items-center gap-2 text-[12px] text-text-primary cursor-pointer">
          <input type="checkbox" checked={form.vacancy} onChange={(e) => onChange({ ...form, vacancy: e.target.checked })}
            className="rounded border-border-default" />
          Mark as vacant
        </label>
      </div>

      {error && <p className="mt-3 text-[11px] text-danger">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded border border-border-default px-4 py-2 text-[12px] text-text-primary">
          Cancel
        </button>
        <button onClick={onSave} disabled={saving}
          className="rounded bg-brand-gold px-4 py-2 text-[12px] font-medium text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Save position'}
        </button>
      </div>

      <style>{`.field { width: 100%; border-radius: 6px; border: 1px solid #D6C9B8; padding: 6px 10px; font-size: 12px; outline: none; } .field:focus { border-color: #8A7560; }`}</style>
    </>
  );
}

// ── Department Modal ──────────────────────────────────────────────────────────
function DeptModal({
  name, parentId, departments, saving, error, onName, onParent, onSave, onClose,
}: {
  name: string;
  parentId: string;
  departments: DepartmentDTO[];
  saving: boolean;
  error: string | null;
  onName: (v: string) => void;
  onParent: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-text-primary">Add department</h2>
        <button onClick={onClose} className="text-lg leading-none text-text-muted">×</button>
      </div>

      <div className="space-y-3">
        <FormField label="Department name *">
          <input autoFocus value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. Finance"
            className="field" />
        </FormField>

        <FormField label="Parent department">
          <select value={parentId} onChange={(e) => onParent(e.target.value)} className="field">
            <option value="">— top level —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </FormField>
      </div>

      {error && <p className="mt-3 text-[11px] text-danger">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded border border-border-default px-4 py-2 text-[12px] text-text-primary">
          Cancel
        </button>
        <button onClick={onSave} disabled={saving}
          className="rounded bg-brand-gold px-4 py-2 text-[12px] font-medium text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Save department'}
        </button>
      </div>

      <style>{`.field { width: 100%; border-radius: 6px; border: 1px solid #D6C9B8; padding: 6px 10px; font-size: 12px; outline: none; } .field:focus { border-color: #8A7560; }`}</style>
    </>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</label>
      {children}
    </div>
  );
}

function NodeBox({ p, acting, split, dimmed }: {
  p: PositionDTO;
  acting?: string;
  split?: boolean;
  dimmed: boolean;
}) {
  return (
    <div className={`rounded-lg border-2 bg-white px-3 py-2 text-left shadow-sm transition-opacity ${dimmed ? 'opacity-25' : ''} ${p.vacancy ? 'border-warning' : 'border-border-default'}`}>
      <div className="text-[12px] font-semibold leading-tight text-text-primary">{p.name}</div>
      {p.positionNumber && <div className="mt-0.5 text-[9px] font-mono text-text-muted">#{p.positionNumber}</div>}
      <div className="mt-1 text-[10px] text-text-muted">
        {p.vacancy ? <em className="text-warning">vacant</em> : (p.currentHolderName || '—')}
      </div>
      {acting && <div className="mt-0.5 text-[9px] text-warning">⚠ acting: {acting}</div>}
      {split && <div className="mt-0.5 text-[9px] text-[#C0350A]">↔ split</div>}
      {p.spanOfControl > 0 && (
        <div className="absolute right-1 top-1 rounded bg-text-primary px-1 text-[9px] text-white">
          {p.spanOfControl}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-default pb-1.5">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="text-right text-[12px]">{value}</div>
    </div>
  );
}
