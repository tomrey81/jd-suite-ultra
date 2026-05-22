'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface Result {
  ok: boolean;
  filename: string;
  jdId?: string;
  jobTitle?: string;
  charsParsed?: number;
  error?: string;
}

interface TemplateOption {
  id: string;
  name: string;
  purpose?: string | null;
  description?: string | null;
  isDefault?: boolean;
  orgId?: string | null;
}

export default function BulkImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [folder, setFolder] = useState('Imported');
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ imported: number; failed: number } | null>(null);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState<string>('none');
  const [templatesLoading, setTemplatesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/templates');
        if (!res.ok) return;
        const data = (await res.json()) as TemplateOption[];
        if (cancelled) return;
        setTemplates(data);
        const def = data.find((t) => t.isDefault);
        if (def) setTemplateId(def.id);
      } catch {
        // non-fatal — picker just stays empty
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function pick(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list);
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const merged = [...prev];
      for (const f of arr) {
        const key = `${f.name}:${f.size}`;
        if (!seen.has(key)) merged.push(f);
      }
      return merged;
    });
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function upload() {
    if (files.length === 0) return;
    setUploading(true); setError(null); setResults([]); setSummary(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      fd.append('folder', folder);
      fd.append('templateId', templateId);
      const res = await fetch('/api/jd/bulk-import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Upload failed (${res.status})`);
        return;
      }
      setResults(data.results || []);
      setSummary({ imported: data.imported, failed: data.failed });
      setFiles([]);
    } catch (e) {
      setError((e as Error).message || 'Network error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[860px]">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Bulk import JDs</h1>
            <p className="mt-1 text-[13px] text-text-secondary">
              Drop multiple Word, PDF, or text files. Each becomes a draft JD in your library.
              Headings get auto-classified into known fields (purpose, accountabilities, requirements, conditions).
              Unrecognised content is preserved in <em>notes</em> so nothing is lost.
            </p>
          </div>
          <Link href="/" className="rounded border border-border-default bg-white px-3 py-1.5 text-[11px]">
            ← Library
          </Link>
        </div>

        <div className="mt-5 rounded-lg border-2 border-dashed border-border-default bg-white p-6"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">Drag &amp; drop</div>
              <div className="font-display text-base text-text-primary">
                Drop files here, or{' '}
                <button onClick={() => fileRef.current?.click()} className="text-brand-gold underline">browse</button>
              </div>
              <div className="mt-1 text-[11px] text-text-muted">
                .pdf, .docx, .txt — up to 25 files / 10 MB each.
              </div>
            </div>
            <input ref={fileRef} type="file" multiple
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => pick(e.target.files)}
              className="hidden" />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Target folder</span>
              <input value={folder} onChange={(e) => setFolder(e.target.value)}
                className="rounded border border-border-default bg-white px-2 py-1.5 text-[12px] outline-none focus:border-brand-gold" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Template {templatesLoading && <span className="ml-1 text-text-muted">(loading…)</span>}
              </span>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={templatesLoading}
                className="rounded border border-border-default bg-white px-2 py-1.5 text-[12px] outline-none focus:border-brand-gold disabled:opacity-50"
              >
                <option value="none">No template (raw fields only)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isDefault ? ' · default' : ''}
                    {t.orgId === null ? ' · system' : ''}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={upload} disabled={uploading || files.length === 0}
              className="rounded-md bg-brand-gold px-4 py-2 text-[12px] font-medium text-white disabled:opacity-40">
              {uploading ? 'Importing…' : `Import ${files.length} file${files.length !== 1 ? 's' : ''}`}
            </button>
          </div>
          {templateId !== 'none' && templates.length > 0 && (
            <p className="mt-2 text-[11px] text-text-muted">
              Each imported JD will be linked to{' '}
              <span className="font-medium text-text-primary">
                {templates.find((t) => t.id === templateId)?.name || 'this template'}
              </span>{' '}
              so the editor opens with the right sections and fields.
            </p>
          )}
        </div>

        {/* Pending file list */}
        {files.length > 0 && (
          <div className="mt-4 rounded-lg border border-border-default bg-white">
            <div className="border-b border-border-default px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Queue ({files.length})
            </div>
            <ul className="divide-y divide-border-default">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between px-4 py-2 text-[12px]">
                  <div className="flex-1 truncate">
                    <span className="font-medium text-text-primary">{f.name}</span>
                    <span className="ml-2 text-[10px] text-text-muted">
                      {(f.size / 1024).toFixed(0)} kB · {f.type || 'unknown'}
                    </span>
                  </div>
                  <button onClick={() => removeFile(i)} className="text-base text-text-muted hover:text-danger">×</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded border border-danger bg-danger-bg p-3 text-[12px] text-danger">
            {error}
          </div>
        )}

        {summary && (
          <div className="mt-4 rounded-lg border border-border-default bg-white">
            <div className="flex items-center justify-between border-b border-border-default px-4 py-2">
              <div className="text-[12px] font-semibold text-text-primary">
                Imported {summary.imported}{summary.failed > 0 && `, ${summary.failed} failed`}
              </div>
              <Link href="/" className="text-[11px] text-brand-gold hover:underline">Open Library →</Link>
            </div>
            <ul className="divide-y divide-border-default">
              {results.map((r, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-2 text-[12px]">
                  <div className="flex-1 truncate">
                    <span className={r.ok ? 'text-success' : 'text-danger'}>{r.ok ? '✓' : '✗'}</span>{' '}
                    <span className="font-medium text-text-primary">{r.filename}</span>
                    {r.ok && (
                      <>
                        <span className="ml-2 text-[10px] text-text-muted">→ {r.jobTitle}</span>
                        <span className="ml-2 text-[10px] text-text-muted">{r.charsParsed} chars</span>
                      </>
                    )}
                    {!r.ok && <span className="ml-2 text-[10px] text-danger">{r.error}</span>}
                  </div>
                  {r.ok && r.jdId && (
                    <Link href={`/jd/${r.jdId}`} className="text-[11px] text-brand-gold hover:underline">
                      Open →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
