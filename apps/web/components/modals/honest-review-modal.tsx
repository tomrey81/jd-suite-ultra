'use client';

import type { HonestReview } from '@jd-suite/types';

interface HonestReviewModalProps {
  review: HonestReview | null;
  loading: boolean;
  onClose: () => void;
  onRunEval: () => void;
}

const VERDICT_COLORS: Record<string, { text: string; bg: string }> = {
  'Ready': { text: 'text-success', bg: 'bg-success-bg' },
  'Needs work': { text: 'text-warning', bg: 'bg-warning-bg' },
  'Not ready': { text: 'text-danger', bg: 'bg-danger-bg' },
};

const DRIVE_COLORS: Record<string, string> = {
  yes: 'text-success', no: 'text-danger', conditional: 'text-warning',
};

export function HonestReviewModal({ review, loading, onClose, onRunEval }: HonestReviewModalProps) {
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 p-5">
      <div className="max-h-[88vh] w-full max-w-[680px] overflow-y-auto rounded-xl bg-white shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3.5 border-b border-border-default bg-white p-[22px_26px]">
          <div>
            <h2 className="mb-[3px] font-display text-xl font-bold text-text-primary">Honest Review</h2>
            <p className="text-xs text-text-secondary">
              AI assessment based on GPTs-JD-Suite_v4 quality standards. Not a final approval — human decides.
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-xl leading-none text-text-muted">×</button>
        </div>

        <div className="p-[22px_26px]">
          {loading && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-border-default border-t-[#4F46E5]" />
              <p className="text-[13px] italic text-text-secondary">Claude is reviewing the JD...</p>
            </div>
          )}

          {!loading && review && (
            <>
              {/* Verdict + Drives Decision */}
              <div className="mb-5 flex flex-wrap gap-4">
                <div className={`min-w-[180px] flex-1 rounded-lg border p-4 ${VERDICT_COLORS[review.verdict]?.bg || 'bg-surface-page'}`}
                  style={{ borderColor: 'currentcolor' }}>
                  <div className="mb-[5px] text-[9px] font-bold uppercase tracking-[0.12em] text-text-muted">Verdict</div>
                  <div className={`mb-[5px] font-display text-xl font-bold ${VERDICT_COLORS[review.verdict]?.text || ''}`}>
                    {review.verdict}
                  </div>
                  <p className="text-xs leading-normal text-text-secondary">{review.verdictReason}</p>
                </div>
                <div className="min-w-[180px] flex-1 rounded-lg border border-border-default bg-surface-page p-4">
                  <div className="mb-[5px] text-[9px] font-bold uppercase tracking-[0.12em] text-text-muted">Drives a decision today?</div>
                  <div className={`mb-[5px] font-display text-xl font-bold capitalize ${DRIVE_COLORS[review.drivesDecisionToday] || ''}`}>
                    {review.drivesDecisionToday}
                  </div>
                  <p className="text-xs leading-normal text-text-secondary">{review.drivesDecisionReason}</p>
                </div>
              </div>

              {/* Narrative */}
              <div className="mb-[18px] rounded-lg border border-border-default bg-surface-page p-3.5">
                <div className="mb-[7px] text-[9px] font-bold uppercase tracking-[0.1em] text-text-muted">Overall assessment</div>
                <p className="text-[13px] leading-relaxed text-text-primary">{review.overallNarrative}</p>
              </div>

              {/* Top priority */}
              {review.topPriority && (
                <div className="mb-[18px] rounded-lg border-[1.5px] border-[#F5C4A8] bg-danger-bg p-3">
                  <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-danger">Top priority fix</div>
                  <p className="text-[13px] font-medium leading-normal text-text-primary">{review.topPriority}</p>
                </div>
              )}

              {/* Weaknesses */}
              {review.topWeaknesses?.length > 0 && (
                <div className="mb-[18px]">
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-danger">Specific weaknesses</div>
                  {review.topWeaknesses.map((w, i) => (
                    <div key={i} className="mb-2 rounded-lg border border-[#F5E4A0] bg-warning-bg p-3">
                      <span className="mb-1 inline-block rounded bg-[#FEF3C7] px-1.5 py-0.5 font-mono text-[10px] font-bold text-warning">
                        {w.field}
                      </span>
                      <p className="mb-1 text-xs leading-normal text-text-primary">{w.issue}</p>
                      <p className="text-xs text-success">→ {w.fix}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Auditor objections */}
              {review.auditorObjections?.length > 0 && (
                <div className="mb-5">
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-info">
                    What a pay equity auditor would object to
                  </div>
                  {review.auditorObjections.map((o, i) => (
                    <div key={i} className="mb-[7px] flex gap-[9px] text-xs leading-normal text-text-secondary">
                      <span className="shrink-0 font-bold text-info">{i + 1}.</span>
                      {o}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between border-t border-border-default pt-4">
                <p className="max-w-[340px] text-[10.5px] leading-normal text-text-muted">
                  This review is AI-generated. Human decision required.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={onRunEval}
                    className="rounded-md bg-cat-skills px-3 py-1.5 text-xs font-medium text-white">
                    Run 16 Criteria →
                  </button>
                  <button type="button" onClick={onClose}
                    className="rounded-md bg-surface-header px-3 py-1.5 text-xs font-medium text-text-on-dark">
                    Continue editing
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
