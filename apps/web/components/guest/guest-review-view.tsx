'use client';

import { useState } from 'react';
import type { TemplateSection } from '@jd-suite/types';

interface Comment {
  id: string;
  content: string;
  fieldId: string | null;
  authorType: string;
  authorEmail: string | null;
  createdAt: string;
}

interface GuestReviewViewProps {
  jdId: string;
  token: string;
  data: Record<string, string>;
  sections: TemplateSection[];
  jobTitle: string;
  orgUnit: string;
  status: string;
  canComment: boolean;
  sharedBy: string;
  comments: Comment[];
}

export function GuestReviewView({
  jdId,
  token,
  data,
  sections,
  jobTitle,
  orgUnit,
  status,
  canComment,
  sharedBy,
  comments: initialComments,
}: GuestReviewViewProps) {
  const [comments, setComments] = useState(initialComments);
  const [commentText, setCommentText] = useState('');
  const [commentFieldId, setCommentFieldId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/jd/${jdId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: commentText,
          fieldId: commentFieldId,
          guestToken: token,
        }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [
          {
            id: newComment.id,
            content: newComment.content,
            fieldId: newComment.fieldId,
            authorType: 'GUEST',
            authorEmail: newComment.authorEmail,
            createdAt: newComment.createdAt,
          },
          ...prev,
        ]);
        setCommentText('');
        setCommentFieldId(null);
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-page">
      {/* Header */}
      <div className="border-b border-border-default bg-white px-6 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-lg font-bold text-text-primary">
                JD Suite
              </div>
              <div className="text-[10px] uppercase tracking-widest text-text-muted">
                Guest Review
              </div>
            </div>
            <div className="text-right text-xs text-text-muted">
              Shared by {sharedBy}
              <br />
              {canComment ? 'You can add comments' : 'View only'}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* JD Header */}
        <div className="mb-6 rounded-xl border border-border-default bg-white p-6">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-brand-gold">
            Job Description
          </div>
          <h1 className="mb-1 font-display text-2xl font-bold text-text-primary">
            {jobTitle || 'Untitled Role'}
          </h1>
          <div className="flex gap-3 text-sm text-text-muted">
            {orgUnit && <span>{orgUnit}</span>}
            <span className="rounded bg-brand-gold-lighter px-2 py-0.5 text-xs font-semibold text-text-secondary">
              {status.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_300px] gap-6">
          {/* JD Content */}
          <div className="space-y-4">
            {sections.map((sec) => (
              <div key={sec.id} className="rounded-xl border border-border-default bg-white p-5">
                <div className="mb-3 border-b border-surface-page pb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-brand-gold">
                  {sec.id} | {sec.title}
                </div>
                {sec.fields.map((f) => {
                  const val = data[f.id];
                  const fieldComments = comments.filter((c) => c.fieldId === f.id);
                  return (
                    <div key={f.id} className="mb-3">
                      <div className="mb-1 text-[11px] font-semibold text-text-secondary">
                        {f.label}
                      </div>
                      <div
                        className={`whitespace-pre-wrap text-[13px] leading-relaxed ${val ? 'text-text-primary' : 'italic text-text-muted'}`}
                      >
                        {val || '(not provided)'}
                      </div>
                      {/* Field comments */}
                      {fieldComments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {fieldComments.map((c) => (
                            <div
                              key={c.id}
                              className="rounded-md bg-warning-bg px-3 py-2 text-xs text-text-secondary"
                            >
                              <span className="font-semibold text-warning">
                                {c.authorType === 'GUEST' ? c.authorEmail : 'Owner'}:
                              </span>{' '}
                              {c.content}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Inline comment button */}
                      {canComment && (
                        <button
                          type="button"
                          onClick={() => setCommentFieldId(f.id)}
                          className="mt-1 text-[10px] text-text-muted transition-colors hover:text-brand-gold"
                        >
                          + Add comment
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Comments Panel */}
          <div className="space-y-4">
            {canComment && (
              <div className="sticky top-4 rounded-xl border border-border-default bg-white p-4">
                <div className="mb-3 text-xs font-semibold text-text-primary">Add Comment</div>
                {commentFieldId && (
                  <div className="mb-2 flex items-center gap-2 rounded bg-info-bg px-2 py-1 text-[10px] text-info">
                    <span>
                      Commenting on:{' '}
                      {sections
                        .flatMap((s) => s.fields)
                        .find((f) => f.id === commentFieldId)?.label || commentFieldId}
                    </span>
                    <button type="button" onClick={() => setCommentFieldId(null)} className="font-bold">
                      ×
                    </button>
                  </div>
                )}
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Type your comment..."
                  className="mb-2 w-full resize-none rounded-lg border border-border-default bg-surface-page px-3 py-2 font-body text-xs text-text-primary outline-none"
                  rows={4}
                />
                <button
                  type="button"
                  onClick={submitComment}
                  disabled={!commentText.trim() || submitting}
                  className="w-full rounded-md bg-brand-gold px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
                >
                  {submitting ? 'Submitting...' : 'Submit Comment'}
                </button>
              </div>
            )}

            {/* All comments */}
            <div className="rounded-xl border border-border-default bg-white p-4">
              <div className="mb-3 text-xs font-semibold text-text-primary">
                Comments ({comments.length})
              </div>
              {comments.length === 0 && (
                <div className="py-4 text-center text-xs text-text-muted">No comments yet</div>
              )}
              <div className="space-y-2">
                {comments.map((c) => (
                  <div key={c.id} className="rounded-lg bg-surface-page p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-text-secondary">
                        {c.authorType === 'GUEST' ? c.authorEmail : 'JD Owner'}
                      </span>
                      <span className="text-[9px] text-text-muted">
                        {new Date(c.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-xs leading-relaxed text-text-primary">{c.content}</div>
                    {c.fieldId && (
                      <div className="mt-1 text-[9px] text-text-muted">
                        on:{' '}
                        {sections.flatMap((s) => s.fields).find((f) => f.id === c.fieldId)?.label ||
                          c.fieldId}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
