'use client';

import { useEffect, useState } from 'react';

interface VersionEntry {
  id: string;
  timestamp: string;
  changeType: string;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  note: string | null;
  authorType: string;
  author: { name: string | null; email: string } | null;
}

const CHANGE_LABELS: Record<string, { label: string; bg: string; fg: string }> = {
  FIELD_EDIT: { label: 'Field edit', bg: 'bg-info-bg', fg: 'text-info' },
  STATUS_CHANGE: { label: 'Status change', bg: 'bg-warning-bg', fg: 'text-warning' },
  COMMENT: { label: 'Comment', bg: 'bg-surface-page', fg: 'text-text-muted' },
  IMPORT: { label: 'Import', bg: 'bg-brand-gold/15', fg: 'text-brand-gold' },
  AI_ASSIST: { label: 'AI assist', bg: 'bg-info-bg', fg: 'text-info' },
  EVALUATION: { label: 'Evaluation', bg: 'bg-success-bg', fg: 'text-success' },
  EXPORT: { label: 'Export', bg: 'bg-surface-page', fg: 'text-text-secondary' },
};

interface Props {
  jdId: string;
  /** Compact mode for embedding in narrow side panels */
  compact?: boolean;
}

export function AuditTrailPanel({ jdId, compact = false }: Props) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/jd/${jdId}/history`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: VersionEntry[] = await res.json();
        if (!cancelled) setVersions(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [jdId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border-default bg-white p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-brand-gold">Audit trail</div>
        <p className="mt-2 text-xs text-text-muted">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger-bg p-3 text-xs text-danger">
        Audit trail unavailable: {error}
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-white p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-brand-gold">Audit trail</div>
        <p className="mt-2 text-xs text-text-muted">No changes recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-default bg-white">
      <div className="border-b border-border-default px-4 py-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-gold">
          Audit trail
        </div>
        <div className="mt-0.5 text-[11px] text-text-muted">
          {versions.length} operation{versions.length === 1 ? '' : 's'} · who, what, when
        </div>
      </div>
      <ul className="max-h-[400px] divide-y divide-border-default overflow-y-auto">
        {versions.map((v) => {
          const meta = CHANGE_LABELS[v.changeType] || { label: v.changeType, bg: 'bg-surface-page', fg: 'text-text-muted' };
          const ts = new Date(v.timestamp);
          const author = v.author?.name || v.author?.email || (v.authorType === 'GUEST' ? 'Guest reviewer' : 'System');
          return (
            <li key={v.id} className={compact ? 'px-3 py-2' : 'px-4 py-2.5'}>
              <div className="flex items-start gap-2">
                <span className={`shrink-0 rounded-full px-2 py-px text-[9px] font-medium uppercase tracking-wider ${meta.bg} ${meta.fg}`}>
                  {meta.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-text-primary">
                    {v.fieldChanged && <strong>{v.fieldChanged}</strong>}
                    {v.fieldChanged && v.note && ' · '}
                    {v.note}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-text-muted">
                    <span>{author}</span>
                    <span>·</span>
                    <time dateTime={v.timestamp} title={ts.toISOString()}>
                      {ts.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </time>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
