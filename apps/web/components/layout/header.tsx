'use client';

import { signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useJDStore } from '@/hooks/use-jd-store';
import { buildText } from '@/lib/jd-helpers';
import { cn } from '@/lib/utils';

interface HeaderProps {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
}

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const isJDEditor = pathname.startsWith('/jd/') && pathname !== '/jd/new';

  return (
    <header className="flex h-[54px] shrink-0 items-center justify-between bg-surface-header px-5">
      {/* Left: Branding + JD title */}
      <div className="flex items-center gap-3">
        <a href="/" className="cursor-pointer">
          <div className="font-display text-[15px] font-semibold text-text-on-dark">
            Quadrance <span className="text-brand-gold-light">JD Suite</span>
          </div>
          <div className="text-[9px] uppercase tracking-[0.12em] text-brand-gold opacity-70">
            Origometrics Platform
          </div>
        </a>
        {isJDEditor && <JDHeaderControls />}
      </div>

      {/* Right: User */}
      <div className="flex items-center gap-3">
        {isJDEditor && <JDHeaderActions />}
        <span className="text-xs text-text-on-dark/50">{user.name || user.email}</span>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="rounded-md border border-white/10 px-3 py-1 text-xs text-text-on-dark/50 transition-colors hover:border-brand-gold hover:text-brand-gold"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}

function JDHeaderControls() {
  const { jd, dqsScore, ersScore } = useJDStore();
  const jobTitle = jd.jobTitle || 'New JD';

  return (
    <>
      <div className="h-5 w-px bg-white/10" />
      <div className="max-w-[220px] truncate text-xs text-text-on-dark/50">{jobTitle}</div>
      <div className="flex items-center gap-[3px] rounded-lg bg-white/5 px-2.5 py-1">
        <span className="text-[11px] text-text-on-dark/50">DC:</span>
        <span
          className={cn(
            'text-xs font-bold',
            dqsScore >= 75 ? 'text-[#6BCB77]' : dqsScore >= 50 ? 'text-[#F0C040]' : 'text-[#FF7B6B]',
          )}
        >
          {dqsScore}%
        </span>
        {ersScore != null && (
          <>
            <div className="mx-1 h-3 w-px bg-white/15" />
            <span className="text-[11px] text-text-on-dark/50">ERS:</span>
            <span
              className={cn(
                'text-xs font-bold',
                ersScore >= 75 ? 'text-[#6BCB77]' : ersScore >= 50 ? 'text-[#F0C040]' : 'text-[#FF7B6B]',
              )}
            >
              {ersScore}%
            </span>
          </>
        )}
      </div>
    </>
  );
}

