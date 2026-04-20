'use client';

import { useState, useMemo } from 'react';
import type { LintResult, Finding } from '@/lib/lint/score';
import { logEvent } from '@/lib/telemetry/store';
import { toMarkdown, toJson, toCsv, toPrintableHtml, downloadText, openHtmlInNewWindow } from '@/lib/export/formats';

const CAT_LABEL: Record<string, { title: string; weight: string }> = {
  structure: { title: 'Structure', weight: '30%' },
  bias: { title: 'Bias & Inclusivity', weight: '35%' },
  euptd: { title: 'EUPTD Compliance', weight: '35%' },
};

const SEV_COLOR: Record<string, string> = {
  info: 'bg-info-bg text-info',
  warn: 'bg-[#FFF4D6] text-[#946200]',
  error: 'bg-danger-bg text-danger',
};

function slug(s: string) {
  return (s || 'jd').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'jd';
}

export default function AnalyserView() {
  const [text, setText] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobPurpose, setJobPurpose] = useState('');
  const [result, setResult] = useState<LintResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'structure' | 'bias' | 'euptd'>('all');

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/lint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          fields: { jobTitle, jobPurpose, responsibilities: text },
        }),
      });
      if (!res.ok) throw new Error(`Lint failed: ${res.status}`);
      const data: LintResult = await res.json();
      setResult(data);
      logEvent({ kind: 'lint', jobTitle: jobTitle || undefined, score: data.total, grade: data.grade, meta: { errors: data.findings.filter(f => f.severity === 'error').length, warns: data.findings.filter(f => f.severity === 'warn').length } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const filteredFindings = useMemo<Finding[]>(() => {
    if (!result) return [];
    if (filter === 'all') return result.findings;
    return result.findings.filter(f => f.category === filter);
  }, [result, filter]);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1200px]">
        <h1 className="mb-1 font-display text-2xl font-bold text-text-primary">JD Analyser</h1>
        <p className="mb-6 text-[13px] text-text-secondary">
          Deterministic lint engine · 25 rules · Structure 30% · Bias 35% · EUPTD 35%
        </p>

        <div className="grid grid-cols-12 gap-6">
          {/* Input panel */}
          <div className="col-span-5 space-y-3">
            <div className="rounded-xl border border-border-default bg-white p-5">
              <label className="mb-1 block text-[11px] font-semibold text-text-primary">Job Title</label>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="mb-3 w-full rounded-md border border-border-default bg-surface-page px-3 py-2 text-[13px]"
                placeholder="e.g. Senior Software Engineer"
              />
              <label className="mb-1 block text-[11px] font-semibold text-text-primary">Job Purpose</label>
              <textarea
                value={jobPurpose}
                onChange={(e) => setJobPurpose(e.target.value)}
                className="mb-3 w-full resize-y rounded-md border border-border-default bg-surface-page px-3 py-2 text-[13px]"
                style={{ minHeight: 80 }}
                placeholder="1–3 sentence summary of the role."
              />
              <label className="mb-1 block text-[11px] font-semibold text-text-primary">
                Full JD Text <span className="text-brand-gold">*</span>
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full resize-y rounded-md border border-border-default bg-surface-page px-3 py-2 font-body text-[13px] leading-[1.6]"
                style={{ minHeight: 340 }}
                placeholder="Paste the full JD body: purpose, responsibilities, requirements…"
              />
              <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
                <span>{text.length} chars · {text.trim().split(/\s+/).filter(Boolean).length} words</span>
                <button
                  type="button"
                  onClick={run}
                  disabled={busy || !text.trim()}
                  className="rounded-md bg-brand-gold px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
                >
                  {busy ? 'Linting…' : '◆ Run Analyser'}
                </button>
              </div>
              {error && <div className="mt-2 rounded-md bg-danger-bg p-2 text-[11px] text-danger">{error}</div>}
            </div>
          </div>

          {/* Results panel */}
          <div className="col-span-7 space-y-3">
            {!result && (
              <div className="rounded-xl border border-dashed border-border-default bg-white p-10 text-center text-[13px] text-text-muted">
                Run the analyser to see scoring & findings.
              </div>
            )}

            {result && (
              <>
                {/* Score card */}
                <div className="rounded-xl border border-border-default bg-white p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-text-muted">Total Score</div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-display text-5xl font-bold text-text-primary">{result.total}</span>
                        <span className="text-[13px] text-text-muted">/ 100</span>
                        <span className="ml-2 rounded-md bg-brand-gold px-2 py-0.5 text-xs font-bold text-white">Grade {result.grade}</span>
                      </div>
                      <div className="mt-2 text-[12px] text-text-secondary">{result.summary}</div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {(['structure', 'bias', 'euptd'] as const).map(cat => {
                      const s = result[cat];
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFilter(cat)}
                          className={`rounded-lg border px-3 py-3 text-left transition-colors ${filter === cat ? 'border-brand-gold bg-[#FAF6EE]' : 'border-border-default bg-surface-page'}`}
                        >
                          <div className="text-[10px] uppercase tracking-wider text-text-muted">
                            {CAT_LABEL[cat].title} · {CAT_LABEL[cat].weight}
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="font-display text-2xl font-bold text-text-primary">{s.score}</span>
                            <span className="text-[11px] text-text-muted">/ 100</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-surface-page">
                            <div className="h-full rounded-full bg-brand-gold" style={{ width: `${s.score}%` }} />
                          </div>
                          <div className="mt-1 text-[10px] text-text-muted">
                            {s.rulesFailed} of {s.rulesRun} rules failed
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Export bar */}
                <div className="flex flex-wrap gap-1.5 rounded-lg bg-surface-page p-2">
                  <span className="px-1 text-[10px] uppercase tracking-wider text-text-muted self-center">Export:</span>
                  {[
                    { label: '↓ MD', fn: () => downloadText(`${slug(jobTitle)}-report.md`, toMarkdown({ jobTitle, body: text, lint: result }), 'text/markdown') },
                    { label: '↓ JSON', fn: () => downloadText(`${slug(jobTitle)}-report.json`, toJson({ jobTitle, body: text, lint: result }), 'application/json') },
                    { label: '↓ CSV', fn: () => downloadText(`${slug(jobTitle)}-findings.csv`, toCsv({ jobTitle, body: text, lint: result }), 'text/csv') },
                    { label: '⎙ Print', fn: () => openHtmlInNewWindow(toPrintableHtml({ jobTitle, body: text, lint: result, meta: { generated: new Date().toLocaleString() } })) },
                  ].map(b => (
                    <button key={b.label} type="button" onClick={b.fn}
                      className="rounded border border-border-default bg-white px-2 py-1 text-[10px] text-text-primary">
                      {b.label}
                    </button>
                  ))}
                </div>

                {/* Findings */}
                <div className="rounded-xl border border-border-default bg-white">
                  <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
                    <div className="text-[13px] font-medium text-text-primary">
                      Findings {filter !== 'all' ? `· ${CAT_LABEL[filter].title}` : ''}
                    </div>
                    <div className="flex gap-1">
                      {(['all', 'structure', 'bias', 'euptd'] as const).map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFilter(f)}
                          className={`rounded px-2 py-1 text-[10px] ${filter === f ? 'bg-brand-gold text-white' : 'bg-surface-page text-text-secondary'}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto divide-y divide-border-default">
                    {filteredFindings.length === 0 ? (
                      <div className="p-8 text-center text-[13px] text-text-muted">No findings in this category — clean!</div>
                    ) : (
                      filteredFindings.map((f, i) => (
                        <div key={i} className="px-5 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${SEV_COLOR[f.severity]}`}>
                                  {f.severity}
                                </span>
                                <span className="text-[11px] font-mono text-text-muted">{f.ruleId}</span>
                                <span className="text-[11px] text-text-muted">· {f.category}</span>
                              </div>
                              <div className="mt-1 text-[13px] text-text-primary">{f.message}</div>
                              {f.suggestion && (
                                <div className="mt-1 text-[12px] text-text-secondary">→ {f.suggestion}</div>
                              )}
                              {f.span?.excerpt && (
                                <div className="mt-1 inline-block rounded bg-surface-page px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
                                  "{f.span.excerpt}"
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
