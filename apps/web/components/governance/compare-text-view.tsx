'use client';

import { useState, useMemo } from 'react';
import type { LintResult } from '@/lib/lint/score';
import { wordDiff } from '@/lib/lint/diff';

type Side = { text: string; lint: LintResult | null };

export default function CompareTextView() {
  const [a, setA] = useState<Side>({ text: '', lint: null });
  const [b, setB] = useState<Side>({ text: '', lint: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const runLintBoth = async () => {
    if (!a.text.trim() || !b.text.trim()) return;
    setBusy(true);
    setError('');
    try {
      const [ra, rb] = await Promise.all([
        fetch('/api/lint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: a.text, fields: { responsibilities: a.text } }) }),
        fetch('/api/lint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: b.text, fields: { responsibilities: b.text } }) }),
      ]);
      const la: LintResult = await ra.json();
      const lb: LintResult = await rb.json();
      setA(s => ({ ...s, lint: la }));
      setB(s => ({ ...s, lint: lb }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lint failed');
    } finally {
      setBusy(false);
    }
  };

  const diff = useMemo(() => (a.lint && b.lint ? wordDiff(a.text, b.text) : []), [a, b]);

  const rulesDelta = useMemo(() => {
    if (!a.lint || !b.lint) return { improved: [] as string[], regressed: [] as string[] };
    const aIds = new Set(a.lint.findings.map(f => f.ruleId));
    const bIds = new Set(b.lint.findings.map(f => f.ruleId));
    const improved = [...aIds].filter(id => !bIds.has(id));
    const regressed = [...bIds].filter(id => !aIds.has(id));
    return { improved, regressed };
  }, [a, b]);

  const download = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    URL.revokeObjectURL(url);
  };

  const exportReport = () => {
    if (!a.lint || !b.lint) return;
    const lines = [
      `JDGC Governance Compare Report`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      `Version A score: ${a.lint.total}/100 (grade ${a.lint.grade})`,
      `  · Structure: ${a.lint.structure.score}`,
      `  · Bias:      ${a.lint.bias.score}`,
      `  · EUPTD:     ${a.lint.euptd.score}`,
      ``,
      `Version B score: ${b.lint.total}/100 (grade ${b.lint.grade})`,
      `  · Structure: ${b.lint.structure.score}`,
      `  · Bias:      ${b.lint.bias.score}`,
      `  · EUPTD:     ${b.lint.euptd.score}`,
      ``,
      `Delta: ${b.lint.total - a.lint.total >= 0 ? '+' : ''}${b.lint.total - a.lint.total} points`,
      ``,
      `Improved rules (A fail → B pass): ${rulesDelta.improved.join(', ') || 'none'}`,
      `Regressed rules (A pass → B fail): ${rulesDelta.regressed.join(', ') || 'none'}`,
    ];
    download(`compare-report-${Date.now()}.txt`, lines.join('\n'));
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="mb-1 font-display text-2xl font-bold text-text-primary">JD Text Compare</h1>
        <p className="mb-6 text-[13px] text-text-secondary">
          Paste two JD versions — we lint both, diff the text, and report rule-level deltas.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border-default bg-white p-4">
            <div className="mb-2 text-[11px] font-semibold text-text-primary">Version A</div>
            <textarea
              value={a.text}
              onChange={(e) => setA({ text: e.target.value, lint: null })}
              className="w-full resize-y rounded-md border border-border-default bg-surface-page p-3 font-body text-[13px] leading-[1.6]"
              style={{ minHeight: 280 }}
              placeholder="Paste version A…"
            />
            {a.lint && (
              <div className="mt-2 flex items-center gap-3 text-[11px]">
                <span className="font-display text-xl font-bold text-text-primary">{a.lint.total}</span>
                <span className="text-text-muted">Grade {a.lint.grade} · {a.lint.findings.length} findings</span>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border-default bg-white p-4">
            <div className="mb-2 text-[11px] font-semibold text-text-primary">Version B</div>
            <textarea
              value={b.text}
              onChange={(e) => setB({ text: e.target.value, lint: null })}
              className="w-full resize-y rounded-md border border-border-default bg-surface-page p-3 font-body text-[13px] leading-[1.6]"
              style={{ minHeight: 280 }}
              placeholder="Paste version B…"
            />
            {b.lint && (
              <div className="mt-2 flex items-center gap-3 text-[11px]">
                <span className="font-display text-xl font-bold text-text-primary">{b.lint.total}</span>
                <span className="text-text-muted">Grade {b.lint.grade} · {b.lint.findings.length} findings</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] text-text-muted">
            {a.text.trim().split(/\s+/).filter(Boolean).length} / {b.text.trim().split(/\s+/).filter(Boolean).length} words
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={runLintBoth}
              disabled={busy || !a.text.trim() || !b.text.trim()}
              className="rounded-md bg-brand-gold px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
            >
              {busy ? 'Linting…' : '⇄ Lint & Compare'}
            </button>
            {a.lint && b.lint && (
              <button
                type="button"
                onClick={exportReport}
                className="rounded-md border border-border-default bg-white px-4 py-2 text-xs text-text-primary"
              >
                ↓ Export Report
              </button>
            )}
          </div>
        </div>

        {error && <div className="mt-3 rounded-md bg-danger-bg p-2 text-[11px] text-danger">{error}</div>}

        {a.lint && b.lint && (
          <div className="mt-6 grid grid-cols-3 gap-4">
            {/* Delta summary */}
            <div className="rounded-xl border border-border-default bg-white p-4">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Score Delta</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`font-display text-4xl font-bold ${b.lint.total >= a.lint.total ? 'text-[#1D7A3C]' : 'text-danger'}`}>
                  {b.lint.total - a.lint.total >= 0 ? '+' : ''}{b.lint.total - a.lint.total}
                </span>
                <span className="text-[12px] text-text-muted">pts</span>
              </div>
              <div className="mt-3 space-y-1.5 text-[11px]">
                {(['structure', 'bias', 'euptd'] as const).map(cat => {
                  const dv = b.lint![cat].score - a.lint![cat].score;
                  return (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="text-text-secondary capitalize">{cat}</span>
                      <span className={`font-mono ${dv >= 0 ? 'text-[#1D7A3C]' : 'text-danger'}`}>
                        {dv >= 0 ? '+' : ''}{dv}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Improved */}
            <div className="rounded-xl border border-border-default bg-white p-4">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Improved ({rulesDelta.improved.length})</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {rulesDelta.improved.length === 0
                  ? <span className="text-[11px] text-text-muted">No rules improved.</span>
                  : rulesDelta.improved.map(r => (
                      <span key={r} className="rounded bg-[#E7F5EC] px-1.5 py-0.5 font-mono text-[11px] text-[#1D7A3C]">{r}</span>
                    ))}
              </div>
            </div>

            {/* Regressed */}
            <div className="rounded-xl border border-border-default bg-white p-4">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Regressed ({rulesDelta.regressed.length})</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {rulesDelta.regressed.length === 0
                  ? <span className="text-[11px] text-text-muted">No regressions — nice.</span>
                  : rulesDelta.regressed.map(r => (
                      <span key={r} className="rounded bg-danger-bg px-1.5 py-0.5 font-mono text-[11px] text-danger">{r}</span>
                    ))}
              </div>
            </div>
          </div>
        )}

        {diff.length > 0 && (
          <div className="mt-6 rounded-xl border border-border-default bg-white">
            <div className="border-b border-border-default px-4 py-2 text-[11px] font-medium text-text-muted">
              Inline diff
            </div>
            <div className="max-h-[520px] overflow-y-auto p-4 font-body text-[13px] leading-[1.8] whitespace-pre-wrap">
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
      </div>
    </div>
  );
}
