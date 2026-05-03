'use client';

import { useEffect, useState, useCallback } from 'react';

interface ApprovalRecord {
  id: string;
  fromStage: string | null;
  toStage: string;
  action: string;
  actorId: string;
  comment: string | null;
  createdAt: string;
}

interface NextAction {
  action: string;
  label: string;
  requiresComment: boolean;
}

interface ApprovalData {
  history: ApprovalRecord[];
  currentStage: string;
  stageColor: string;
  nextActions: NextAction[];
}

const STAGE_BG: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-300',
  MANAGER_VALIDATION: 'bg-blue-100 text-blue-700 border-blue-300',
  HR_REVIEW: 'bg-teal-100 text-teal-700 border-teal-300',
  GOVERNANCE_APPROVAL: 'bg-purple-100 text-purple-700 border-purple-300',
  APPROVED: 'bg-green-100 text-green-700 border-green-300',
  PUBLISHED: 'bg-amber-100 text-amber-700 border-amber-300',
  REJECTED: 'bg-red-100 text-red-700 border-red-300',
  ARCHIVED: 'bg-stone-100 text-stone-700 border-stone-300',
};

function StageBadge({ stage }: { stage: string }) {
  const cls = STAGE_BG[stage] ?? 'bg-gray-100 text-gray-700 border-gray-300';
  const label = stage.replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      {label}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

const ACTION_ENDPOINT: Record<string, string> = {
  advance: 'advance',
  approve: 'approve',
  reject: 'reject',
  withdraw: 'withdraw',
  resubmit: 'resubmit',
};

interface Props {
  jdId: string;
  currentStatus: string;
}

export function ApprovalPanel({ jdId, currentStatus: _currentStatus }: Props) {
  const [data, setData] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jd/${jdId}/approval`);
      if (res.status === 404) {
        // Flag is off — render nothing
        setData(null);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError('Failed to load approval data.');
        setLoading(false);
        return;
      }
      const json: ApprovalData = await res.json();
      setData(json);
    } catch {
      setError('Network error loading approval data.');
    } finally {
      setLoading(false);
    }
  }, [jdId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleAction(action: string, requiresComment: boolean) {
    if (requiresComment && commentFor !== action) {
      setCommentFor(action);
      return;
    }
    if (requiresComment && (!comment || comment.trim() === '')) {
      setActionError('A comment is required for this action.');
      return;
    }

    setDisabled(true);
    setActionError(null);
    try {
      const endpoint = ACTION_ENDPOINT[action];
      if (!endpoint) return;

      const res = await fetch(`/api/jd/${jdId}/approval/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment || undefined }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error || 'Action failed. Please try again.');
        setDisabled(false);
        return;
      }

      setCommentFor(null);
      setComment('');
      await fetchData();
    } catch {
      setActionError('Network error. Please try again.');
    } finally {
      setDisabled(false);
    }
  }

  // Flag off or 404 — render nothing
  if (!loading && data === null && !error) return null;

  if (loading) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-secondary p-4">
        <p className="text-sm text-text-secondary">Loading approval status…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-secondary overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default bg-surface-primary">
        <h3 className="text-sm font-semibold text-text-primary">Approval Workflow</h3>
        <StageBadge stage={data.currentStage} />
      </div>

      {/* Action buttons */}
      {data.nextActions.length > 0 && (
        <div className="px-4 py-3 border-b border-border-default space-y-2">
          {actionError && (
            <p className="text-xs text-red-600 mb-1">{actionError}</p>
          )}

          {commentFor && (
            <div className="space-y-1">
              <label
                htmlFor="approval-comment"
                className="block text-xs font-medium text-text-secondary"
              >
                Comment (required)
              </label>
              <textarea
                id="approval-comment"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full text-sm rounded border border-border-default bg-surface-primary px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-brand-gold resize-none"
                placeholder="Provide a reason for this action…"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(commentFor, true)}
                  disabled={disabled || !comment.trim()}
                  className="text-xs px-3 py-1.5 rounded bg-brand-gold text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  Confirm
                </button>
                <button
                  onClick={() => {
                    setCommentFor(null);
                    setComment('');
                    setActionError(null);
                  }}
                  className="text-xs px-3 py-1.5 rounded border border-border-default text-text-secondary hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!commentFor && (
            <div className="flex flex-wrap gap-2">
              {data.nextActions.map((na) => (
                <button
                  key={na.action}
                  disabled={disabled}
                  onClick={() => handleAction(na.action, na.requiresComment)}
                  className={`text-xs px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-50 ${
                    na.action === 'reject'
                      ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                      : na.action === 'approve' || na.action === 'advance'
                      ? 'bg-brand-gold text-white hover:opacity-90'
                      : 'border border-border-default text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {na.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History timeline */}
      <div className="px-4 py-3">
        <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3">
          History
        </h4>

        {data.history.length === 0 ? (
          <p className="text-xs text-text-tertiary">No approval activity yet.</p>
        ) : (
          <ol className="space-y-3">
            {data.history.map((record) => (
              <li key={record.id} className="flex gap-3 text-xs">
                <div className="mt-0.5 flex-shrink-0 w-2 h-2 rounded-full bg-brand-gold ring-2 ring-surface-secondary ring-offset-0" />
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-text-primary">
                      {record.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-text-tertiary">→</span>
                    <StageBadge stage={record.toStage} />
                    <span className="text-text-tertiary">
                      {formatDate(record.createdAt)}
                    </span>
                  </div>
                  {record.comment && (
                    <p className="text-text-secondary italic">
                      &ldquo;{record.comment}&rdquo;
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
