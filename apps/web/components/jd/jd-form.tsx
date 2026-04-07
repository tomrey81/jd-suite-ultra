'use client';

import { useJDStore } from '@/hooks/use-jd-store';
import { FieldInput } from './field-input';

export function JDForm() {
  const { jd, templateSections, activeSectionId, setActiveSectionId, fieldScores } = useJDStore();

  const sec = templateSections.find((s) => s.id === activeSectionId);
  const idx = templateSections.findIndex((s) => s.id === activeSectionId);
  const prev = idx > 0 ? templateSections[idx - 1] : null;
  const next = idx < templateSections.length - 1 ? templateSections[idx + 1] : null;

  if (!sec) return null;

  // Grid layout for sections with many short fields (like Section A)
  const shortFields = sec.fields.filter(
    (f) => f.type === 'text' || f.type === 'date' || f.type === 'select',
  );
  const longFields = sec.fields.filter((f) => f.type === 'textarea' || f.type === 'radio');
  const needsGrid = shortFields.length >= 4;

  const renderField = (f: (typeof sec.fields)[number]) => (
    <FieldInput key={f.id} field={f} value={jd[f.id] || ''} fieldScore={fieldScores[f.id]} />
  );

  return (
    <div className="mx-auto max-w-[820px]">
      {/* Section header */}
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-brand-gold">
        Section {sec.id}
      </div>
      <h2 className="mb-1 font-display text-2xl font-bold leading-tight text-text-primary">
        {sec.title}
      </h2>
      <p className="mb-[22px] border-b-2 border-border-default pb-[18px] text-[13px] leading-normal text-text-secondary">
        {sec.desc}
      </p>

      {/* Fields */}
      <div className="flex flex-col gap-[22px]">
        {needsGrid && shortFields.length > 0 && (
          <div className="grid grid-cols-2 gap-5">{shortFields.map(renderField)}</div>
        )}
        {longFields.map(renderField)}
        {!needsGrid && shortFields.map(renderField)}
      </div>

      {/* Navigation */}
      <div className="mt-7 flex items-center justify-between border-t border-border-default pt-5">
        <button
          type="button"
          disabled={!prev}
          onClick={() => prev && setActiveSectionId(prev.id)}
          className="rounded-md border border-border-default px-4 py-[7px] text-[13px] font-medium text-text-secondary transition-colors disabled:opacity-40"
        >
          ← {prev ? `${prev.id}: ${prev.title}` : 'First'}
        </button>
        {next ? (
          <button
            type="button"
            onClick={() => setActiveSectionId(next.id)}
            className="rounded-md bg-surface-header px-4 py-[7px] text-[13px] font-medium text-text-on-dark"
          >
            {next.id}: {next.title} →
          </button>
        ) : (
          <button
            type="button"
            className="rounded-md bg-brand-gold px-4 py-[7px] text-[13px] font-medium text-white"
          >
            JD Complete ◆ Get Review
          </button>
        )}
      </div>
    </div>
  );
}
