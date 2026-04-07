'use client';

import { useState } from 'react';
import { useJDStore } from '@/hooks/use-jd-store';
import { CRITERIA, EVAL_CATEGORIES } from '@jd-suite/types';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  sufficient: { text: 'text-success', bg: 'bg-success-bg', label: 'OK' },
  partial: { text: 'text-warning', bg: 'bg-warning-bg', label: 'Part.' },
  insufficient: { text: 'text-danger', bg: 'bg-danger-bg', label: 'Gap' },
} as const;

function ScoreGauge({ score, label, size = 'sm' }: { score: number; label?: string; size?: 'sm' | 'lg' }) {
  const r = size === 'lg' ? 38 : 22;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const col = score >= 75 ? '#2E7A3C' : score >= 50 ? '#8A6800' : '#C0350A';
  const sz = size === 'lg' ? 90 : 60;

  return (
    <div className="flex flex-col items-center gap-[3px]">
      <svg width={sz} height={sz}>
        <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke="#EDE9E0" strokeWidth={size === 'lg' ? 8 : 5} />
        <circle
          cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke={col}
          strokeWidth={size === 'lg' ? 8 : 5}
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${sz / 2} ${sz / 2})`}
          className="transition-[stroke-dasharray] duration-600"
        />
        <text
          x={sz / 2} y={sz / 2 + 1} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: "'Playfair Display',serif", fontSize: size === 'lg' ? 18 : 12, fontWeight: 700, fill: col }}
        >
          {score}%
        </text>
      </svg>
      {label && (
        <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted">{label}</div>
      )}
    </div>
  );
}

export function QualityPanel() {
  const [tab, setTab] = useState<'quality' | 'eval'>('quality');
  const { dqsScore, escoMatch, evalResult, evalLoading, fieldScores, templateSections, jd } = useJDStore();

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
      if (res.ok) {
        setEvalResult(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setEvalLoading(false);
    }
  };

  const cr = evalResult?.criteria || [];

  return (
    <div className="flex h-full w-[272px] shrink-0 flex-col border-l border-border-default bg-white">
      {/* Tabs */}
      <div className="border-b border-border-default px-4 pt-3">
        <div className="mb-[7px] font-display text-[13px] font-semibold text-text-primary">
          Quality & Evaluation
        </div>
        <div className="flex">
          {(['quality', 'eval'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'border-b-2 px-3 py-1.5 font-body text-[11px] font-medium transition-colors',
                tab === t ? 'border-brand-gold text-text-primary' : 'border-transparent text-text-muted',
              )}
            >
              {t === 'quality' ? 'Document Completeness' : '16 Criteria'}
            </button>
          ))}
        </div>
      </div>

      {/* Quality tab */}
      {tab === 'quality' && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center gap-1.5 border-b border-border-default p-4">
            <ScoreGauge score={dqsScore} size="lg" />
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
              Document Quality Score
            </div>
            {escoMatch?.code && (
              <div className="rounded-md bg-info-bg px-2.5 py-1 text-center text-[10.5px] leading-snug text-info">
                ESCO: {escoMatch.title}
              </div>
            )}
          </div>

          {/* Field scores */}
          <div className="px-4 py-2.5">
            {templateSections.map((sec) =>
              sec.fields
                .filter((f) => f.priority === 'must' || f.priority === 'helpful')
                .map((f) => {
                  const sc = fieldScores[f.id];
                  if (!sc) return null;
                  const badge = STATUS_COLORS[sc.badge === 'good' ? 'sufficient' : sc.badge === 'needs-work' ? 'partial' : 'insufficient'];
                  return (
                    <div key={f.id} className="flex items-center justify-between gap-[7px] border-b border-surface-page py-[5px]">
                      <span className="min-w-0 flex-1 truncate text-[11px] text-text-secondary" title={f.label}>
                        {f.label}
                      </span>
                      <span className={cn('inline-flex shrink-0 items-center gap-[3px] rounded-full px-[7px] py-0.5 text-[10px] font-semibold', badge.bg, badge.text)}>
                        <span className={cn('inline-block h-1 w-1 rounded-full', badge.text === 'text-success' ? 'bg-success' : badge.text === 'text-warning' ? 'bg-warning' : 'bg-danger')} />
                        {badge.label}
                      </span>
                    </div>
                  );
                }),
            )}
          </div>
        </div>
      )}

      {/* Eval tab */}
      {tab === 'eval' && (
        <div className="flex flex-1 flex-col overflow-y-auto">
          {evalLoading && (
            <div className="flex flex-col items-center justify-center gap-2.5 p-8 text-center">
              <div className="h-[26px] w-[26px] animate-spin rounded-full border-[3px] border-border-default border-t-brand-gold" />
              <div className="text-[11px] italic text-text-secondary">Analysing 16 criteria...</div>
            </div>
          )}

          {!evalLoading && !evalResult && (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
              <div className="text-lg opacity-35">◆</div>
              <div className="font-display text-xs">Pay Equity Evaluation</div>
              <div className="text-[11px] leading-relaxed text-text-secondary">
                Run the ILO-aligned 16-criteria evaluation.
              </div>
              <button
                type="button"
                onClick={handleRunEval}
                disabled={!jd.jobTitle}
                className="rounded-md bg-brand-gold px-3 py-1 text-[11px] font-medium text-white disabled:opacity-40"
              >
                Run
              </button>
            </div>
          )}

          {!evalLoading && evalResult && (
            <>
              <div className="flex items-center gap-2 border-b border-border-default bg-surface-page p-[10px_14px]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[2.5px] border-brand-gold font-display text-xs font-bold text-brand-gold">
                  {evalResult.overallCompleteness}%
                </div>
                <div className="text-[11px] leading-normal text-text-secondary">{evalResult.summary}</div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {EVAL_CATEGORIES.map((cat) => {
                  const items = cr.filter((c) => cat.ids.includes(c.id)).sort((a, b) => a.id - b.id);
                  return (
                    <div key={cat.name}>
                      <div
                        className="mt-[3px] border-l-[3px] px-[9px] py-[6px] text-[9px] font-bold uppercase tracking-[0.12em]"
                        style={{ borderColor: cat.col, color: cat.col }}
                      >
                        {cat.name}
                      </div>
                      {items.map((c) => {
                        const meta = CRITERIA.find((x) => x.id === c.id);
                        const st = STATUS_COLORS[c.status] || STATUS_COLORS.insufficient;
                        return (
                          <div
                            key={c.id}
                            className="flex flex-col gap-0.5 border-l-[3px] px-3.5 py-[5px]"
                            style={{ borderColor: st.text === 'text-success' ? '#2E7A3C' : st.text === 'text-warning' ? '#8A6800' : '#C0350A' }}
                          >
                            <div className="flex items-center justify-between gap-[3px]">
                              <span className="min-w-[13px] text-[9px] font-bold text-text-muted">{c.id}.</span>
                              <span className="flex-1 truncate text-[10.5px] font-medium text-text-primary">
                                {c.name || meta?.name}
                              </span>
                              <span className={cn('shrink-0 rounded-md px-1 py-0.5 text-[8.5px] font-semibold uppercase', st.bg, st.text)}>
                                {st.label}
                              </span>
                            </div>
                            {c.gaps?.length > 0 && c.status !== 'sufficient' && (
                              <div className="truncate pl-4 text-[9.5px] text-text-muted">{c.gaps[0]}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleRunEval}
                className="mx-3.5 mb-2.5 mt-2 rounded-md border border-border-default bg-transparent py-[5px] font-body text-[11px] text-text-secondary"
              >
                Re-evaluate
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
