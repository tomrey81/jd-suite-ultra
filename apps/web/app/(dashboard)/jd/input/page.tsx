'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Mode = 'paste' | 'files' | 'url';

interface Result {
  ok: boolean;
  filename: string;
  jdId?: string;
  jobTitle?: string;
  charsParsed?: number;
  error?: string;
}

export default function InputJDPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>('files');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [folder, setFolder] = useState('Imported');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  // Drop or browse — auto-add to file list
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
    setMode('files');
  }

  const removeFile = (i: number) => setFiles((p) => p.filter((_, idx) => idx !== i));

  // ── Submit handlers ────────────────────────────────────────────────────

  async function submitFiles() {
    if (files.length === 0) return;
    setBusy(true); setError(null); setResults(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      fd.append('folder', folder);
      const res = await fetch('/api/jd/bulk-import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Upload failed (${res.status})`);
        return;
      }
      setResults(data.results || []);
      setFiles([]);
      // If only one succeeded, jump straight to it
      const success = (data.results || []).filter((r: Result) => r.ok);
      if (success.length === 1 && success[0].jdId) {
        router.push(`/jd/${success[0].jdId}`);
      }
    } catch (e) {
      setError((e as Error).message || 'Network error');
    } finally {
      setBusy(false);
    }
  }

  async function submitPaste() {
    if (!text.trim()) return;
    // Convert pasted text into a single virtual .txt and reuse bulk-import
    setBusy(true); setError(null); setResults(null);
    try {
      const fd = new FormData();
      const blob = new Blob([text], { type: 'text/plain' });
      fd.append('files', blob, 'pasted.txt');
      fd.append('folder', folder);
      const res = await fetch('/api/jd/bulk-import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Import failed (${res.status})`);
        return;
      }
      const r = (data.results || [])[0];
      if (r?.ok && r.jdId) {
        router.push(`/jd/${r.jdId}`);
      } else {
        setResults(data.results || []);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitUrl() {
    if (!url.trim()) return;
    setBusy(true); setError(null); setResults(null);
    try {
      const res = await fetch('/api/jobs/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(`${data.error || 'Fetch failed'}${data.hint ? ` — ${data.hint}` : ''}`);
        return;
      }
      // The scraper returns a list of jobs from a careers page. Show them and
      // let the user pick which to import. For v1 just stuff the first into a JD.
      const first = (data.jobs || [])[0];
      if (!first) {
        setError('No jobs found at that URL.');
        return;
      }
      const jdText = `${first.title || ''}\n${first.location || ''}\n${first.department || ''}\n\n${first.snippet || ''}`;
      setText(jdText);
      setMode('paste');
      setError('Found ' + (data.jobs?.length || 0) + ' job(s) at that URL — content moved to the paste tab. Edit and save.');
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    'w-full rounded-md border border-border-default bg-surface-page px-3 py-2 font-body text-sm text-text-primary outline-none focus:border-brand-gold';

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[860px]">
        {/* Header */}
        <div className="mb-1 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">Step 1 — Input</div>
            <h1 className="mt-1 font-display text-2xl font-bold text-text-primary">Input a job description</h1>
            <p className="mt-1 text-[13px] text-text-secondary">
              Drop one file or many, paste plain text, or fetch from a careers URL.
              JD Suite parses, classifies headings, saves a Draft, and opens it.
            </p>
          </div>
          <Link
            href="/jd"
            className="shrink-0 whitespace-nowrap rounded-md border border-border-default bg-white px-3 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-brand-gold hover:text-brand-gold"
          >
            ← JD hub
          </Link>
        </div>

        {/* Mode tabs */}
        <div className="mt-5 flex gap-1 rounded-md border border-border-default bg-white p-1">
          <ModeTab active={mode === 'files'} onClick={() => setMode('files')}
            label="Upload files" hint="PDF · DOCX · TXT · multiple OK" />
          <ModeTab active={mode === 'paste'} onClick={() => setMode('paste')}
            label="Paste text" hint="Quickest for one JD" />
          <ModeTab active={mode === 'url'} onClick={() => setMode('url')}
            label="From URL" hint="Public careers page" />
        </div>

        {/* Files mode */}
        {mode === 'files' && (
          <div className="mt-4">
            <div className="rounded-lg border-2 border-dashed border-border-default bg-white p-6 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">Drag &amp; drop</div>
              <div className="font-display text-base text-text-primary">
                Drop files here, or{' '}
                <button onClick={() => fileRef.current?.click()} className="text-brand-gold underline">browse</button>
              </div>
              <div className="mt-1 text-[11px] text-text-muted">
                .pdf, .docx, .txt — up to 25 files, 10 MB each. Multi-file = bulk import.
              </div>
              <input ref={fileRef} type="file" multiple
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => pick(e.target.files)}
                className="hidden" />
            </div>

            {files.length > 0 && (
              <div className="mt-3 rounded-lg border border-border-default bg-white">
                <div className="border-b border-border-default px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Queue ({files.length})
                </div>
                <ul className="divide-y divide-border-default">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between px-4 py-2 text-[12px]">
                      <div className="flex-1 truncate">
                        <span className="font-medium text-text-primary">{f.name}</span>
                        <span className="ml-2 text-[10px] text-text-muted">
                          {(f.size / 1024).toFixed(0)} kB
                        </span>
                      </div>
                      <button onClick={() => removeFile(i)} className="text-base text-text-muted hover:text-danger">×</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 flex items-end gap-3">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Target folder</span>
                <input value={folder} onChange={(e) => setFolder(e.target.value)} className={inputCls} />
              </label>
              <button onClick={submitFiles} disabled={busy || files.length === 0}
                className="rounded-md bg-brand-gold px-4 py-2 text-[12px] font-medium text-white disabled:opacity-40">
                {busy ? 'Importing…' : files.length === 1 ? 'Import 1 file' : `Bulk import ${files.length} files`}
              </button>
            </div>
          </div>
        )}

        {/* Paste mode */}
        {mode === 'paste' && (
          <div className="mt-4 space-y-3">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14}
              placeholder="Paste a job description here — title, purpose, accountabilities, skills, conditions. Headings get auto-classified."
              className={`${inputCls} resize-y font-mono text-[12px] leading-relaxed`} />
            <div className="flex items-end gap-3">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Target folder</span>
                <input value={folder} onChange={(e) => setFolder(e.target.value)} className={inputCls} />
              </label>
              <span className="text-[10px] text-text-muted">{text.length.toLocaleString()} chars</span>
              <button onClick={submitPaste} disabled={busy || !text.trim()}
                className="rounded-md bg-brand-gold px-4 py-2 text-[12px] font-medium text-white disabled:opacity-40">
                {busy ? 'Importing…' : 'Save as draft'}
              </button>
            </div>
          </div>
        )}

        {/* URL mode */}
        {mode === 'url' && (
          <div className="mt-4 space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Careers page URL</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://jobs.company.com/role"
                className={inputCls} />
              <span className="text-[10px] text-text-muted">
                Works on simple HTML careers pages. LinkedIn, Workday, Cloudflare-fronted sites usually block scraping —
                fall back to upload or paste in that case.
              </span>
            </label>
            <button onClick={submitUrl} disabled={busy || !url.trim()}
              className="rounded-md bg-brand-gold px-4 py-2 text-[12px] font-medium text-white disabled:opacity-40">
              {busy ? 'Fetching…' : 'Fetch & extract'}
            </button>
          </div>
        )}

        {/* Errors / results */}
        {error && (
          <div className="mt-4 rounded border border-danger bg-danger-bg p-3 text-[12px] text-danger">{error}</div>
        )}
        {results && (
          <div className="mt-4 rounded-lg border border-border-default bg-white">
            <div className="flex items-center justify-between border-b border-border-default px-4 py-2">
              <div className="text-[12px] font-semibold text-text-primary">
                Imported {results.filter((r) => r.ok).length}, {results.filter((r) => !r.ok).length} failed
              </div>
              <Link href="/" className="text-[11px] text-brand-gold hover:underline">Open Library →</Link>
            </div>
            <ul className="divide-y divide-border-default">
              {results.map((r, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-2 text-[12px]">
                  <div className="flex-1 truncate">
                    <span className={r.ok ? 'text-success' : 'text-danger'}>{r.ok ? '✓' : '✗'}</span>{' '}
                    <span className="font-medium text-text-primary">{r.filename}</span>
                    {r.ok && <span className="ml-2 text-[10px] text-text-muted">→ {r.jobTitle}</span>}
                    {!r.ok && <span className="ml-2 text-[10px] text-danger">{r.error}</span>}
                  </div>
                  {r.ok && r.jdId && (
                    <Link href={`/jd/${r.jdId}`} className="text-[11px] text-brand-gold hover:underline">Open →</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 rounded-md border-l-2 border-brand-gold bg-brand-gold-lighter px-4 py-3 text-[11.5px] leading-relaxed text-text-primary">
          <strong className="text-brand-gold">What happens next · </strong>
          Headings like &quot;Purpose / Responsibilities / Skills / Conditions&quot; are auto-routed into JD Suite fields.
          Anything unrecognised lands in <em>notes</em>. After import, run{' '}
          <Link href="/analyser" className="text-brand-gold underline-offset-2 hover:underline">Lint &amp; analyse</Link>{' '}
          or <Link href="/v5/bias-check" className="text-brand-gold underline-offset-2 hover:underline">Bias check</Link>,
          then export an audit report.
        </div>
      </div>
    </div>
  );
}

function ModeTab({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md border px-3 py-2 text-left transition-colors ${
        active
          ? 'border-brand-gold bg-brand-gold-lighter'
          : 'border-transparent hover:bg-surface-page'
      }`}
    >
      <div className={`text-[12px] font-semibold ${active ? 'text-brand-gold' : 'text-text-primary'}`}>{label}</div>
      <div className={`text-[10px] ${active ? 'text-brand-gold/70' : 'text-text-muted'}`}>{hint}</div>
    </button>
  );
}
