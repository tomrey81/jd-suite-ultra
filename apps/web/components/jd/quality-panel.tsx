'use client';

import { useMemo, useState } from 'react';
import { useJDStore } from '@/hooks/use-jd-store';
import { CRITERIA, EVAL_CATEGORIES } from '@jd-suite/types';
import { cn } from '@/lib/utils';

// 16-criterion → JD section, so a fix is one click away
const CRITERIA_TO_SECTION: Record<number, string> = {
  1: 'C', 2: 'E', 3: 'E', 4: 'F', 5: 'G',
  6: 'G', 7: 'E', 8: 'I', 9: 'E',
  10: 'H', 11: 'H', 12: 'H', 13: 'H', 14: 'D', 15: 'F',
  16: 'I',
};

// Spec §7 — the 4 EUPTD axes are what the directive cares about. We use the
// same categories the data already groups by (EVAL_CATEGORIES) but rename to
// the EUPTD-canonical labels so users see exactly what regulators expect.
const AXIS_LABELS: Record<string, string> = {
  'Knowledge and Skills': 'Skills',
  'Effort': 'Effort',
  'Responsibility': 'Responsibility',
  'Work Environment': 'Working Conditions',
};

type Status = 'sufficient' | 'partial' | 'insufficient';

const STATUS_COLOR: Record<Status, { fg: string; bg: string; bar: string; label: string }> = {
  sufficient: { fg: 'text-success', bg: 'bg-success-bg', bar: '#2E7A3C', label: 'OK' },
  partial: { fg: 'text-warning', bg: 'bg-warning-bg', bar: '#8A6800', label: 'Partial' },
  insufficient: { fg: 'text-danger', bg: 'bg-danger-bg', bar: '#C0350A', label: 'Gap' },
};

// Map a status to a numeric score so we can aggregate per axis.
function statusToScore(s: Status): number {
  if (s === 'sufficient') return 100;
  if (s === 'partial') return 55;
  return 15;
}

interface AxisRollup {
  key: string;
  label: string;
  color: string;
  score: number;          // 0..100
  status: Status;
  total: number;
  ok: number;
  partial: number;
  gap: number;
  gapItems: Array<{ id: number; name: string; section: string | null; hint: string }>;
}

function computeAxes(evalResult: { criteria: Array<{ id: number; name?: string; status: Status; gaps?: string[] }> } | null): AxisRollup[] {
  if (!evalResult) return [];
  return EVAL_CATEGORIES.map((cat) => {
    const items = evalResult.criteria.filter((c) => (cat.ids as readonly number[]).includes(c.id));
    if (items.length === 0) {
      return {
        key: cat.name, label: AXIS_LABELS[cat.name] || cat.name, color: cat.col,
        score: 0, status: 'insufficient' as Status, total: 0, ok: 0, partial: 0, gap: 0, gapItems: [],
      };
    }
    const score = Math.round(items.reduce((a, c) => a + statusToScore(c.status), 0) / items.length);
    const status: Status = score >= 75 ? 'sufficient' : score >= 50 ? 'partial' : 'insufficient';
    const ok = items.filter((c) => c.status === 'sufficient').length;
    const partial = items.filter((c) => c.status === 'partial').length;
    const gap = items.filter((c) => c.status === 'insufficient').length;
    const gapItems = items
      .filter((c) => c.status !== 'sufficient')
      .map((c) => {
        const meta = CRITERIA.find((x) => x.id === c.id);
        return {
          id: c.id,
          name: c.name || meta?.name || `Criterion ${c.id}`,
          section: CRITERIA_TO_SECTION[c.id] || null,
          hint: c.gaps?.[0] || (c.status === 'partial' ? 'Add more detail or evidence.' : 'Missing — add this section.'),
        };
      });
    return { key: cat.name, label: AXIS_LABELS[cat.name] || cat.name, color: cat.col, score, status, total: items.length, ok, partial, gap, gapItems };
  });
}

interface Verdict {
  level: 'ready' | 'review' | 'not_ready';
  headline: string;
  detail: string;
  emoji: string;
  color: string;
  bgClass: string;
}