function JDHeaderActions() {
  const router = useRouter();
  const {
    jd, jdId, dqsScore, ersScore, evalResult, templateSections,
    evalLoading, setEvalLoading, setEvalResult,
    setShowHonestReview, setHonestReview, setHonestReviewLoading, setHonestReviewError,
    setShowEndSession, setEndSessionLoading, setEndSessionResult, setEndSessionError,
    setShowExport,
    honestReviewLoading, endSessionLoading,
  } = useJDStore();

  const hasTitle = !!jd.jobTitle?.trim();
  // Require at least a title to enable AI actions
  const wordCount = Object.values(jd).join(' ').split(/\s+/).filter(Boolean).length;
  const hasMeaningfulContent = wordCount >= 20;

  const handleExport = () => {
    setShowExport(true);
  };

  const handleHonestReview = async () => {
    if (!hasTitle || !hasMeaningfulContent) return;
    const jdText = buildText(jd, templateSections);

    // Open modal immediately with loading state — user sees feedback at once
    setHonestReviewLoading(true);
    setHonestReview(null);
    setHonestReviewError(null);
    setShowHonestReview(true);

    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const res = await fetch('/api/ai/honest-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jdText,
            dcScore: dqsScore,
            ersScore: ersScore ?? 0,
            evalResult: evalResult ?? null,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
          throw new Error(err.error || `Server error ${res.status}`);
        }

        const review = await res.json();

        // Validate required fields before showing — guard against truncated responses
        if (!review.verdict || !review.overallNarrative) {
          throw new Error('Incomplete response received from AI — required fields missing');
        }

        setHonestReview(review);
        break; // success
      } catch (err: any) {
        if (attempts >= maxAttempts) {
          setHonestReviewError(
            err.message || 'Review failed after retrying. Check your connection and try again.',
          );
        }
        // short pause before retry
        if (attempts < maxAttempts) await new Promise((r) => setTimeout(r, 1200));
      }
    }

    setHonestReviewLoading(false);
  };

  const handleEndForNow = async () => {
    if (endSessionLoading) return;

    // Save first — don't depend on autosave timing
    if (jdId) {
      try {
        await fetch(`/api/jd/${jdId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: jd, jobTitle: jd.jobTitle || '' }),
        });
      } catch {
        // Non-blocking — JD was likely already autosaved
      }
    }

    const jdText = buildText(jd, templateSections);

    setEndSessionLoading(true);
    setEndSessionResult(null);
    setEndSessionError(null);
    setShowEndSession(true);

    try {
      const res = await fetch('/api/ai/end-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText, dqs: dqsScore }),
      });

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      const result = await res.json();

      // Validate response completeness
      if (!result.sessionSummary) {
        throw new Error('Incomplete session summary received');
      }

      setEndSessionResult(result);
    } catch (err: any) {
      setEndSessionError(
        err.message || 'AI summary unavailable. Your draft was saved.',
      );
    } finally {
      setEndSessionLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!hasTitle || evalLoading) return;
    setEvalLoading(true);
    setEvalResult(null);
    try {
      const jdText = buildText(jd, templateSections);
      const res = await fetch('/api/ai/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const result = await res.json();
      if (!result.criteria || !Array.isArray(result.criteria)) {
        throw new Error('Malformed evaluation response');
      }
      setEvalResult(result);
      // Scroll quality panel into view — tab switches automatically via evalResult being set
    } catch {
      // Evaluation failed — user sees empty eval panel with retry option
    } finally {
      setEvalLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-[7px]">
      {/* Export */}
      <button
        onClick={handleExport}
        className="rounded-md border border-white/10 px-3 py-1 text-xs font-medium text-text-on-dark/50 transition-colors hover:border-white/30 hover:text-text-on-dark/80"
        title="Export JD in multiple formats"
      >
        ⊞ Export
      </button>

      {/* Honest Review */}
      <button
        onClick={handleHonestReview}
        disabled={!hasTitle || !hasMeaningfulContent || honestReviewLoading}
        className="inline-flex items-center gap-[5px] rounded-md border-none bg-[#4F46E5] px-3.5 py-1 text-xs font-medium text-white transition-opacity disabled:opacity-40"
        title={!hasMeaningfulContent ? 'Add more content before reviewing' : 'AI honest assessment of JD quality'}
      >
        {honestReviewLoading ? (
          <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />Reviewing…</>
        ) : '◆ Honest Review'}
      </button>

      {/* End for Now */}
      <button
        onClick={handleEndForNow}
        disabled={endSessionLoading}
        className="inline-flex items-center gap-[5px] rounded-md border-none bg-brand-gold px-3.5 py-1 text-xs font-medium text-white disabled:opacity-50"
        title="Save progress and get AI session summary"
      >
        {endSessionLoading ? (
          <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />Saving…</>
        ) : '⏹ End for Now'}
      </button>

      {/* Evaluate */}
      <button
        onClick={handleEvaluate}
        disabled={!hasTitle || evalLoading}
        className="inline-flex items-center gap-[5px] rounded-md border-none bg-cat-skills px-3.5 py-1 text-xs font-medium text-white transition-opacity disabled:opacity-40"
        title="Run ILO-aligned 16-criteria pay equity evaluation"
      >
        {evalLoading ? (
          <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />Evaluating…</>
        ) : '◆ Evaluate'}
      </button>
    </div>
  );
}
