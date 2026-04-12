'use client';

import { useJDStore } from '@/hooks/use-jd-store';

export function HonestReviewModal() {
  const {
    showHonestReview, honestReview, honestReviewLoading, honestReviewError,
    setShowHonestReview, setHonestReview,
    setEvalLoading, setEvalResult, jd, templateSections, dqsScore,
  } = useJDStore();

  if (!showHonestReview) return null;

  const handleClose = () => {
    setShowHonestReview(false);
  };

  // Trigger evaluation and switch to eval tab in QualityPanel
  const handleRunEval = async () => {
    handleClose();
    const { buildText } = await import('@/lib/jd-helpers');
    const jdText = buildText(jd, templateSections);
    setEvalLoading(true);
    setEvalResult(null);
    try {
      const res = await fetch('/api/ai/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText }),
      });
      if (res.ok) setEvalResult(await res.json());
    } catch {
      // silently fail — user sees empty eval panel with retry
    } finally {
      setEvalLoading(false);
    }
  };

  const VERDICT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
    'Ready': { text: 'text-success', bg: 'bg-success-bg', border: 'border-success' },
    'Needs work': { text: 'text-warning', bg: 'bg-warning-bg', border: 'border-warning' },
    'Not ready': { text: 'text-danger', bg: 'bg-danger-bg', border: 'border-danger' },
  };
  const DRIVE_COLORS: Record<string, string> = {
    yes: 'text-success', no: 'text-danger', conditional: 'text-warning',
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 p-5">
      <div className="max-h-[88vh] w-full max-w-[680px] overflow-y-auto rounded-xl bg-white shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3.5 border-b border-border-default bg-white p-[22px_26px]">
          <div>
            <h2 className="mb-[3px] font-display text-xl font-bold text-text-primary">Honest Review</h2>
            <p className="text-xs text-text-secondary">
              AI assessment based on JD Suite quality standards. Not a final approval — human decides.
            </p>
          </div>
          <button type="button" onClick={handleClose} className="shrink-0 text-xl leading-none text-text-muted hover:text-text-primary">×</button>
        </div>

        <div className="p-[22px_26px]">
          {/* Loading */}
          {honestReviewLoading && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-border-default border-t-[#4F46E5]" />
              <p className="text-[13px] italic text-text-secondary">Claude is reviewing the JD…</p>
              <p className="text-[11px] text-text-muted">This takes 10–20 seconds</p>
            </div>
          )}

          {/* Error with retry guidance */}
          {!honestReviewLoading && honestReviewError && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="text-3xl opacity-30">◆</div>
              <p className="text-sm font-medium text-text-primary">Review could not be completed</p>
              <p className="max-w-[380px] text-xs leading-relaxed text-text-secondary">{honestReviewError}</p>
              <p className="text-[11px] text-text-muted">Close and try again, or run the 16-criteria evaluation separately.</p>
            </div>
          )}

          {/* Result */}
          {!honestReviewLoading && honestReview && (() => {
            const vc = VERDICT_COLORS[honestReview.verdict] || VERDICT_COLORS['Needs work'];
            return (
              <>
                {/* Verdict + Decision cards */}
                <div className="mb-5 flex flex-wrap gap-4">
                  <div className={`min-w-[180px] flex-1 rounded-lg border p-4 ${vc.bg} ${vc.border}`}>
                    <div className="mb-[5px] text-[9px] font-bold uppercase tracking-[0.12em] text-text-muted">Verdict</div>
                    <div className={`mb-[5px] font-display text-xl font-bold ${vc.text}`}>
                      {honestReview.verdict}
                    </div>
                    <p className="text-xs leading-normal text-text-secondary">{honestReview.verdictReason}</p>
                  </div>
                  <div className="min-w-[180px] flex-1 rounded-lg border border-border-default bg-surface-page p-4">
                    <div className="mb-[5px] text-[9px] font-bold uppercase tracking-[0.12em] text-text-muted">
                      Drives a decision today?
                    </div>
                    <div className={`mb-[5px] font-display text-xl font-bold capitalize ${DRIVE_COLORS[honestReview.drivesDecisionToday] || ''}`}>
                      {honestReview.drivesDecisionToday}
                    </div>
                    <p className="text-xs leading-normal text-text-secondary">{honestReview.drivesDecisionReason}</p>
                  </div>
                </div>

                {/* Narrative */}
                <div className="mb-[18px] rounded-lg border border-border-default bg-surface-page p-3.5">
                  <div className="mb-[7px] text-[9px] font-bold uppercase tracking-[0.1em] text-text-muted">Overall assessment</div>
                  <p className="text-[13px] leading-relaxed text-text-primary">{honestReview.overallNarrative}</p>
                </div>

                {/* Top priority */}
                {honestReview.topPriority && (
                  <div className="mb-[18px] rounded-lg border-[1.5px] border-[#F5C4A8] bg-danger-bg p-3">
                    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-danger">Top priority fix</div>
                    <p className="text-[13px] font-medium leading-normal text-text-primary">{honestReview.topPriority}</p>
                  </div>
                )}

                {/* Weaknesses */}
                {honestReview.topWeaknesses?.length > 0 && (
                  <div className="mb-[18px]">
                    <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-danger">Specific weaknesses</div>
                    {honestReview.topWeaknesses.map((w, i) => (
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
                {honestReview.auditorObjections?.length > 0 && (
                  <div className="mb-5">
                    <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-info">
                      What a pay equity auditor would object to
                    </div>
                    {honestReview.auditorObjections.map((o, i) => (
                      <div key={i} className="mb-[7px] flex gap-[9px] text-xs leading-normal text-text-secondary">
                        <span className="shrink-0 font-bold text-info">{i + 1}.</span>
                        {o}
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer actions */}
                <div className="flex flex-wrap items-center justify-between border-t border-border-default pt-4">
                  <p className="max-w-[340px] text-[10.5px] leading-normal text-text-muted">
                    AI-generated. Human decision required. DC: {dqsScore}%
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleRunEval}
                      className="rounded-md bg-cat-skills px-3 py-1.5 text-xs font-medium text-white">
                      Run 16 Criteria →
                    </button>
                    <button type="button" onClick={handleClose}
                      className="rounded-md bg-surface-header px-3 py-1.5 text-xs font-medium text-text-on-dark">
                      Continue editing
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