function computeVerdict(axes: AxisRollup[], dqsScore: number): Verdict {
  if (axes.length === 0) {
    return {
      level: 'not_ready',
      headline: 'Not yet evaluated',
      detail: 'Run the EUPTD 4-axis evaluation to see whether this JD is ready.',
      emoji: '○',
      color: '#8A7560',
      bgClass: 'bg-surface-page',
    };
  }
  const minAxis = Math.min(...axes.map((a) => a.score));
  const totalGaps = axes.reduce((a, b) => a + b.gap, 0);
  const overall = Math.round(axes.reduce((a, b) => a + b.score, 0) / axes.length);

  // Combine evaluation + completeness for the verdict
  const combined = Math.round(overall * 0.7 + dqsScore * 0.3);

  if (totalGaps === 0 && minAxis >= 75 && combined >= 80) {
    return {
      level: 'ready',
      headline: 'Looks good',
      detail: 'All four EUPTD axes are covered. This JD is regulator-defensible.',
      emoji: '✓',
      color: '#2E7A3C',
      bgClass: 'bg-success-bg',
    };
  }
  if (minAxis < 50 || totalGaps >= 4) {
    return {
      level: 'not_ready',
      headline: 'Needs significant work',
      detail: `${totalGaps} criterion${totalGaps !== 1 ? 'a' : ''} missing across ${axes.filter((a) => a.gap > 0).length} axis${axes.filter((a) => a.gap > 0).length !== 1 ? 'es' : ''}. Fix the items below before sign-off.`,
      emoji: '✗',
      color: '#C0350A',
      bgClass: 'bg-danger-bg',
    };
  }
  const weakest = axes.reduce((w, a) => a.score < w.score ? a : w, axes[0]);
  return {
    level: 'review',
    headline: 'Needs review',
    detail: `${weakest.label} is the weakest axis (${weakest.score}%). Fix the top items below to ship.`,
    emoji: '⚠',
    color: '#8A6800',
    bgClass: 'bg-warning-bg',
  };
}

