'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface DocRow {
  id: string;
  name: string;
  mime: string | null;
  sizeBytes: number | null;
  pages: number | null;
  validityFlag: 'recent' | 'partially_valid' | 'outdated';
  validityNote: string | null;
  documentOwnerId: string | null;
  parseStatus: 'queued' | 'parsing' | 'done' | 'failed';
  parseError: string | null;
  createdAt: string;
}

const VALIDITY_PILL: Record<DocRow['validityFlag'], string> = {
  recent: 'bg-success-bg text-success border-success',
  partially_valid: 'bg-warning-bg text-warning border-warning',
  outdated: 'bg-danger-bg text-danger border-danger',
};

const VALIDITY_LABEL: Record<DocRow['validityFlag'], string> = {
  recent: 'Recent & valid',
  partially_valid: 'Partially valid',
  outdated: 'Outdated',
};

const inputCls =
  'rounded-md border border-border-default bg-white px-3 py-[7px] font-body text-xs text-text-primary outline-none';

export default function PmoaDashboardPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [tagModal, setTagModal] = useState<DocRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/pmoa/documents');
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true); setUploadError(null);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append('files', f);
      const res = await fetch('/api/pmoa/documents', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setUploadError(data.error || `Upload failed (${res.status})`);
      } else {
        await load();
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function tagDoc(id: string, patch: { validityFlag?: string; validityNote?: string }) {
    const res = await fetch(`/api/pmoa/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setDocs(docs.map((d) => d.id === id ? { ...d, ...patch } as DocRow : d));
    }
  }

  async function deleteDoc(id: string) {
    if (!confirm('Delete this document? Cannot be undone.')) return;
    const res = await fetch(`/api/pmoa/documents/${id}`, { method: 'DELETE' });
    if (res.ok) setDocs(docs.filter((d) => d.id !== id));
  }

  const counts = {
    total: docs.length,
    recent: docs.filter((d) => d.validityFlag === 'recent').length,
    partial: docs.filter((d) => d.validityFlag === 'partially_valid').length,
    outdated: docs.filter((d) => d.validityFlag === 'outdated').length,
    parsing: docs.filter((d) => d.parseStatus === 'parsing' || d.parseStatus === 'queued').length,
    failed: docs.filter((d) => d.parseStatus === 'failed').length,
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Process Mapping & Org Architecture</h1>
            <p className="mt-1 text-[13px] text-text-secondary">
              Upload regulations, process maps, JDs, HRIS exports, org charts. PMOA parses them, lets you tag what's still valid, and builds the unified org + process model.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/pmoa/org"
              className="rounded border border-border-default bg-white px-3 py-1.5 text-[11px] font-medium text-text-primary hover:border-brand-gold">
              Org map →
            </Link>
            <Link href="/pmoa/processes"
              className="rounded border border-border-default bg-white px-3 py-1.5 text-[11px] font-medium text-text-primary hover:border-brand-gold">
              Processes →
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {[
            { label: 'Documents', val: counts.total, color: 'text-text-primary' },
            { label: 'Recent', val: counts.recent, color: 'text-success' },
            { label: 'Partial', val: counts.partial, color: 'text-warning' },
            { label: 'Outdated', val: counts.outdated, color: 'text-danger' },
            { label: 'Parsing', val: counts.parsing, color: 'text-info' },
            { label: 'Failed', val: counts.failed, color: counts.failed > 0 ? 'text-danger' : 'text-text-muted' },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-border-default bg-white p-3 text-center">
              <div className={`font-display text-xl font-bold ${k.color}`}>{k.val}</div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Upload card */}
        <div className="mb-5 rounded-lg border-2 border-dashed border-border-default bg-white p-6 text-center"
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); uploadFiles(e.dataTransfer.files); }}>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-gold">Batch upload</div>
          <div className="font-display text-base text-text-primary">
            Drop files here, or{' '}
            <button type="button" onClick={() => fileRef.current?.click()}
              className="text-brand-gold underline hover:no-underline">
              browse
            </button>
          </div>
          <div className="mt-1 text-[11px] text-text-muted">
            PDF · DOCX · XLSX · CSV · JSON · PNG/JPG/WEBP — up to 12 MB each. Multiple files OK.
          </div>
          <input ref={fileRef} type="file" multiple
            accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json,image/*"
            onChange={(e) => uploadFiles(e.target.files)}
            className="hidden" />
          {uploading && <div className="mt-3 text-[11px] text-info">Parsing…</div>}
          {uploadError && <div className="mt-3 text-[11px] text-danger">{uploadError}</div>}
        </div>

        {/* Document list */}
        <div className="rounded-lg border border-border-default bg-white">
          <div className="border-b border-border-default px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Documents
          </div>
          {loading && <div className="p-8 text-center text-[13px] text-text-muted">Loading…</div>}
          {!loading && docs.length === 0 && (
            <div className="p-8 text-center text-[13px] text-text-muted">
              No documents yet. Upload organizational regulations, JDs, SOPs, or org charts to begin.
            </div>
          )}
          {!loading && docs.length > 0 && (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border-default text-[10px] uppercase tracking-wider text-text-muted">
                  <th className="px-5 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-center">Validity</th>
                  <th className="px-3 py-2 text-center">Parse</th>
                  <th className="px-3 py-2 text-right">Pages</th>
                  <th className="px-3 py-2 text-right">Size</th>
                  <th className="px-3 py-2 text-right">Uploaded</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-border-default last:border-b-0 hover:bg-surface-page">
                    <td className="px-5 py-2 font-medium text-text-primary">{d.name}</td>
                    <td className="px-3 py-2 text-[10px] text-text-muted">{d.mime?.split('/').pop() || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" onClick={() => setTagModal(d)}
                        className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${VALIDITY_PILL[d.validityFlag]}`}>
                        {VALIDITY_LABEL[d.validityFlag]}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center text-[10px]">
                      {d.parseStatus === 'done' && <span className="text-success">✓ done</span>}
                      {d.parseStatus === 'failed' && <span title={d.parseError || ''} className="text-danger">✗ failed</span>}
                      {d.parseStatus === 'parsing' && <span className="text-info">…parsing</span>}
                      {d.parseStatus === 'queued' && <span className="text-text-muted">queued</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-text-muted">{d.pages ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-text-muted">
                      {d.sizeBytes ? `${(d.sizeBytes / 1024).toFixed(0)} kB` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-text-muted">
                      {new Date(d.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => deleteDoc(d.id)} className="text-text-muted hover:text-danger">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Inline help */}
        <div className="mt-5 rounded-lg border border-[#C5D9EF] bg-info-bg p-3.5 text-[11px] leading-relaxed text-info">
          <strong>Walking-skeleton notice:</strong> the dashboard, upload + parsing, and document tagging are live.
          Org map and process map views are stubs that read this same document set — they will populate as you tag and confirm. RASCI generation, gap detection, drift monitor, and the hovering AI agent ship in subsequent passes.
        </div>
      </div>

      {/* Tag modal */}
      {tagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setTagModal(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 font-display text-base font-bold text-text-primary">Tag document</div>
            <div className="mb-3 truncate text-[12px] text-text-muted">{tagModal.name}</div>
            <div className="mb-3 space-y-2">
              {(['recent', 'partially_valid', 'outdated'] as const).map((flag) => (
                <label key={flag} className="flex cursor-pointer items-start gap-2 rounded border border-border-default p-2 hover:bg-surface-page">
                  <input type="radio" name="vf" checked={tagModal.validityFlag === flag}
                    onChange={() => setTagModal({ ...tagModal, validityFlag: flag })} />
                  <div>
                    <div className="text-[12px] font-semibold text-text-primary">{VALIDITY_LABEL[flag]}</div>
                    <div className="text-[10px] text-text-muted">
                      {flag === 'recent' && 'Reflects current org and processes. Used for grounding.'}
                      {flag === 'partially_valid' && 'Some sections still valid; specify in the note below.'}
                      {flag === 'outdated' && 'Historical only. Excluded from grounding by default.'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <textarea value={tagModal.validityNote || ''}
              onChange={(e) => setTagModal({ ...tagModal, validityNote: e.target.value })}
              placeholder="Notes — which sections are still valid, which aren't, who owns this."
              rows={3} className={`${inputCls} w-full resize-y`} />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setTagModal(null)}
                className="rounded border border-border-default px-3 py-1.5 text-[11px] text-text-muted">
                Cancel
              </button>
              <button onClick={async () => {
                await tagDoc(tagModal.id, { validityFlag: tagModal.validityFlag, validityNote: tagModal.validityNote || '' });
                setTagModal(null);
              }} className="rounded bg-brand-gold px-3 py-1.5 text-[11px] font-medium text-white">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
