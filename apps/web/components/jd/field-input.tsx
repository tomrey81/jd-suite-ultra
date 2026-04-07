'use client';

import type { TemplateField, FieldScore } from '@jd-suite/types';
import { useJDStore } from '@/hooks/use-jd-store';
import { cn } from '@/lib/utils';

interface FieldInputProps {
  field: TemplateField;
  value: string;
  fieldScore?: FieldScore;
}

const PRIORITY_STYLES = {
  must: { bg: 'bg-danger-bg', text: 'text-danger', label: 'Required' },
  helpful: { bg: 'bg-warning-bg', text: 'text-warning', label: 'Helpful' },
  nice: { bg: 'bg-brand-gold-lighter', text: 'text-text-muted', label: 'Nice to have' },
} as const;

const BADGE_STYLES = {
  good: { bg: 'bg-success-bg', text: 'text-success', dot: 'bg-success', label: 'Good' },
  'needs-work': { bg: 'bg-warning-bg', text: 'text-warning', dot: 'bg-warning', label: 'Needs work' },
  missing: { bg: 'bg-danger-bg', text: 'text-danger', dot: 'bg-danger', label: 'Missing' },
} as const;

const inputBase =
  'w-full rounded-lg border border-border-default bg-white px-3 py-2 font-body text-[13px] text-text-primary outline-none transition-colors';

export function FieldInput({ field, value, fieldScore }: FieldInputProps) {
  const { updateField, aiLoadingField, setAiLoadingField, jd, templateSections, showHighlights } =
    useJDStore();

  const handleAIDraft = async () => {
    setAiLoadingField(field.id);
    try {
      const res = await fetch('/api/ai/generate-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldLabel: field.label,
          jdText: Object.entries(jd)
            .filter(([, v]) => v?.trim())
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n'),
        }),
      });
      if (res.ok) {
        const { content } = await res.json();
        updateField(field.id, content);
      }
    } catch {
      // silently fail
    } finally {
      setAiLoadingField(null);
    }
  };

  const priorityStyle = PRIORITY_STYLES[field.priority];
  const badgeStyle = fieldScore ? BADGE_STYLES[fieldScore.badge] : null;

  return (
    <div className="flex flex-col gap-[5px]">
      {/* Label row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-text-primary">
          {field.label}
          {field.required && <span className="text-brand-gold"> *</span>}
        </span>
        {showHighlights && priorityStyle && (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold',
              priorityStyle.bg,
              priorityStyle.text,
            )}
          >
            {priorityStyle.label}
          </span>
        )}
        {showHighlights && badgeStyle && (
          <span
            className={cn(
              'inline-flex items-center gap-[3px] rounded-full px-[7px] py-0.5 text-[10px] font-semibold',
              badgeStyle.bg,
              badgeStyle.text,
            )}
            title={fieldScore?.note}
          >
            <span className={cn('inline-block h-1 w-1 rounded-full', badgeStyle.dot)} />
            {badgeStyle.label}
          </span>
        )}
      </div>

      {/* Hint */}
      {field.hint && (
        <div className="text-[11px] italic leading-snug text-text-muted">{field.hint}</div>
      )}

      {/* Input */}
      {field.type === 'select' && (
        <select
          className={cn(inputBase, 'cursor-pointer appearance-none pr-7')}
          value={value || ''}
          onChange={(e) => updateField(field.id, e.target.value)}
        >
          {(field.opts || []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}

      {field.type === 'radio' && (
        <div className="flex flex-wrap gap-2">
          {(field.opts || []).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => updateField(field.id, o)}
              className={cn(
                'rounded-lg border px-4 py-[7px] font-body text-[13px] transition-all',
                value === o
                  ? 'border-brand-gold bg-brand-gold-light font-medium text-text-primary'
                  : 'border-border-default bg-white text-text-secondary',
              )}
            >
              {o}
            </button>
          ))}
        </div>
      )}

      {field.type === 'textarea' && (
        <div className="flex flex-col gap-1">
          <textarea
            className={cn(inputBase, 'resize-y leading-[1.7]')}
            style={{ minHeight: (field.rows || 3) * 22 }}
            value={value || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
          />
          {field.ai &&
            (aiLoadingField === field.id ? (
              <span className="inline-flex items-center gap-1 self-start text-[11px] text-text-muted">
                <span className="inline-block h-2 w-2 animate-spin rounded-full border border-text-muted border-t-transparent" />
                Generating...
              </span>
            ) : (
              <button
                type="button"
                onClick={handleAIDraft}
                className="inline-flex items-center gap-1 self-start rounded border border-border-default px-2 py-[3px] font-body text-[11px] text-text-muted transition-colors hover:border-brand-gold hover:text-brand-gold"
              >
                ◆ AI Draft
              </button>
            ))}
        </div>
      )}

      {(field.type === 'text' || field.type === 'date') && (
        <input
          type={field.type === 'date' ? 'date' : 'text'}
          className={inputBase}
          value={value || ''}
          onChange={(e) => updateField(field.id, e.target.value)}
        />
      )}
    </div>
  );
}