function ScoreCircle({ score, size = 'lg' }: { score: number; size?: 'sm' | 'lg' }) {
  const r = size === 'lg' ? 28 : 18;
  const sz = size === 'lg' ? 70 : 46;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const col = score >= 75 ? '#2E7A3C' : score >= 50 ? '#8A6800' : '#C0350A';
  return (
    <svg width={sz} height={sz}>
      <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke="#EDE9E0" strokeWidth={size === 'lg' ? 6 : 4} />
      <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke={col}
        strokeWidth={size === 'lg' ? 6 : 4}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${sz / 2} ${sz / 2})`} />
      <text x={sz / 2} y={sz / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        style={{ fontFamily: "'Playfair Display',serif", fontSize: size === 'lg' ? 16 : 11, fontWeight: 700, fill: col }}>
        {score}%
      </text>
    </svg>
  );
}

export function QualityPanel() {
  const { dqsScore, escoMatch, evalResult, evalLoading, fieldScores, templateSections, jd, setActiveSectionId } = useJDStore();
  const [tab, setTab] = useState<'verdict' | 'completeness'>('verdict');
  const [expandedAxis, setExpandedAxis] = useState<string | null>(null);

  const axes = useMemo(() => computeAxes(evalResult as never), [evalResult]);
  const overall = axes.length > 0
    ? Math.round(axes.reduce((a, b) => a + b.score, 0) / axes.length)
    : 0;
  const verdict = useMemo(() => computeVerdict(axes, dqsScore), [axes, dqsScore]);

  // Top fixes — flatten all gap items, prioritise insufficient over partial, dedupe by section
  const topFixes = useMemo(() => {
    const all: Array<{ axisLabel: string; axisColor: string; id: number; name: string; section: string | null; hint: string; severity: number }> = [];
    for (const a of axes) {
      for (const g of a.gapItems) {
        const severity = a.gap > 0 ? 2 : 1; // weight insufficient axes higher
        all.push({ axisLabel: a.label, axisColor: a.color, ...g, severity });
      }
    }
    return all.sort((a, b) => b.severity - a.severity).slice(0, 5);
  }, [axes]);

  const handleRunEval = async () => {
    const { setEvalLoading, setEvalResult } = useJDStore.getState();
    setEvalLoading(true);
    setEvalResult(null);
    try {
      const jdText = Object.entries(jd)
        .filter(([, v]) => v?.trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
      const res = await fetch('/api/ai/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText }),
      });
      if (res.ok) setEvalResult(await res.json());
    } catch {/* silent */} finally {
      setEvalLoading(false);
    }
  };

  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col border-l border-border-default bg-white">
      {/* Tabs */}
      <div className="border-b border-border-default px-4 pt-3">
        <div className="mb-[7px] font-display text-[13px] font-semibold text-text-primary">JD Readiness</div>
        <div className="flex gap-3">
          {(['verdict', 'completeness'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={cn(
                'border-b-2 pb-1.5 font-body text-[11px] font-medium transition-colors',
                tab === t ? 'border-brand-gold text-text-primary' : 'border-transparent text-text-muted',
              )}>
              {t === 'verdict' ? 'EUPTD verdict' : 'Completeness'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'verdict' && (
        <div className="flex-1 overflow-y-auto">
          {evalLoading && (
            <div className="flex flex-col items-center justify-center gap-2.5 p-8 text-center">
              <div className="h-[26px] w-[26px] animate-spin rounded-full border-[3px] border-border-default border-t-brand-gold" />
              <div className="text-[11px] italic text-text-secondary">Evaluating against EUPTD 4 axes…</div>
            </div>
          )}

          {!evalLoading && !evalResult && (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <div className="text-2xl opacity-30">◆</div>
              <div className="font-display text-[13px] text-text-primary">EUPTD readiness check</div>
              <p className="text-[11px] leading-relaxed text-text-secondary">
                Tests this JD against the four EU Pay Transparency Directive 2023/970 axes:
                <br /><strong>Skills</strong> · <strong>Effort</strong> · <strong>Responsibility</strong> · <strong>Working Conditions</strong>.
              </p>
              <button onClick={handleRunEval} disabled={!jd.jobTitle}
                className="mt-2 rounded-md bg-brand-gold px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-40">
                Run readiness check
              </button>
            </div>
          )}

          {!evalLoading && evalResult && (
            <>
              {/* ── Verdict block ─────────────────────────────────────────── */}
              <div className={cn('flex flex-col gap-2 border-b-2 p-4', verdict.bgClass)}
                style={{ borderColor: verdict.color }}>
                <div className="flex items-center gap-3">
                  <div className="text-2xl leading-none" style={{ color: verdict.color }}>{verdict.emoji}</div>
                  <div className="flex-1">
                    <div className="font-display text-[15px] font-bold leading-tight" style={{ color: verdict.color }}>
                      {verdict.headline}
                    </div>
                    <div className="text-[11px] leading-snug text-text-secondary">{verdict.detail}</div>
                  </div>
                  <ScoreCircle score={overall} size="lg" />
                </div>
              </div>

              {/* ── 4-axis summary ────────────────────────────────────────── */}
              <div className="px-4 py-3">
                <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                  <span>EUPTD axes</span>
                  <span>{axes.filter((a) => a.status === 'sufficient').length}/{axes.length} OK</span>
                </div>
                <div className="space-y-2">
                  {axes.map((a) => {
                    const expanded = expandedAxis === a.key;
                    const sCol = STATUS_COLOR[a.status];
                    return (
                      <div key={a.key} className="rounded-lg border border-border-default bg-white">
                        <button
                          type="button"
                          onClick={() => setExpandedAxis(expanded ? null : a.key)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left">
                          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: a.color }} />
                          <span className="flex-1 truncate text-[12px] font-semibold text-text-primary">{a.label}</span>
                          <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold uppercase', sCol.bg, sCol.fg)}>
                            {sCol.label}
                          </span>
                          <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: sCol.bar }}>
                            {a.score}%
                          </span>
                          <span className="text-text-muted">{expanded ? '▾' : '▸'}</span>
                        </button>
                        {/* Bar */}
                        <div className="mx-3 mb-2 h-1.5 overflow-hidden rounded-full bg-[#EDE9E0]">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${a.score}%`, background: sCol.bar }} />
                        </div>
                        {/* Per-criterion breakdown when expanded */}
                        {expanded && (
                          <div className="border-t border-border-default px-3 py-2">
                            <div className="mb-1.5 flex gap-3 text-[9px] uppercase tracking-wider text-text-muted">
                              <span>{a.ok} ✓</span>
                              <span>{a.partial} partial</span>
                              <span>{a.gap} gap{a.gap !== 1 ? 's' : ''}</span>
                              <span className="ml-auto">{a.total} total</span>
                            </div>
                            {a.gapItems.length === 0 ? (
                              <div className="text-[10px] italic text-success">All criteria covered.</div>
                            ) : (
                              <ul className="space-y-1">
                                {a.gapItems.map((g) => (
                                  <li key={g.id}
                                    onClick={() => g.section && setActiveSectionId(g.section)}
                                    className="cursor-pointer rounded border-l-2 px-2 py-1 text-[10.5px] hover:bg-surface-page"
                                    style={{ borderColor: a.color }}
                                    title={g.section ? `Click to jump to Section ${g.section}` : ''}>
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="truncate font-medium text-text-primary">{g.name}</span>
                                      {g.section && (
                                        <span className="shrink-0 text-[9px] text-brand-gold">§{g.section} →</span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-text-muted">{g.hint}</div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Top fixes (action list) ───────────────────────────────── */}
              {topFixes.length > 0 && (
                <div className="border-t border-border-default bg-surface-page px-4 py-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                    Top {topFixes.length} thing{topFixes.length !== 1 ? 's' : ''} to fix
                  </div>
                  <ul className="space-y-1.5">
                    {topFixes.map((f) => (
                      <li key={f.id}
                        onClick={() => f.section && setActiveSectionId(f.section)}
                        className="flex cursor-pointer items-start gap-2 rounded border border-transparent px-2 py-1.5 hover:border-brand-gold hover:bg-white">
                        <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: f.axisColor }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium leading-tight text-text-primary">{f.name}</div>
                          <div className="text-[10px] text-text-muted">{f.hint}</div>
                          <div className="mt-0.5 text-[9px] uppercase tracking-wider text-text-muted">
                            {f.axisLabel}{f.section && <> · go to §{f.section} →</>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t border-border-default p-3">
                <button onClick={handleRunEval}
                  className="w-full rounded border border-border-default bg-white py-1.5 font-body text-[11px] text-text-secondary hover:border-brand-gold">
                  Re-run readiness check
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'completeness' && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center gap-1.5 border-b border-border-default p-4">
            <ScoreCircle score={dqsScore} size="lg" />
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
              Document completeness
            </div>
            <div className="text-center text-[11px] leading-snug text-text-muted">
              How filled-in the JD template is. Different from EUPTD readiness.
            </div>
            {escoMatch?.code && (
              <div className="mt-1 rounded-md bg-info-bg px-2.5 py-1 text-center text-[10.5px] leading-snug text-info">
                ESCO: {escoMatch.title}
              </div>
            )}
          </div>
          <div className="px-4 py-2.5">
            {templateSections.map((sec) =>
              sec.fields
                .filter((f) => f.priority === 'must' || f.priority === 'helpful')
                .map((f) => {
                  const sc = fieldScores[f.id];
                  if (!sc) return null;
                  const status: Status = sc.badge === 'good' ? 'sufficient' : sc.badge === 'needs-work' ? 'partial' : 'insufficient';
                  const c = STATUS_COLOR[status];
                  return (
                    <div key={f.id} className="flex items-center justify-between gap-[7px] border-b border-surface-page py-[5px]">
                      <span className="min-w-0 flex-1 truncate text-[11px] text-text-secondary" title={f.label}>
                        {f.label}
                      </span>
                      <span className={cn('inline-flex shrink-0 items-center gap-[3px] rounded-full px-[7px] py-0.5 text-[10px] font-semibold', c.bg, c.fg)}>
                        <span className={cn('inline-block h-1 w-1 rounded-full', c.fg === 'text-success' ? 'bg-success' : c.fg === 'text-warning' ? 'bg-warning' : 'bg-danger')} />
                        {c.label}
                      </span>
                    </div>
                  );
                }),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
