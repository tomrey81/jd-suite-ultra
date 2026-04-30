'use client';

import { useState, useMemo } from 'react';
import type { LintResult } from '@/lib/lint/score';
import { wordDiff } from '@/lib/lint/diff';
import { logEvent } from '@/lib/telemetry/store';
import { toMarkdown, toJson, toCsv, toPrintableHtml, downloadText, openHtmlInNewWindow } from '@/lib/export/formats';
import { HypothesisPanel } from '@/components/hypotheses/hypothesis-panel';

function slugify(s: string) {
  return (s || 'jd').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'jd';
}

type RewriteResponse = {
  before: { text: string; lint: LintResult };
  after: { text: string; lint: LintResult };
  changes: string[];
  delta: number;
  model: string;
};

export default function EditorView() {
  const [draft, setDraft] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [result, setResult] = useState<RewriteResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'split' | 'diff'>('split');

  const run = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: draft,
          fields: { jobTitle, responsibilities: draft },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `${res.status}`);
      }
      const data: RewriteResponse = await res.json();
      setResult(data);
      logEvent({
        kind: 'rewrite',
        jobTitle: jobTitle || undefined,
        score: data.after.lint.total,
        grade: data.after.lint.grade,
        delta: data.delta,
        meta: { model: data.model, changes: data.changes.length },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rewrite failed');
    } finally {
      setBusy(false);
    }
  };

  const diff = useMemo(() => {
    if (!result) return [];
    return wordDiff(result.before.text, result.after.text);
  }, [result]);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="mb-1 font-display text-2xl font-bold text-text-primary">JD Editor</h1>
        <p className="mb-6 text-[13px] text-text-secondary">
          AI-powered rewrite using Claude Opus 4.6 · lint-guided · EUPTD-compliant
        </p>

        {!result && (
          <div className="rounded-xl border border-border-default bg-white p-5">
            <label className="mb-1 block text-[11px] font-semibold text-text-primary">Job Title</label>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="mb-3 w-full rounded-md border border-border-default bg-surface-page px-3 py-2 text-[13px]"
              placeholder="e.g. Senior Data Engineer"
            />
            <label className="mb-1 block text-[11px] font-semibold text-text-primary">Draft JD</label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full resize-y rounded-md border border-border-default bg-surface-page px-3 py-2 font-body text-[13px] leading-[1.6]"
              style={{ minHeight: 420 }}
              placeholder="Paste your current JD draft here. The rewriter will lint it, then regenerate a governance-compliant version."
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-text-muted">
                {draft.length} chars · {draft.trim().split(/\s+/).filter(Boolean).length} words
              </span>
              <button
                type="button"
                onClick={run}
                disabled={busy || !draft.trim()}
                className="rounded-md bg-brand-gold px-5 py-2 text-xs font-medium text-white disabled:opacity-40"
              >
                {busy ? 'Rewriting…' : '✦ Rewrite with Opus 4.6'}
              </button>
            </div>
            {error && <div className="mt-3 rounded-md bg-danger-bg p-2 text-[11px] text-danger">{error}</div>}
          </div>
        )}

        {result && (
          <>
            {/* Score delta header */}
            <div className="mb-4 rounded-xl border border-border-default bg-white p-4">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">Before</div>
                  <div className="font-display text-3xl font-bold text-text-muted">{result.before.lint.total}</div>
                </div>
                <div className="text-2xl text-text-muted">→</div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">After</div>
                  <div className="font-display text-3xl font-bold text-text-primary">{result.after.lint.total}</div>
                </div>
                <div className={`rounded-md px-3 py-1 text-sm font-bold ${result.delta >= 0 ? 'bg-[#E7F5EC] text-[#1D7A3C]' : 'bg-danger-bg text-danger'}`}>
                  {result.delta >= 0 ? '+' : ''}{result.delta} pts
                </div>
                <div className="ml-auto flex gap-1">
                  <button
                    type="button"
                    onClick={() => setView('split')}
                    className={`rounded px-3 py-1 text-[11px] ${view === 'split' ? 'bg-brand-gold text-white' : 'bg-surface-page text-text-secondary'}`}
                  >
                    Split
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('diff')}
                    className={`rounded px-3 py-1 text-[11px] ${view === 'diff' ? 'bg-brand-gold text-white' : 'bg-surface-page text-text-secondary'}`}
                  >
                    Inline Diff
                  </button>
                  <div className="mx-1 h-5 w-px bg-border-default" />
                  <button type="button" onClick={() => {
                    const doc = { jobTitle, body: result.after.text, lint: result.after.lint, meta: { model: result.model, generated: new Date().toISOString() } };
                    downloadText(`${slugify(jobTitle)}.md`, toMarkdown(doc), 'text/markdown');
                  }} className="rounded border border-border-default px-2 py-1 text-[11px] text-text-secondary">↓ MD</button>
                  <button type="button" onClick={() => {
                    const doc = { jobTitle, body: result.after.text, lint: result.after.lint, meta: { model: result.model } };
                    downloadText(`${slugify(jobTitle)}.json`, toJson(doc), 'application/json');
                  }} className="rounded border border-border-default px-2 py-1 text-[11px] text-text-secondary">↓ JSON</button>
                  <button type="button" onClick={() => {
                    const doc = { jobTitle, body: result.after.text, lint: result.after.lint };
                    downloadText(`${slugify(jobTitle)}-findings.csv`, toCsv(doc), 'text/csv');
                  }} className="rounded border border-border-default px-2 py-1 text-[11px] text-text-secondary">↓ CSV</button>
                  <button type="button" onClick={() => {
                    const doc = { jobTitle, body: result.after.text, lint: result.after.lint, meta: { model: result.model, generated: new Date().toLocaleString() } };
                    openHtmlInNewWindow(toPrintableHtml(doc));
                  }} className="rounded border border-border-default px-2 py-1 text-[11px] text-text-secondary">⎙ Print</button>
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="rounded border border-border-default px-3 py-1 text-[11px] text-text-secondary"
                  >
                    New Rewrite
                  </button>
                </div>
              </div>
              {result.changes.length > 0 && (
                <div className="mt-3 border-t border-border-default pt-3">
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted">Changes Made</div>
                  <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] text-text-secondary">
                    {result.changes.slice(0, 8).map((c, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-brand-gold">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {view === 'split' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border-default bg-white">
                  <div className="border-b border-border-default px-4 py-2 text-[11px] font-medium text-text-muted">
                    Original · {result.before.lint.total}/100 · {result.before.lint.grade}
                  </div>
                  <div className="max-h-[600px] overflow-y-auto p-4 font-body text-[13px] leading-[1.7] text-text-secondary whitespace-pre-wrap">
                    {result.before.text}
                  </div>
                </div>
                <div className="rounded-xl border border-brand-gold bg-white">
                  <div className="border-b border-border-default bg-[#FAF6EE] px-4 py-2 text-[11px] font-medium text-text-primary">
                    Rewritten · {result.after.lint.total}/100 · {result.after.lint.grade}
                  </div>
                  <div className="max-h-[600px] overflow-y-auto p-4 font-body text-[13px] leading-[1.7] text-text-primary whitespace-pre-wrap">
                    {result.after.text}
                  </div>
                </div>
              </div>
            )}

            {view === 'diff' && (
              <div className="rounded-xl border border-border-default bg-white">
                <div className="border-b border-border-default px-4 py-2 text-[11px] font-medium text-text-muted">
                  Inline diff · red = removed · green = added
                </div>
                <div className="max-h-[680px] overflow-y-auto p-4 font-body text-[13px] leading-[1.8] whitespace-pre-wrap">
                  {diff.map((seg, i) =>
                    seg.op === 'eq' ? (
                      <span key={i} className="text-text-secondary">{seg.text}</span>
                    ) : seg.op === 'add' ? (
                      <span key={i} className="bg-[#DCFBE6] text-[#0B5C2C]">{seg.text}</span>
                    ) : (
                      <span key={i} className="bg-[#FBDCDC] text-[#8A1F1F] line-through">{seg.text}</span>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Axiomera-style hypothesis test against the rewritten JD */}
            <div className="mt-6">
              <HypothesisPanel
                jdText={result.after.text}
                language="pl"
                title="Hypothesis test on rewritten JD"
              />
            </div>
          </>
        )}

        {/* Hypothesis test against draft (before rewrite) — useful for diagnosing what's missing */}
        {!result && draft.trim().length > 100 && (
          <div className="mt-6">
            <HypothesisPanel
              jdText={draft}
              language="pl"
              title="Hypothesis test on current draft"
            />
          </div>
        )}
      </div>
    </div>
  );
}
