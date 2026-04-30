'use client';

import { useState, useMemo } from 'react';
import { HypothesisPanel } from '@/components/hypotheses/hypothesis-panel';
import { cn } from '@/lib/utils';
import type { LintResult } from '@/lib/lint/score';
import { wordDiff } from '@/lib/lint/diff';

type RewriteResponse = {
  before: { text: string; lint: LintResult };
  after: { text: string; lint: LintResult };
  changes: string[];
  delta: number;
  model: string;
};

interface BiasFlag {
  layer: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'block';
  start: number;
  end: number;
  matched: string;
  notes: string;
  remediation?: string;
}

interface BiasReport {
  language: 'en' | 'pl';
  inputLength: number;
  agenticCount: number;
  communalCount: number;
  skewScore: number;
  skewLevel: 'balanced' | 'soft_warn' | 'hard_warn';
  flags: BiasFlag[];
  eigeCoverage: { cognitive: boolean; emotional: boolean; physical: boolean };
  implicit: { pinkJobUndervaluation: boolean; machoLeadership: boolean; elektromonterTrap: boolean };
}

type Tab = 'edit' | 'lint' | 'bias' | 'hypotheses' | 'rewrite';

const TABS: { id: Tab; label: string; description: string }[] = [
  { id: 'edit',       label: 'Edit',                description: 'Author / paste / iterate the JD text' },
  { id: 'lint',       label: 'Lint & Analyse',      description: '25 deterministic rules: structure, bias, EUPTD' },
  { id: 'bias',       label: 'Bias Check',          description: 'Lexical + Iceland implicit + EIGE coverage' },
  { id: 'hypotheses', label: 'Hypothesis Test',     description: 'Axiomera 56-hypothesis structural fit' },
  { id: 'rewrite',    label: 'AI Rewrite',          description: 'Lint-guided rewrite via Claude' },
];

const SEVERITY_BG: Record<string, string> = {
  low: 'bg-yellow-100',
  medium: 'bg-orange-100',
  high: 'bg-red-100',
  block: 'bg-red-200',
};
const SEVERITY_BORDER: Record<string, string> = {
  low: 'border-yellow-400',
  medium: 'border-orange-500',
  high: 'border-red-500',
  block: 'border-red-700',
};

