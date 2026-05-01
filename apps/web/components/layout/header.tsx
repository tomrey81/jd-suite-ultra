'use client';

import { signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useJDStore } from '@/hooks/use-jd-store';
import { buildText } from '@/lib/jd-helpers';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/components/layout/language-switcher';

interface HeaderProps {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
}

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  // Only show JD-editor controls (DC %, Export, Honest Review, End for Now,
  // Evaluate) when the route is actually a JD detail page. Upload, bulk-import,
  // and the "new" placeholder page do not have a JD to act on.
  const NON_EDITOR_JD_ROUTES = new Set(['/jd', '/jd/new', '/jd/input', '/jd/bulk-import']);
  const isJDEditor =
    pathname.startsWith('/jd/') &&
    !NON_EDITOR_JD_ROUTES.has(pathname) &&
    !pathname.startsWith('/jd/bulk-import');

  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between bg-surface-header px-6">
      {/* Left: Wordmark */}
      <a href="/" className="cursor-pointer select-none">
        <span className="font-display text-[17px] tracking-[0.25em] text-text-on-dark/90">
          JD SUITE
        </span>
      </a>

      {/* Center: JD context pill */}
      {isJDEditor && (
        <div className="absolute left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-full bg-white/[0.07] px-5 py-1.5 backdrop-blur-sm">
            <JDHeaderControls />
          </div>
        </div>
      )}

      {/* Right: Actions + User */}
      <div className="flex items-center gap-3">
        {isJDEditor && <JDHeaderActions />}
        <LanguageSwitcher />
        <div className="ml-1 flex items-center gap-2.5 rounded-full bg-white/[0.07] py-1.5 pl-4 pr-1.5">
          <span className="text-[12px] tracking-wide text-text-on-dark/50">
            {user.name || user.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="rounded-full bg-white/[0.08] px-3.5 py-1 text-[11px] font-medium tracking-wide text-text-on-dark/60 transition-all hover:bg-white/[0.14] hover:text-text-on-dark/90"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}

function JDHeaderControls() {
  const { jd, dqsScore, ersScore } = useJDStore();
  const jobTitle = jd.jobTitle || 'New JD';

  return (
    <>
      <span className="max-w-[200px] truncate text-[12px] tracking-wide text-text-on-dark/60">{jobTitle}</span>
      <div className="h-3.5 w-px bg-white/10" />
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-text-on-dark/40">DC</span>
        <span
          className={cn(
            'text-[12px] font-semibold tabular-nums',
            dqsScore >= 75 ? 'text-[#6BCB77]' : dqsScore >= 50 ? 'text-[#F0C040]' : 'text-[#FF7B6B]',
          )}
        >
          {dqsScore}%
        </span>
      </div>
      {ersScore != null && (
        <>
          <div className="h-3.5 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-text-on-dark/40">ERS</span>
            <span
              className={cn(
                'text-[12px] font-semibold tabular-nums',
                ersScore >= 75 ? 'text-[#6BCB77]' : ersScore >= 50 ? 'text-[#F0C040]' : 'text-[#FF7B6B]',
              )}
            >
              {ersScore}%
            </span>
          </div>
        </>
      )}
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

  const spinnerEl = <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/30 border-t-white" />;

  return (
    <div className="flex items-center gap-2">
      {/* Export */}
      <button
        onClick={handleExport}
        className="rounded-full border border-white/[0.08] px-4 py-1.5 text-[11px] font-medium tracking-wide text-text-on-dark/50 transition-all hover:border-white/20 hover:text-text-on-dark/80"
        title="Export JD in multiple formats"
      >
        Export
      </button>

      {/* Honest Review */}
      <button
        onClick={handleHonestReview}
        disabled={!hasTitle || !hasMeaningfulContent || honestReviewLoading}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#4F46E5]/80 px-4 py-1.5 text-[11px] font-medium tracking-wide text-white/90 transition-all hover:bg-[#4F46E5] disabled:opacity-35"
        title={!hasMeaningfulContent ? 'Add more content before reviewing' : 'AI honest assessment of JD quality'}
      >
        {honestReviewLoading ? <>{spinnerEl} Reviewing…</> : 'Honest Review'}
      </button>

      {/* End for Now */}
      <button
        onClick={handleEndForNow}
        disabled={endSessionLoading}
        className="inline-flex items-center gap-1.5 rounded-full bg-brand-gold/90 px-4 py-1.5 text-[11px] font-medium tracking-wide text-white/90 transition-all hover:bg-brand-gold disabled:opacity-40"
        title="Save progress and get AI session summary"
      >
        {endSessionLoading ? <>{spinnerEl} Saving…</> : 'End for Now'}
      </button>

      {/* Evaluate */}
      <button
        onClick={handleEvaluate}
        disabled={!hasTitle || evalLoading}
        className="inline-flex items-center gap-1.5 rounded-full bg-cat-skills/80 px-4 py-1.5 text-[11px] font-medium tracking-wide text-white/90 transition-all hover:bg-cat-skills disabled:opacity-35"
        title="Run ILO-aligned 16-criteria pay equity evaluation"
      >
        {evalLoading ? <>{spinnerEl} Evaluating…</> : 'Evaluate'}
      </button>
    </div>
  );
}
