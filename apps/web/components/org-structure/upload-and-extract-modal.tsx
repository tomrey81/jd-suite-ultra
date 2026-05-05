'use client';

/**
 * Upload + extract + side-by-side review modal for org-chart PDFs.
 *
 * Flow:
 *   1. User drops/selects a PDF (or PNG/JPG; image goes through one-page path).
 *   2. Browser renders each page to a 2.0× PNG via pdfjs-dist.
 *   3. Pages are POSTed to /api/org-structure/extract.
 *   4. Modal renders source preview on the left + extracted tree on the right
 *      with confidence badges. User reviews and (TODO next commit) approves.
 *
 * pdfjs-dist runs entirely in the browser — no server canvas dependency.
 */

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { OrgChart, OrgNode } from '@/lib/org-structure/types';

type Phase = 'idle' | 'rendering' | 'extracting' | 'review' | 'error';

interface PageRender {
  pageNumber: number;
  dataB64: string;       // base64 PNG (no prefix) — sent to server
  dataUrl: string;       // data:image/png;base64,... — for <img> preview
  width: number;
  height: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UploadAndExtractModal({ open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [pages, setPages] = useState<PageRender[]>([]);
  const [chart, setChart] = useState<OrgChart | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const reset = () => {
    setPhase('idle'); setError(null); setProgress(''); setPages([]); setChart(null); setActivePage(1); setSelectedNodeId(null);
  };

  const handleFile = useCallback(async (file: File) => {
    reset();
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      setPhase('error');
      setError(`Unsupported file type: ${file.type || 'unknown'}. Use PDF or PNG/JPG.`);
      return;
    }

    try {
      setPhase('rendering');
      setProgress('Reading file…');
      const arrayBuf = await file.arrayBuffer();

      let renders: PageRender[];
      if (isPdf) {
        renders = await renderPdfToImages(arrayBuf, (p, total) => {
          setProgress(`Rendering page ${p}/${total}…`);
        });
      } else {
        // single image — pass through as one page
        const dataUrl = await blobToDataUrl(file);
        const dataB64 = dataUrl.split(',')[1] ?? '';
        const img = await loadImageFromDataUrl(dataUrl);
        renders = [{ pageNumber: 1, dataB64, dataUrl, width: img.width, height: img.height }];
      }

      if (renders.length === 0) {
        setPhase('error');
        setError('No pages rendered.');
        return;
      }
      setPages(renders);

      setPhase('extracting');
      setProgress(`Asking the model to read the structure (${renders.length} page${renders.length === 1 ? '' : 's'})…`);

      const res = await fetch('/api/org-structure/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFile: file.name,
          pages: renders.map((p) => ({ pageNumber: p.pageNumber, dataB64: p.dataB64 })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPhase('error');
        setError(json.error || `Extraction failed (${res.status})`);
        return;
      }
      setChart(json.chart as OrgChart);
      setPhase('review');
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Render failed');
    }
  }, []);

  if (!open) return null;

  const activePageRender = pages.find((p) => p.pageNumber === activePage) || pages[0];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-[92vh] w-[min(1400px,96vw)] flex-col overflow-hidden rounded-xl border border-border-default bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border-default bg-surface-page px-5 py-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">
              Org structure · extract from PDF
            </div>
            <div className="mt-0.5 font-display text-[14px] font-semibold text-text-primary">
              {chart ? chart.name : 'Upload a PDF org chart'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {phase === 'review' && (
              <button
                onClick={reset}
                className="rounded-md border border-border-default bg-white px-3 py-1.5 text-[11px] font-medium text-text-secondary hover:border-brand-gold hover:text-brand-gold"
              >
                Upload another
              </button>
            )}
            <button onClick={onClose} className="rounded-md p-1.5 text-text-muted hover:bg-white" title="Close">
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        {phase === 'idle' && (
          <div className="flex flex-1 items-center justify-center p-12">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              className="w-full max-w-[560px] rounded-xl border-2 border-dashed border-border-default bg-surface-page p-12 text-center"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">Drag &amp; drop</div>
              <div className="mt-2 font-display text-lg text-text-primary">
                Drop an org-chart PDF, or{' '}
                <button onClick={() => fileRef.current?.click()} className="text-brand-gold underline-offset-2 hover:underline">
                  browse
                </button>
              </div>
              <p className="mt-2 text-[11px] text-text-muted">
                PDF, PNG, JPG. The model reads the visual chart, not just the text — connectors, columns, and groupings are preserved.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                className="hidden"
              />
            </div>
          </div>
        )}

        {(phase === 'rendering' || phase === 'extracting') && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
              <p className="mt-3 text-[12px] text-text-secondary">{progress}</p>
              {phase === 'extracting' && (
                <p className="mt-1 text-[10px] text-text-muted">This usually takes 30–90 seconds for a one-page chart.</p>
              )}
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-[560px] rounded-lg border border-danger/30 bg-danger-bg p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-danger">Extraction failed</div>
              <p className="mt-1 text-[12px] text-text-primary">{error}</p>
              <button
                onClick={reset}
                className="mt-3 rounded-md border border-danger/40 bg-white px-3 py-1.5 text-[11px] font-medium text-danger hover:bg-danger/5"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {phase === 'review' && chart && (
          <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {/* Left: source preview */}
            <div className="flex flex-col overflow-hidden border-r border-border-default">
              <div className="flex shrink-0 items-center gap-2 border-b border-border-default bg-surface-page px-4 py-2 text-[10px]">
                <span className="font-bold uppercase tracking-widest text-text-muted">Source</span>
                {pages.length > 1 && (
                  <div className="flex gap-1">
                    {pages.map((p) => (
                      <button
                        key={p.pageNumber}
                        onClick={() => setActivePage(p.pageNumber)}
                        className={cn(
                          'rounded-md border px-2 py-0.5 text-[10px] font-medium',
                          activePage === p.pageNumber
                            ? 'border-brand-gold bg-brand-gold-lighter text-brand-gold'
                            : 'border-border-default bg-white text-text-muted',
                        )}
                      >
                        Page {p.pageNumber}
                      </button>
                    ))}
                  </div>
                )}
                <div className="ml-auto text-text-muted">
                  {chart.companyName} {chart.effectiveDate && `· effective ${chart.effectiveDate}`}
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-[#3A3733] p-4">
                {activePageRender && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={activePageRender.dataUrl}
                    alt={`Source page ${activePageRender.pageNumber}`}
                    className="mx-auto rounded shadow-lg"
                    style={{ maxWidth: '100%' }}
                  />
                )}
              </div>
            </div>

            {/* Right: extracted tree */}
            <div className="flex flex-col overflow-hidden">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-default bg-surface-page px-4 py-2">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="font-bold uppercase tracking-widest text-text-muted">Extracted</span>
                  <span className="text-text-secondary">
                    {chart.nodes.length} nodes · avg confidence{' '}
                    <span className={cn(
                      'font-bold tabular-nums',
                      chart.extractionConfidence >= 0.85 ? 'text-emerald-700' : chart.extractionConfidence >= 0.7 ? 'text-amber-700' : 'text-danger',
                    )}>
                      {Math.round(chart.extractionConfidence * 100)}%
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => downloadJson(chart)}
                    className="rounded-md border border-border-default bg-white px-2.5 py-1 text-[10px] font-medium text-text-secondary hover:border-brand-gold hover:text-brand-gold"
                    title="Download as JSON"
                  >
                    JSON
                  </button>
                  <button
                    disabled
                    title="Persistence is queued for the next iteration"
                    className="rounded-md bg-brand-gold/40 px-3 py-1 text-[10px] font-medium text-white opacity-60"
                  >
                    Approve (soon)
                  </button>
                </div>
              </div>

              {chart.clarifications.length > 0 && (
                <div className="shrink-0 border-b border-border-default bg-amber-50 px-4 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-amber-800">
                    Clarifications from extractor
                  </div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-amber-900">
                    {chart.clarifications.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-3">
                <NodeTree
                  nodes={chart.nodes}
                  selectedId={selectedNodeId}
                  onSelect={setSelectedNodeId}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tree renderer ─────────────────────────────────────────────────────────

function NodeTree({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: OrgNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Build children map
  const childrenByParent = new Map<string | null, OrgNode[]>();
  for (const n of nodes) {
    const list = childrenByParent.get(n.parentId) ?? [];
    list.push(n);
    childrenByParent.set(n.parentId, list);
  }
  const roots = childrenByParent.get(null) || [];

  const renderNode = (node: OrgNode): React.ReactNode => {
    const children = childrenByParent.get(node.id) || [];
    return (
      <div key={node.id} className="ml-3 border-l border-border-default pl-3">
        <button
          onClick={() => onSelect(node.id)}
          className={cn(
            'group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
            selectedId === node.id ? 'bg-brand-gold-lighter' : 'hover:bg-surface-page',
          )}
        >
          <NodeTypeBadge type={node.type} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              {node.code && (
                <span className="font-mono text-[10px] font-bold text-brand-gold">{node.code}</span>
              )}
              <span className="text-[12px] text-text-primary">{node.name}</span>
            </div>
            {node.evidence && (
              <div className="mt-0.5 text-[10px] italic text-text-muted">{node.evidence}</div>
            )}
          </div>
          <ConfidenceBadge confidence={node.confidence} />
          {node.reportingLine === 'DOTTED' && (
            <span className="rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold text-amber-700">
              dotted
            </span>
          )}
        </button>
        {children.length > 0 && <div className="mt-0.5">{children.map(renderNode)}</div>}
      </div>
    );
  };

  return (
    <div className="text-[12px]">
      {roots.length === 0 ? (
        <div className="rounded border border-dashed border-border-default p-4 text-center text-[11px] text-text-muted">
          No root node detected. The extractor likely confused multiple top-level boxes.
        </div>
      ) : (
        roots.map(renderNode)
      )}
    </div>
  );
}

const TYPE_BADGE: Record<OrgNode['type'], { label: string; cls: string }> = {
  ROOT:           { label: 'ROOT',  cls: 'bg-stone-100 text-stone-700' },
  PRESIDENT:      { label: 'CEO',   cls: 'bg-purple-100 text-purple-700' },
  VICE_PRESIDENT: { label: 'VP',    cls: 'bg-indigo-100 text-indigo-700' },
  BOARD_MEMBER:   { label: 'BOARD', cls: 'bg-indigo-100 text-indigo-700' },
  PION:           { label: 'PION',  cls: 'bg-blue-100 text-blue-700' },
  DEPARTMENT:     { label: 'DEPT',  cls: 'bg-emerald-100 text-emerald-700' },
  OFFICE:         { label: 'BIURO', cls: 'bg-cyan-100 text-cyan-700' },
  BRANCH:         { label: 'ODDZ.', cls: 'bg-amber-100 text-amber-700' },
  TEAM:           { label: 'TEAM',  cls: 'bg-stone-100 text-stone-600' },
  UNKNOWN:        { label: '?',     cls: 'bg-stone-100 text-stone-500' },
};

function NodeTypeBadge({ type }: { type: OrgNode['type'] }) {
  const b = TYPE_BADGE[type];
  return (
    <span className={cn('mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wider', b.cls)}>
      {b.label}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const cls =
    confidence >= 0.85
      ? 'bg-emerald-100 text-emerald-700'
      : confidence >= 0.7
      ? 'bg-amber-100 text-amber-700'
      : 'bg-danger-bg text-danger';
  return (
    <span
      className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums', cls)}
      title="Confidence in this node's parent link"
    >
      {pct}%
    </span>
  );
}

// ─── PDF rendering ─────────────────────────────────────────────────────────

async function renderPdfToImages(
  arrayBuf: ArrayBuffer,
  onProgress: (page: number, total: number) => void,
): Promise<PageRender[]> {
  // Dynamic import keeps pdfjs out of the SSR bundle
  const pdfjs = await import('pdfjs-dist');
  // Use CDN-hosted worker — avoids webpack trying to resolve ?url query syntax
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuf) });
  const pdf = await loadingTask.promise;
  const total = Math.min(pdf.numPages, 8); // hard cap for now (vision token budget)
  const out: PageRender[] = [];

  for (let i = 1; i <= total; i++) {
    onProgress(i, total);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    await page.render({ canvasContext: ctx, viewport, canvas } as Parameters<typeof page.render>[0]).promise;
    const dataUrl = canvas.toDataURL('image/png');
    const dataB64 = dataUrl.split(',')[1] ?? '';
    out.push({
      pageNumber: i,
      dataB64,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
    });
  }
  return out;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function loadImageFromDataUrl(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve({ width: i.naturalWidth, height: i.naturalHeight });
    i.onerror = () => reject(new Error('Failed to load image'));
    i.src = dataUrl;
  });
}

function downloadJson(chart: OrgChart) {
  const blob = new Blob([JSON.stringify(chart, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(chart.companyName || 'org-chart').replace(/[^a-z0-9-]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