export function JDEditorWorkbench() {
  const [tab, setTab] = useState<Tab>('edit');
  const [jobTitle, setJobTitle] = useState('');
  const [text, setText] = useState('');
  const [language, setLanguage] = useState<'en' | 'pl'>('en');

  // Lint state
  const [lintResult, setLintResult] = useState<LintResult | null>(null);
  const [lintLoading, setLintLoading] = useState(false);
  const [lintError, setLintError] = useState<string | null>(null);

  // Bias state
  const [biasReport, setBiasReport] = useState<BiasReport | null>(null);
  const [biasLoading, setBiasLoading] = useState(false);
  const [biasError, setBiasError] = useState<string | null>(null);

  // Rewrite state
  const [rewriteResult, setRewriteResult] = useState<RewriteResponse | null>(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [rewriteView, setRewriteView] = useState<'split' | 'diff'>('split');

  const wordCount = useMemo(() => text.trim().split(/\s+/).filter(Boolean).length, [text]);
  const charCount = text.length;
  const canRun = text.trim().length >= 50;

  const runLint = async () => {
    if (!canRun) return;
    setLintLoading(true);
    setLintError(null);
    try {
      const res = await fetch('/api/lint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, fields: { jobTitle, responsibilities: text } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setLintResult(data);
    } catch (err: any) {
      setLintError(err.message);
    } finally {
      setLintLoading(false);
    }
  };

  const runBias = async () => {
    if (!canRun) return;
    setBiasLoading(true);
    setBiasError(null);
    try {
      const res = await fetch('/api/v5/bias-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language, packs: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setBiasReport(data.report);
    } catch (err: any) {
      setBiasError(err.message);
    } finally {
      setBiasLoading(false);
    }
  };

  const runRewrite = async () => {
    if (!canRun) return;
    setRewriteLoading(true);
    setRewriteError(null);
    try {
      const res = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, fields: { jobTitle, responsibilities: text } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRewriteResult(data);
    } catch (err: any) {
      setRewriteError(err.message);
    } finally {
      setRewriteLoading(false);
    }
  };

  const diff = useMemo(() => {
    if (!rewriteResult) return [];
    return wordDiff(rewriteResult.before.text, rewriteResult.after.text);
  }, [rewriteResult]);

  // Run all checks on demand
  const runAll = async () => {
    await Promise.all([runLint(), runBias()]);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border-default bg-surface-card px-6 py-4">
        <div className="mx-auto flex max-w-[1400px] items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">
              JD Hub
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
              Job Description Editor
            </h1>
            <p className="mt-1 max-w-[680px] text-[12px] text-text-muted">
              Edit, lint, check for bias, test hypotheses, and rewrite — all on the same JD text.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'pl')}
              className="rounded-full border border-border-default bg-white px-3 py-1.5 text-[11px] text-text-secondary"
            >
              <option value="en">English</option>
              <option value="pl">Polski</option>
            </select>
            <button
              onClick={runAll}
              disabled={!canRun}
              className="rounded-full bg-brand-gold px-4 py-1.5 text-[11px] font-medium tracking-wide text-white hover:bg-brand-gold/90 disabled:opacity-40"
            >
              Run all checks
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-border-default bg-surface-card px-6">
        <div className="mx-auto flex max-w-[1400px] gap-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'whitespace-nowrap border-b-2 px-4 py-2.5 text-[11px] font-medium transition-colors',
                tab === t.id
                  ? 'border-brand-gold text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-secondary',
              )}
            >
              {t.label}
              {t.id === 'lint' && lintResult && (
                <span className={cn('ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-[9px] font-bold', lintResult.total >= 75 ? 'bg-success-bg text-success' : lintResult.total >= 50 ? 'bg-warning-bg text-warning' : 'bg-danger-bg text-danger')}>
                  {lintResult.total}
                </span>
              )}
              {t.id === 'bias' && biasReport && (
                <span className={cn('ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-[9px] font-bold', biasReport.skewLevel === 'balanced' ? 'bg-success-bg text-success' : biasReport.skewLevel === 'soft_warn' ? 'bg-warning-bg text-warning' : 'bg-danger-bg text-danger')}>
                  {biasReport.flags.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] p-6">
          {/* TAB: Edit */}
          {tab === 'edit' && (
            <div className="rounded-xl border border-border-default bg-white p-5">
              <label className="mb-1 block text-[11px] font-semibold text-text-primary">Job Title</label>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Data Engineer"
                className="mb-4 w-full rounded-md border border-border-default bg-surface-page px-3 py-2 text-sm outline-none focus:border-brand-gold"
              />
              <label className="mb-1 block text-[11px] font-semibold text-text-primary">Job Description (paste or type)</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={20}
                placeholder="Paste the full JD here — purpose, responsibilities, requirements, decision rights, scope, working conditions..."
                className="w-full resize-y rounded-md border border-border-default bg-surface-page p-3 font-mono text-[12px] leading-relaxed outline-none focus:border-brand-gold"
              />
              <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted">
                <span>{charCount.toLocaleString()} chars · {wordCount} words</span>
                <span>{canRun ? '✓ Ready for analysis' : 'Add at least 50 chars to enable analysis'}</span>
              </div>
            </div>
          )}

          {/* TAB: Lint & Analyse */}
          {tab === 'lint' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border-default bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-base font-semibold text-text-primary">Lint &amp; Analyse</h2>
                    <p className="mt-0.5 text-[11px] text-text-muted">25 deterministic rules · Structure 30% · Bias 35% · EUPTD 35%</p>
                  </div>
                  <button onClick={runLint} disabled={!canRun || lintLoading} className="rounded-full bg-brand-gold px-4 py-1.5 text-[11px] font-medium text-white hover:bg-brand-gold/90 disabled:opacity-40">
                    {lintLoading ? 'Analysing…' : lintResult ? 'Re-analyse' : 'Analyse JD'}
                  </button>
                </div>
                {lintError && <div className="mt-3 rounded border border-danger/30 bg-danger-bg p-2 text-xs text-danger">{lintError}</div>}
                {lintResult && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <ScoreCard label="Total" value={lintResult.total} grade={lintResult.grade} />
                    <ScoreCard label="Structure" value={lintResult.structure?.score ?? 0} />
                    <ScoreCard label="Bias" value={lintResult.bias?.score ?? 0} />
                    <ScoreCard label="EUPTD" value={lintResult.euptd?.score ?? 0} />
                  </div>
                )}
                {lintResult && lintResult.findings && lintResult.findings.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      Findings ({lintResult.findings.length})
                    </div>
                    <ul className="space-y-1.5">
                      {lintResult.findings.slice(0, 30).map((f: any, i: number) => (
                        <li key={i} className="rounded-md border border-border-default bg-surface-page px-3 py-2">
                          <div className="flex items-start gap-2">
                            <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase', f.severity === 'high' ? 'bg-danger-bg text-danger' : f.severity === 'medium' ? 'bg-warning-bg text-warning' : 'bg-info-bg text-info')}>
                              {f.severity || 'info'}
                            </span>
                            <div className="flex-1">
                              <div className="text-[11px] text-text-primary"><strong>{f.id}</strong> · {f.message}</div>
                              {f.fix && <div className="mt-0.5 text-[10px] text-text-muted">→ {f.fix}</div>}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Bias Check */}
          {tab === 'bias' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border-default bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-base font-semibold text-text-primary">Bias Check</h2>
                    <p className="mt-0.5 text-[11px] text-text-muted">Lexical · title · structural · Iceland implicit · EIGE coverage</p>
                  </div>
                  <button onClick={runBias} disabled={!canRun || biasLoading} className="rounded-full bg-brand-gold px-4 py-1.5 text-[11px] font-medium text-white hover:bg-brand-gold/90 disabled:opacity-40">
                    {biasLoading ? 'Checking…' : biasReport ? 'Re-check' : 'Run bias check'}
                  </button>
                </div>
                {biasError && <div className="mt-3 rounded border border-danger/30 bg-danger-bg p-2 text-xs text-danger">{biasError}</div>}
                {biasReport && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {/* Skew + EIGE summary */}
                    <div className="rounded-lg border border-border-default p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-gold">Agentic ↔ Communal skew</div>
                      <div className="mt-1 font-display text-2xl font-semibold text-text-primary">
                        {biasReport.skewScore > 0 ? '+' : ''}{biasReport.skewScore.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-text-muted">
                        {biasReport.agenticCount} agentic · {biasReport.communalCount} communal ·{' '}
                        <span className={cn('font-semibold', biasReport.skewLevel === 'balanced' ? 'text-success' : biasReport.skewLevel === 'soft_warn' ? 'text-warning' : 'text-danger')}>
                          {biasReport.skewLevel}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border-default p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-gold">EIGE effort coverage</div>
                      <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                        {(['cognitive', 'emotional', 'physical'] as const).map((k) => (
                          <div key={k} className={cn('rounded p-1.5 text-[10px]', biasReport.eigeCoverage[k] ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger')}>
                            <div className="font-bold">{biasReport.eigeCoverage[k] ? '✓' : '✗'}</div>
                            <div>{k}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {biasReport && biasReport.flags.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      Flags ({biasReport.flags.length})
                    </div>
                    <ul className="space-y-1">
                      {biasReport.flags.slice(0, 30).map((f, i) => (
                        <li key={i} className={cn('rounded border-l-2 px-2 py-1.5 text-[11px]', SEVERITY_BORDER[f.severity], SEVERITY_BG[f.severity])}>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono font-semibold">{f.matched}</span>
                            <span className="text-[9px] uppercase text-text-muted">{f.category} · {f.severity}</span>
                          </div>
                          {f.remediation && <div className="mt-0.5 text-[10px] text-text-muted">→ {f.remediation}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Hypotheses */}
          {tab === 'hypotheses' && (
            <HypothesisPanel jdText={text} language="pl" title="56-hypothesis structural fit" />
          )}

          {/* TAB: AI Rewrite */}
          {tab === 'rewrite' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border-default bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-base font-semibold text-text-primary">AI Rewrite</h2>
                    <p className="mt-0.5 text-[11px] text-text-muted">Lint-guided rewrite — see what changes and how lint score moves.</p>
                  </div>
                  <button onClick={runRewrite} disabled={!canRun || rewriteLoading} className="rounded-full bg-brand-gold px-4 py-1.5 text-[11px] font-medium text-white hover:bg-brand-gold/90 disabled:opacity-40">
                    {rewriteLoading ? 'Rewriting…' : rewriteResult ? 'Re-run' : 'Run rewrite'}
                  </button>
                </div>
                {rewriteError && <div className="mt-3 rounded border border-danger/30 bg-danger-bg p-2 text-xs text-danger">{rewriteError}</div>}
                {rewriteResult && (
                  <>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <ScoreCard label="Before" value={rewriteResult.before.lint.total} grade={rewriteResult.before.lint.grade} />
                      <ScoreCard label="After" value={rewriteResult.after.lint.total} grade={rewriteResult.after.lint.grade} />
                      <div className="rounded-lg border border-border-default bg-surface-page p-3 text-center">
                        <div className="text-[10px] uppercase tracking-wider text-text-muted">Delta</div>
                        <div className={cn('font-display text-2xl font-bold', rewriteResult.delta > 0 ? 'text-success' : rewriteResult.delta < 0 ? 'text-danger' : 'text-text-muted')}>
                          {rewriteResult.delta > 0 ? '+' : ''}{rewriteResult.delta}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-1 rounded-full border border-border-default p-0.5 w-fit">
                      <button onClick={() => setRewriteView('split')} className={cn('rounded-full px-3 py-1 text-[10px]', rewriteView === 'split' ? 'bg-brand-gold text-white' : 'text-text-muted')}>Split</button>
                      <button onClick={() => setRewriteView('diff')} className={cn('rounded-full px-3 py-1 text-[10px]', rewriteView === 'diff' ? 'bg-brand-gold text-white' : 'text-text-muted')}>Diff</button>
                    </div>
                    {rewriteView === 'split' ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-border-default p-3">
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">Before</div>
                          <pre className="whitespace-pre-wrap font-body text-[11px] leading-relaxed text-text-secondary">{rewriteResult.before.text}</pre>
                        </div>
                        <div className="rounded-lg border border-success/30 bg-success-bg/30 p-3">
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-success">After</div>
                          <pre className="whitespace-pre-wrap font-body text-[11px] leading-relaxed text-text-primary">{rewriteResult.after.text}</pre>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-border-default bg-white p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
                        {diff.map((seg, i) =>
                          seg.op === 'eq' ? <span key={i} className="text-text-secondary">{seg.text}</span> :
                          seg.op === 'add' ? <span key={i} className="bg-success-bg text-success">{seg.text}</span> :
                          <span key={i} className="bg-danger-bg text-danger line-through">{seg.text}</span>
                        )}
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => { setText(rewriteResult.after.text); setTab('edit'); }}
                        className="rounded-full bg-brand-gold px-4 py-1.5 text-[11px] font-medium text-white hover:bg-brand-gold/90"
                      >
                        Accept rewrite — apply to draft
                      </button>
                      <button
                        onClick={() => setRewriteResult(null)}
                        className="rounded-full border border-border-default px-4 py-1.5 text-[11px] font-medium text-text-secondary"
                      >
                        Discard
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ label, value, grade }: { label: string; value: number; grade?: string }) {
  const colour = value >= 75 ? 'text-success' : value >= 50 ? 'text-warning' : 'text-danger';
  return (
    <div className="rounded-lg border border-border-default bg-surface-page p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className={cn('font-display text-2xl font-bold', colour)}>{value}</div>
      {grade && <div className="text-[9px] uppercase tracking-wider text-text-muted">Grade {grade}</div>}
    </div>
  );
}
