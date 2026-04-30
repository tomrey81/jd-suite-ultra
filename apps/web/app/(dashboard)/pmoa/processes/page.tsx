'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface ProcRow {
  id: string;
  name: string;
  description: string | null;
  validityFlag: 'recent' | 'partially_valid' | 'outdated';
  sourceDocumentIds: string[];
  stepCount: number;
  updatedAt: string;
}

export default function PmoaProcessesPage() {
  const [processes, setProcesses] = useState<ProcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [buildErr, setBuildErr] = useState<string | null>(null);
  const [globalClarifications, setGlobalClarifications] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pmoa/processes');
      if (res.ok) {
        const data = await res.json();
        setProcesses(data.processes || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function buildProcesses() {
    setBuilding(true); setBuildErr(null); setGlobalClarifications([]);
    try {
      const res = await fetch('/api/pmoa/build-processes', { method: 'POST' });
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

  async function deleteProc(id: string) {
    if (!confirm('Delete this process and its steps?')) return;
    const res = await fetch(`/api/pmoa/processes/${id}`, { method: 'DELETE' });
    if (res.ok) setProcesses(processes.filter((p) => p.id !== id));
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Processes</h1>
            <p className="mt-1 text-[13px] text-text-secondary">
              BPMN-style process maps inferred from your tagged SOPs and regulations. Click a process to open the editable canvas.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={buildProcesses} disabled={building}
              className="rounded-md bg-brand-gold px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
              {building ? 'Extracting…' : processes.length === 0 ? '↻ Extract from documents' : '↻ Re-extract from documents'}
            </button>
            <Link href="/pmoa" className="rounded border border-border-default bg-white px-3 py-1.5 text-[11px] text-text-primary">
              ← PMOA
            </Link>
          </div>
        </div>

        {buildErr && (
          <div className="mb-3 rounded border border-danger bg-danger-bg p-3 text-[11px] text-danger">{buildErr}</div>
        )}
        {globalClarifications.length > 0 && (
          <div className="mb-3 rounded border border-warning bg-warning-bg p-3 text-[11px] text-warning">
            <strong>Open questions from extraction:</strong>
            <ul className="mt-1 list-disc pl-4">
              {globalClarifications.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-border-default bg-white p-8 text-center text-[13px] text-text-muted">
            Loading…
          </div>
        ) : processes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-default bg-white p-12 text-center">
            <div className="mb-2 text-3xl opacity-30">⊞</div>
            <div className="font-display text-lg text-text-primary">No processes yet</div>
            <p className="mx-auto mt-1 max-w-[480px] text-[12px] leading-relaxed text-text-muted">
              Tag some SOPs / regulations / process docs on the{' '}
              <Link href="/pmoa" className="text-brand-gold underline">PMOA dashboard</Link>,
              then click <strong>Extract from documents</strong>. Claude will pull out workflow names + steps + actors.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {processes.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border-default bg-white p-4">
                <div className="flex-1">
                  <Link href={`/pmoa/processes/${p.id}`} className="font-display text-[14px] font-semibold text-text-primary hover:text-brand-gold">
                    {p.name}
                  </Link>
                  {p.description && <div className="mt-0.5 text-[11px] text-text-muted">{p.description}</div>}
                  <div className="mt-1 flex gap-3 text-[10px] text-text-muted">
                    <span>{p.stepCount} step{p.stepCount !== 1 ? 's' : ''}</span>
                    <span>· {p.sourceDocumentIds.length} source{p.sourceDocumentIds.length !== 1 ? 's' : ''}</span>
                    <span>· {p.validityFlag}</span>
                  </div>
                </div>
                <Link href={`/pmoa/processes/${p.id}`}
                  className="rounded border border-border-default px-3 py-1 text-[11px] text-text-primary hover:border-brand-gold">
                  Open →
                </Link>
                <button onClick={() => deleteProc(p.id)} className="text-base text-text-muted hover:text-danger">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
