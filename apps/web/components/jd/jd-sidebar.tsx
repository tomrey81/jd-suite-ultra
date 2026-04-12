'use client';

import { useJDStore } from '@/hooks/use-jd-store';
import Link from 'next/link';
import { secScore } from '@/lib/jd-helpers';
import { cn } from '@/lib/utils';

function Ring({ pct, size = 17 }: { pct: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const f = (pct / 100) * c;
  const color = pct === 100 ? '#2E7A3C' : pct > 60 ? '#8A7560' : '#DDD8CC';

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#DDD8CC" strokeWidth={2} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={`${f} ${c - f}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-[stroke-dasharray] duration-400"
      />
    </svg>
  );
}

export function JDSidebar() {
  const {
    jd,
    jdId,
    templateSections,
    activeSectionId,
    setActiveSectionId,
    dqsScore,
    ersScore,
    showHighlights,
    setShowHighlights,
    saving,
    lastSavedAt,
    saveError,
    setShowExport,
    setShowVersionHistory,
  } = useJDStore();

  const scoreColor =
    dqsScore >= 75 ? 'text-success' : dqsScore >= 50 ? 'text-warning' : 'text-danger';
  const scoreBarColor =
    dqsScore >= 75 ? 'bg-success' : dqsScore >= 50 ? 'bg-warning' : 'bg-brand-gold';

  return (
    <div className="flex h-full w-[200px] shrink-0 flex-col overflow-y-auto border-r border-border-default bg-white py-3">
      {/* DC Score */}
      <div className="px-3 pb-3">
        <div className="mb-[7px] rounded-lg border border-border-default bg-surface-page p-[9px_11px]">
          <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-text-muted">
            Document Completeness
          </div>
          <div className={cn('font-display text-xl font-bold', scoreColor)}>{dqsScore}%</div>
          <div className="mt-[5px] h-[3px] overflow-hidden rounded-full bg-border-default">
            <div
              className={cn('h-full rounded-full transition-[width] duration-400', scoreBarColor)}
              style={{ width: `${dqsScore}%` }}
            />
          </div>
        </div>

        {ersScore != null && (
          <div className="mb-[7px] rounded-lg border border-info-bg bg-info-bg p-[9px_11px]">
            <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-info">
              Eval Readiness (ERS)
            </div>
            <div
              className={cn(
                'font-display text-xl font-bold',
                ersScore >= 75 ? 'text-success' : ersScore >= 50 ? 'text-warning' : 'text-danger',
              )}
            >
              {ersScore}%
            </div>
          </div>
        )}

        {/* Save status */}
        <div className={cn('mb-1 text-[10px]', saveError ? 'text-danger' : 'text-text-muted')}>
          {saving
            ? '● Saving…'
            : saveError
              ? `⚠ ${saveError}`
              : lastSavedAt
                ? `Saved ${Math.round((Date.now() - lastSavedAt) / 1000)}s ago`
                : ''}
        </div>

        {/* Field badges toggle */}
        <button
          type="button"
          onClick={() => setShowHighlights(!showHighlights)}
          className="flex w-full items-center justify-between rounded-md border border-border-default px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors"
          style={{ background: showHighlights ? '#E8E1D8' : 'white' }}
        >
          <span>Field badges {showHighlights ? 'on' : 'off'}</span>
          <span
            className="relative inline-block h-3.5 w-7 rounded-full transition-colors"
            style={{ background: showHighlights ? '#8A7560' : '#DDD8CC' }}
          >
            <span
              className="absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-[left]"
              style={{ left: showHighlights ? 16 : 2 }}
            />
          </span>
        </button>
      </div>

      {/* Sections */}
      <div className="mb-3">
        <div className="mb-[3px] px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          JD Sections
        </div>
        {templateSections.map((s) => {
          const pct = secScore(jd, s);
          const isActive = activeSectionId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSectionId(s.id)}
              className={cn(
                'flex w-full items-center justify-between gap-[5px] border-l-[3px] px-3 py-[5px] text-[11.5px] transition-all',
                isActive
                  ? 'border-brand-gold bg-brand-gold-light font-medium text-text-primary'
                  : 'border-transparent text-text-secondary hover:bg-surface-page',
              )}
            >
              <div className="flex min-w-0 items-center gap-[5px]">
                <div
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] font-display text-[9px] font-bold text-text-on-dark',
                    isActive ? 'bg-brand-gold' : 'bg-surface-header',
                  )}
                >
                  {s.id}
                </div>
                <span className="truncate text-[11px]">{s.title}</span>
              </div>
              <Ring pct={pct} />
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-col gap-[5px] px-3">
        <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Actions
        </div>
        <button
          type="button"
          onClick={() => setShowExport(true)}
          className="flex w-full items-center gap-[5px] rounded-md bg-brand-gold-lighter px-2.5 py-1.5 text-left text-[11px] font-medium text-text-secondary transition-colors hover:bg-brand-gold-light"
        >
          ⊞ Export JD
        </button>
        <button
          type="button"
          onClick={() => setShowVersionHistory(true)}
          className="flex w-full items-center gap-[5px] rounded-md px-2.5 py-1.5 text-left text-[11px] text-text-muted transition-colors hover:bg-surface-page hover:text-text-secondary"
        >
          ⊙ Version History
        </button>
        {jdId && jd.jobTitle && (
          <Link
            href={`/jd/${jdId}/studio`}
            className="flex items-center gap-[5px] rounded-md px-2.5 py-1.5 text-[11px] text-text-muted transition-colors hover:bg-surface-page hover:text-text-secondary"
          >
            ♫ JD Studio
          </Link>
        )}
      </div>
    </div>
  );
}
