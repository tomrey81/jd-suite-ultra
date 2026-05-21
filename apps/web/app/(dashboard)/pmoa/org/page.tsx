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
import type { ScrapedPage, CompanyIntel } from '@/lib/pmoa/web-scraper';

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

// Lay out a tree top-down. Same layer = same y; siblings spread horizontally.
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
  const VSPACE = 130;

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
    cursor.v += 1; // gap between forests
  }
  return out;
}

// ── Web Intel Modal ──────────────────────────────────────────────────────────

function WebIntelModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [intel, setIntel] = useState<CompanyIntel | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());

  async function handleFetch() {
    setFetching(true); setErr(null); setIntel(null); setSavedCount(null); setSelectedPages(new Set());
    try {
      const res = await fetch('/api/pmoa/fetch-web-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl, companyName, isPublicCompany: isPublic }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Fetch failed'); return; }
      setIntel(data.intel as CompanyIntel);
      // Pre-select all pages
      const all = new Set<string>();
      for (const p of [...(data.intel.orgPages || []), ...(data.intel.irPages || []), ...(data.intel.newsPages || [])]) {
        all.add(p.url);
      }
      setSelectedPages(all);
    } finally {
      setFetching(false);
    }
  }

  async function handleSave() {
    if (!intel) return;
    const allPages: ScrapedPage[] = [
      ...(intel.orgPages || []),
      ...(intel.irPages || []),
      ...(intel.newsPages || []),
    ].filter((p) => selectedPages.has(p.url));

    if (allPages.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch('/api/pmoa/save-web-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: allPages }),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedCount(data.saved);
        onSaved();
      } else {
        setErr(data.error || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  }

  function togglePage(url: string) {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  }

  const allPages: ScrapedPage[] = intel
    ? [...(intel.orgPages || []), ...(intel.irPages || []), ...(intel.newsPages || [])]
    : [];

  const categoryLabel = (c: ScrapedPage['category']) =>
    c === 'org' ? 'Org / Leadership' : c === 'ir' ? 'Investor Relations' : 'News / Press';

  const categoryColor = (c: ScrapedPage['category']) =>
    c === 'org' ? '#8A7560' : c === 'ir' ? '#3B6EA5' : '#2E6B37';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="relative flex w-full max-w-2xl flex-col gap-4 rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-text-primary">Fetch company web intelligence</h2>
            <p className="mt-0.5 text-[11px] text-text-muted">
              Scrapes leadership, investor relations, and news pages. Saved pages become PMOA documents for org building.
            </p>
          </div>
          <button onClick={onClose} className="text-lg text-text-muted">×</button>
        </div>

        {/* Inputs */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-text-muted">Company website URL</label>
            <input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded border border-border-default bg-surface-page px-3 py-2 text-[13px] outline-none focus:border-brand-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-text-muted">Company name (optional)</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="ACME Corp"
              className="w-full rounded border border-border-default bg-surface-page px-3 py-2 text-[13px] outline-none focus:border-brand-gold"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-text-primary">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="accent-brand-gold"
            />
            Publicly traded company — also check investor relations pages
          </label>

          <button
            onClick={handleFetch}
            disabled={fetching || !websiteUrl.trim()}
            className="rounded-md bg-brand-gold px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {fetching ? 'Scraping…' : 'Fetch intelligence'}
          </button>
        </div>

        {err && (
          <div className="rounded border border-danger bg-danger-bg px-3 py-2 text-[11px] text-danger">{err}</div>
        )}

        {/* Results */}
        {intel && allPages.length === 0 && (
          <p className="text-[12px] text-text-muted">No pages found. The site may block scrapers, or the URL paths differ from common patterns.</p>
        )}

        {allPages.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
              {allPages.length} pages found — select which to save as PMOA documents
            </div>

            {(['org', 'ir', 'news'] as const).map((cat) => {
              const catPages = allPages.filter((p) => p.category === cat);
              if (catPages.length === 0) return null;
              return (
                <div key={cat}>
                  <div
                    className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: categoryColor(cat) }}
                  >
                    {categoryLabel(cat)}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {catPages.map((p) => (
                      <label
                        key={p.url}
                        className="flex cursor-pointer items-start gap-2.5 rounded border border-border-default p-2.5 hover:bg-surface-page"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPages.has(p.url)}
                          onChange={() => togglePage(p.url)}
                          className="mt-0.5 accent-brand-gold"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-medium text-text-primary">{p.title || p.url}</div>
                          <div className="truncate text-[10px] text-text-muted">{p.url}</div>
                          <div className="mt-1 text-[10px] text-text-muted line-clamp-2">
                            {p.text.slice(0, 200)}…
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            {savedCount === null ? (
              <button
                onClick={handleSave}
                disabled={saving || selectedPages.size === 0}
                className="rounded-md bg-text-primary px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : `Save ${selectedPages.size} page(s) as PMOA documents`}
              </button>
            ) : (
              <div className="rounded border border-green-300 bg-green-50 px-3 py-2 text-[12px] text-green-700">
                ✓ {savedCount} document(s) saved to PMOA. You can now run &quot;Re-build from documents&quot; to include this data.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

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
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showWebIntel, setShowWebIntel] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Build a flat row set for tabular export
  const exportRows = useMemo(() => {
    const deptName = new Map(departments.map((d) => [d.id, d.name]));
    return positions.map((p) => {
      const acting = assignments.find((a) => a.positionId === p.id && a.kind === 'acting');
      const split = assignments.find((a) => a.positionId === p.id && a.kind === 'split');
      return {
        positionNumber: p.positionNumber || '',
        name: p.name,
        department: p.departmentId ? deptName.get(p.departmentId) || '' : '',
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

  async function clearOrg() {
    setClearing(true); setConfirmClear(false);
    try {
      await fetch('/api/pmoa/clear-org', { method: 'DELETE' });
      setPositions([]); setDepartments([]); setAssignments([]);
      setSelectedId(null); setGlobalClarifications([]);
    } finally {
      setClearing(false);
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
        style: {
          background: 'transparent',
          border: 'none',
          padding: 0,
          width: 200,
        },
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
    // Split assignments → dotted edges between paired positions
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
              ? 'No positions yet — run "Build org from documents" once you\'ve tagged HRIS rosters / org charts.'
              : `${positions.length} positions · ${departments.length} departments · ${assignments.length} assignments`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search positions…"
            className="w-48 rounded-md border border-border-default bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand-gold"
          />
          <button
            onClick={() => setShowWebIntel(true)}
            className="rounded border border-border-default bg-white px-3 py-1.5 text-[11px] text-text-primary hover:bg-surface-page"
            title="Fetch leadership, investor relations, and news from the company website"
          >
            ⊕ Fetch web intel
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
          <button
            onClick={buildOrg}
            disabled={building}
            className="rounded-md bg-brand-gold px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {building ? 'Building…' : positions.length === 0 ? '↻ Build org from documents' : '↻ Re-build from documents'}
          </button>
          {positions.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-danger">Clear all org data?</span>
                <button
                  onClick={clearOrg}
                  disabled={clearing}
                  className="rounded border border-danger px-2 py-1 text-[11px] text-danger hover:bg-danger-bg disabled:opacity-50"
                >
                  {clearing ? '…' : 'Yes, clear'}
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="rounded border border-border-default px-2 py-1 text-[11px] text-text-muted hover:bg-surface-page"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="rounded border border-border-default bg-white px-3 py-1.5 text-[11px] text-text-muted hover:border-danger hover:text-danger"
                title="Remove all org structure data for this project"
              >
                ✕ Clear data
              </button>
            )
          )}
          <Link href="/pmoa" className="rounded border border-border-default bg-white px-3 py-1.5 text-[11px] text-text-primary">
            ← PMOA
          </Link>
        </div>
      </div>

      {buildErr && (
        <div className="mx-6 mt-3 rounded border border-danger bg-danger-bg px-3 py-2 text-[11px] text-danger">
          {buildErr}
        </div>
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
                  Upload HR documents on the{' '}
                  <Link href="/pmoa" className="text-brand-gold underline">PMOA dashboard</Link>,
                  tag them as &quot;recent&quot; or &quot;partially valid&quot;, then click{' '}
                  <strong>Build org from documents</strong>.
                  Claude extracts departments, positions, reporting lines, and acting/split assignments.
                </p>
                <p className="mt-3 text-[11px] text-text-muted">
                  Tip: click{' '}
                  <button
                    onClick={() => setShowWebIntel(true)}
                    className="text-brand-gold underline"
                  >
                    Fetch web intel
                  </button>{' '}
                  to auto-scrape leadership and news from the company website.
                </p>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodeClick={onNodeClick}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#E5DBC8" gap={24} />
              <Controls position="bottom-right" />
              <MiniMap
                position="top-right"
                pannable
                zoomable
                nodeColor={(n) => {
                  const p = positions.find((x) => x.id === n.id);
                  if (!p) return '#ddd';
                  if (p.vacancy) return '#FCD34D';
                  return '#8A7560';
                }}
              />
            </ReactFlow>
          )}
        </div>

        {/* Position detail side panel */}
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
              <button onClick={() => setSelectedId(null)} className="text-base text-text-muted">×</button>
            </div>
            <div className="mt-3 space-y-2 text-[12px]">
              <Row label="Department" value={selectedDept?.name || '—'} />
              <Row
                label="Holder"
                value={selected.vacancy
                  ? <em className="text-warning">vacant</em>
                  : (selected.currentHolderName || '—')}
              />
              <Row label="Span of control" value={String(selected.spanOfControl)} />
              <Row
                label="Linked JD"
                value={selected.linkedJdId
                  ? <Link href={`/jd/${selected.linkedJdId}`} className="text-brand-gold underline">open →</Link>
                  : <em className="text-text-muted">none</em>}
              />
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
                <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted">Source documents</div>
                <ul className="space-y-1 text-[11px] text-text-muted">
                  {selected.sourceDocumentIds.map((id) => (
                    <li key={id} className="font-mono">{id.slice(0, 8)}…</li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Web Intel Modal */}
      {showWebIntel && (
        <WebIntelModal
          onClose={() => setShowWebIntel(false)}
          onSaved={() => {/* docs saved — user can now rebuild */}}
        />
      )}
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
      {acting && (
        <div className="mt-0.5 text-[9px] text-warning">
          ⚠ acting: {acting}
        </div>
      )}
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
