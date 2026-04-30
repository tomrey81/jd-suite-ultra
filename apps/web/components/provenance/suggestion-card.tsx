'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export type SourceType =
  | 'jd'
  | 'orgStructure'
  | 'process'
  | 'financial'
  | 'regulation'
  | 'supporting'
  | 'voice'
  | 'reviewer'
  | 'template'
  | 'inference';

export type Confidence = 'high' | 'medium' | 'low';

export type RecommendationStatus =
  | 'recommended'
  | 'review'
  | 'doNotInclude'
  | 'conflicting'
  | 'outdated'
  | 'insufficient';

export interface SourceReference {
  type: SourceType;
  /** Document, file, node, or process name */
  ref?: string;
  /** Section / page / paragraph / snippet */
  excerpt?: string;
  /** ISO timestamp for time-anchored sources */
  timestamp?: string;
}

export interface JDSuggestion {
  id: string;
  fieldId: string;
  fieldLabel: string;
  suggestedText: string;
  rationale: string;
  sources: SourceReference[];
  confidence: Confidence;
  status: RecommendationStatus;
}

const SOURCE_LABELS: Record<SourceType, string> = {
  jd: 'Job Description',
  orgStructure: 'Org Structure',
  process: 'Process Document',
  financial: 'Financial Document',
  regulation: 'Organisational Regulation',
  supporting: 'Supporting Document',
  voice: 'Voice Note',
  reviewer: 'Reviewer Note',
  template: 'JD Template',
  inference: 'AI Inference',
};

const SOURCE_ICONS: Record<SourceType, string> = {
  jd: '◇',
  orgStructure: '⌬',
  process: '⊞',
  financial: '$',
  regulation: '§',
  supporting: '◈',
  voice: '🎤',
  reviewer: '☐',
  template: '⊡',
  inference: '✦',
};

const STATUS_CONFIG: Record<RecommendationStatus, { label: string; bg: string; fg: string; border: string }> = {
  recommended: {
    label: 'Recommended to include',
    bg: 'bg-success-bg',
    fg: 'text-success',
    border: 'border-success/30',
  },
  review: {
    label: 'Review before including',
    bg: 'bg-warning-bg',
    fg: 'text-warning',
    border: 'border-warning/30',
  },
  doNotInclude: {
    label: 'Probably do not include',
    bg: 'bg-danger-bg',
    fg: 'text-danger',
    border: 'border-danger/30',
  },
  conflicting: {
    label: 'Conflicting evidence',
    bg: 'bg-danger-bg',
    fg: 'text-danger',
    border: 'border-danger/30',
  },
  outdated: {
    label: 'Source may be outdated',
    bg: 'bg-warning-bg',
    fg: 'text-warning',
    border: 'border-warning/30',
  },
  insufficient: {
    label: 'Insufficient evidence',
    bg: 'bg-surface-page',
    fg: 'text-text-muted',
    border: 'border-border-default',
  },
};

const CONFIDENCE_CONFIG: Record<Confidence, { label: string; color: string }> = {
  high: { label: 'High confidence', color: 'text-success' },
  medium: { label: 'Medium confidence', color: 'text-warning' },
  low: { label: 'Low confidence', color: 'text-text-muted' },
};

interface Props {
  suggestion: JDSuggestion;
  onAccept?: (s: JDSuggestion) => void;
  onEditAndAccept?: (s: JDSuggestion) => void;
  onReject?: (s: JDSuggestion) => void;
  onMarkForReviewer?: (s: JDSuggestion) => void;
}

export function SuggestionCard({ suggestion, onAccept, onEditAndAccept, onReject, onMarkForReviewer }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(suggestion.suggestedText);

  const status = STATUS_CONFIG[suggestion.status];
  const confidence = CONFIDENCE_CONFIG[suggestion.confidence];

  const handleEditAccept = () => {
    onEditAndAccept?.({ ...suggestion, suggestedText: draft });
    setEditing(false);
  };

  return (
    <div className={cn('rounded-lg border bg-white', status.border)}>
      {/* Header */}
      <div className="flex items-start gap-2 px-3 py-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gold">
              {suggestion.fieldLabel}
            </span>
            <span className={cn('rounded-full px-2 py-px text-[9px] font-medium', status.bg, status.fg)}>
              {status.label}
            </span>
            <span className={cn('text-[9px] font-medium', confidence.color)}>
              · {confidence.label}
            </span>
          </div>
          <div className="mt-1 text-[12px] leading-relaxed text-text-primary">
            {editing ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.min(8, Math.max(2, draft.split('\n').length))}
                className="w-full rounded-md border border-border-default bg-surface-page p-2 text-[12px] outline-none focus:border-brand-gold"
              />
            ) : (
              suggestion.suggestedText
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 rounded text-[10px] text-text-muted hover:text-brand-gold"
          title={expanded ? 'Hide details' : 'Why this suggestion?'}
        >
          {expanded ? '↑ Hide' : 'ⓘ Why?'}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border-default bg-surface-page/50 px-3 py-2">
          <div className="mb-2">
            <div className="text-[9px] uppercase tracking-wider text-text-muted">Rationale</div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-text-secondary">{suggestion.rationale}</p>
          </div>

          <div>
            <div className="text-[9px] uppercase tracking-wider text-text-muted">
              Sources ({suggestion.sources.length})
            </div>
            <ul className="mt-1 space-y-1">
              {suggestion.sources.map((src, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-md border border-border-default bg-white px-2 py-1.5 text-[10px]"
                >
                  <span className="text-sm text-brand-gold">{SOURCE_ICONS[src.type]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-text-primary">{SOURCE_LABELS[src.type]}</span>
                      {src.ref && (
                        <span className="truncate text-text-muted">· {src.ref}</span>
                      )}
                    </div>
                    {src.excerpt && (
                      <p className="mt-0.5 line-clamp-2 italic text-text-muted">"{src.excerpt}"</p>
                    )}
                    {src.timestamp && (
                      <div className="mt-0.5 text-[9px] text-text-muted">
                        {new Date(src.timestamp).toLocaleString()}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 border-t border-border-default px-3 py-2">
        {!editing ? (
          <>
            <button
              onClick={() => onAccept?.(suggestion)}
              disabled={suggestion.status === 'doNotInclude' || suggestion.status === 'conflicting'}
              className="rounded-full bg-brand-gold px-3 py-1 text-[10px] font-medium text-white hover:bg-brand-gold/90 disabled:opacity-40"
            >
              Accept
            </button>
            <button
              onClick={() => setEditing(true)}
              className="rounded-full border border-border-default bg-white px-3 py-1 text-[10px] font-medium text-text-secondary hover:border-brand-gold"
            >
              Edit and accept
            </button>
            <button
              onClick={() => onReject?.(suggestion)}
              className="rounded-full border border-border-default bg-white px-3 py-1 text-[10px] font-medium text-text-secondary hover:border-danger hover:text-danger"
            >
              Reject
            </button>
            <button
              onClick={() => onMarkForReviewer?.(suggestion)}
              className="ml-auto rounded-full border border-border-default bg-white px-3 py-1 text-[10px] font-medium text-text-muted hover:border-brand-gold hover:text-brand-gold"
            >
              Mark for reviewer
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleEditAccept}
              className="rounded-full bg-brand-gold px-3 py-1 text-[10px] font-medium text-white hover:bg-brand-gold/90"
            >
              Save edit
            </button>
            <button
              onClick={() => { setEditing(false); setDraft(suggestion.suggestedText); }}
              className="rounded-full border border-border-default bg-white px-3 py-1 text-[10px] font-medium text-text-secondary hover:border-brand-gold"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
