'use client';

import { useRouter } from 'next/navigation';
import { useJDStore, type EndSessionResult } from '@/hooks/use-jd-store';

export function EndSessionModal() {
  const router = useRouter();
  const {
    showEndSession, endSessionLoading, endSessionResult, endSessionError,
    setShowEndSession, setEndSessionResult,
  } = useJDStore();

  if (!showEndSession) return null;

  const handleClose = () => {
    setShowEndSession(false);
    setEndSessionResult(null);
  };

  const handleGoToWorkspace = () => {
    handleClose();
    router.push('/');
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 p-5">
      <div className="max-h-[88vh] w-full max-w-[640px] overflow-y-auto rounded-xl bg-white shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3.5 border-b border-border-default bg-white p-[20px_24px]">
          <div>
            <h2 className="mb-[3px] font-display text-xl font-bold text-text-primary">Session saved</h2>
            <p className="text-xs text-text-secondary">
              Your draft is saved. Here is your AI session summary to pick up where you left off.
            </p>
          </div>
          <button type="button" onClick={handleClose} className="shrink-0 text-xl leading-none text-text-muted hover:text-text-primary">×</button>
        </div>

        <div className="p-[20px_24px]">
          {/* Loading */}
          {endSessionLoading && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-border-default border-t-brand-gold" />
              <p className="text-[13px] italic text-text-secondary">Generating session summary…</p>
            </div>
          )}

          {/* Error with graceful fallback */}
          {!endSessionLoading && endSessionError && (
            <div className="mb-4 rounded-lg border border-border-default bg-surface-page p-4">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                AI summary unavailable
              </div>
              <p className="mb-3 text-sm text-text-secondary">{endSessionError}</p>
              <p className="text-xs text-text-muted">
                Your draft was saved successfully. You can continue editing or return to the workspace.
              </p>
            </div>
          )}

          {/* Result */}
          {!endSessionLoading && endSessionResult && <SessionSummaryContent result={endSessionResult} />}

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-border-default pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-border-default px-4 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold"
            >
              Continue editing
            </button>
            <button
              type="button"
              onClick={handleGoToWorkspace}
              className="rounded-md bg-surface-header px-4 py-1.5 text-xs font-medium text-text-on-dark"
            >
              Go to Workspace →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionSummaryContent({ result }: { result: EndSessionResult }) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg border border-border-default bg-surface-page p-3.5">
        <div className="mb-[7px] text-[9px] font-bold uppercase tracking-[0.1em] text-text-muted">Session summary</div>
        <p className="text-[13px] leading-relaxed text-text-primary">{result.sessionSummary}</p>
      </div>

      {/* Quality gain */}
      {result.estimatedQualityGain && (
        <div className="rounded-lg border border-info-bg bg-info-bg px-3.5 py-2.5">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.1em] text-info">Estimated quality impact</div>
          <p className="text-xs leading-normal text-info">{result.estimatedQualityGain}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Completed well */}
        {result.completedWell?.length > 0 && (
          <div>
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-success">
              Completed well
            </div>
            {result.completedWell.map((item, i) => (
              <div key={i} className="mb-[5px] flex items-start gap-2 text-xs leading-normal text-text-secondary">
                <span className="mt-px shrink-0 text-success">✓</span>
                {item}
              </div>
            ))}
          </div>
        )}

        {/* Must complete */}
        {result.mustComplete?.length > 0 && (
          <div>
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-danger">
              Still needed
            </div>
            {result.mustComplete.map((item, i) => (
              <div key={i} className="mb-2 rounded-md border border-[#F5E0D8] bg-danger-bg p-2">
                <div className="mb-0.5 font-mono text-[10px] font-bold text-danger">{item.field}</div>
                <p className="text-[11px] leading-normal text-text-secondary">{item.why}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Questions for next session */}
      {result.questionsForNextSession?.length > 0 && (
        <div>
          <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-warning">
            Questions for next session
          </div>
          {result.questionsForNextSession.map((q, i) => (
            <div key={i} className="mb-[6px] flex items-start gap-2 text-xs leading-normal text-text-secondary">
              <span className="mt-px shrink-0 font-bold text-warning">?</span>
              {q}
            </div>
          ))}
        </div>
      )}

      {/* AI enhancements */}
      {result.aiEnhancements?.length > 0 && (
        <div className="rounded-lg border border-brand-gold-light bg-brand-gold-lighter p-3">
          <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-brand-gold">
            AI enhancement suggestions
          </div>
          {result.aiEnhancements.map((tip, i) => (
            <div key={i} className="mb-[5px] flex items-start gap-2 text-xs leading-normal text-text-secondary">
              <span className="mt-px shrink-0 text-brand-gold">◆</span>
              {tip}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
