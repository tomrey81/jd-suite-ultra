'use client';

import { useState, useEffect } from 'react';
import { useJDStore } from '@/hooks/use-jd-store';
import { cn } from '@/lib/utils';

interface JDVersion {
  id: string;
  timestamp: string;
  changeType: string;
  note: string | null;
  authorType: string;
  author?: { name: string | null; email: string } | null;
}

const CHANGE_ICONS: Record<string, string> = {
  FIELD_EDIT:     '✏',
  STATUS_CHANGE:  '◎',
  COMMENT:        '💬',
  IMPORT:         '←',
  AI_ASSIST:      '◆',
  EVALUATION:     '⊞',
  EXPORT:         '↓',
};

const CHANGE_COLORS: Record<string, string> = {
  FIELD_EDIT:     'text-text-secondary',
  STATUS_CHANGE:  'text-info',
  COMMENT:        'text-text-muted',
  IMPORT:         'text-cat-skills',
  AI_ASSIST:      'text-[#4F46E5]',
  EVALUATION:     'text-cat-responsibility',
  EXPORT:         'text-brand-gold',
};

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function groupByDay(versions: JDVersion[]) {
  const groups: Record<string, JDVersion[]> = {};
  for (const v of versions) {
    const day = new Date(v.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (!groups[day]) groups[day] = [];
    groups[day].push(v);
  }
  return groups;
}

export function VersionHistoryPanel({ jdId }: { jdId: string }) {
  const { showVersionHistory, setShowVersionHistory } = useJDStore();
  const [versions, setVersions] = useState<JDVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!showVersionHistory) return;
    setLoading(true);
    setError(null);
    fetch(`/api/jd/${jdId}/history`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load history (${r.status})`);
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('Unexpected history format');
        setVersions(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [showVersionHistory, jdId]);

  if (!showVersionHistory) return null;

  const handleRestore = async (versionId: string) => {
    if (!confirm('Restore to this version? The current state will be saved as a new version first.')) return;
    setRestoring(versionId);
    setRestoreSuccess(null);
    try {
      const res = await fetch(`/api/jd/${jdId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Restore failed (${res.status})`);
      }
      setRestoreSuccess(versionId);
      // Refresh page so JD data reloads from DB
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      alert(err.message || 'Restore failed');
    } finally {
      setRestoring(null);
    }
  };

  const groups = groupByDay(versions);
  const days = Object.keys(groups);

  return (
    <div className="fixed inset-0 z-[500] flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setShowVersionHistory(false)}
      />

      {/* Panel */}
      <div className="relative flex h-full w-[380px] flex-col bg-white shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <div>
            <div className="font-display text-[15px] font-bold text-text-primary">Version History</div>
            <div className="text-[11px] text-text-muted">
              {versions.length} entries · all changes auto-tracked
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowVersionHistory(false)}
            className="text-xl leading-none text-text-muted hover:text-text-primary"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="h-7 w-7 animate-spin rounded-full border-[2.5px] border-border-default border-t-brand-gold" />
              <div className="text-[11px] italic text-text-muted">Loading history…</div>
            </div>
          )}

          {!loading && error && (
            <div className="m-4 rounded-lg border border-danger bg-danger-bg p-4 text-sm text-danger">
              <div className="font-semibold">Could not load history</div>
              <div className="mt-1 text-xs">{error}</div>
              <button
                type="button"
                onClick={() => setShowVersionHistory(false)}
                className="mt-3 text-xs underline"
              >
                Close and try again
              </button>
            </div>
          )}

          {!loading && !error && versions.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="text-2xl opacity-25">⊙</div>
              <div className="text-sm text-text-muted">No history yet</div>
              <div className="text-xs text-text-muted">Changes will appear here as you edit</div>
            </div>
          )}

          {!loading && !error && days.map((day) => (
            <div key={day}>
              {/* Day header */}
              <div className="sticky top-0 z-10 border-b border-border-default bg-surface-page px-5 py-1.5">
                <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-text-muted">{day}</div>
              </div>

              {/* Versions for this day */}
              {groups[day].map((v) => {
                const icon = CHANGE_ICONS[v.changeType] || '·';
                const color = CHANGE_COLORS[v.changeType] || 'text-text-muted';
                const isFieldEdit = v.changeType === 'FIELD_EDIT';
                const isRestoring = restoring === v.id;
                const didRestore = restoreSuccess === v.id;

                return (
                  <div
                    key={v.id}
                    className="flex items-start gap-3 border-b border-surface-page px-5 py-3 hover:bg-surface-page"
                  >
                    {/* Icon */}
                    <div className={cn('mt-[1px] w-4 shrink-0 text-center text-[12px]', color)}>
                      {icon}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-medium text-text-primary capitalize">
                          {v.changeType.replace(/_/g, ' ').toLowerCase()}
                        </span>
                        <span className="shrink-0 text-[10px] text-text-muted">{relativeTime(v.timestamp)}</span>
                      </div>
                      {v.note && (
                        <div className="mt-0.5 truncate text-[10.5px] text-text-secondary">{v.note}</div>
                      )}
                      <div className="mt-0.5 text-[10px] text-text-muted">
                        {v.authorType === 'AI' ? 'AI' : v.author?.name || v.author?.email || 'User'}
                      </div>
                    </div>

                    {/* Restore button — only for FIELD_EDIT snapshots that have saved data */}
                    {isFieldEdit && (
                      <button
                        type="button"
                        onClick={() => handleRestore(v.id)}
                        disabled={isRestoring || didRestore}
                        className={cn(
                          'shrink-0 rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                          didRestore
                            ? 'bg-success-bg text-success'
                            : 'border border-border-default text-text-muted hover:border-brand-gold hover:text-brand-gold',
                        )}
                      >
                        {isRestoring ? '…' : didRestore ? '✓' : 'Restore'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border-default px-5 py-3">
          <p className="text-[10px] text-text-muted">
            Restoring creates a new version — no history is deleted.
          </p>
        </div>
      </div>
    </div>
  );
}
