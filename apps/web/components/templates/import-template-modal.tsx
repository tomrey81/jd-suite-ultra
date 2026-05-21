'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface IloMissing {
  criterion: string;
  suggestedSection: string;
  suggestedField: string;
}
interface EigeMissing {
  indicator: string;
  suggestedSection: string;
  suggestedField: string;
}
interface Recommendation {
  section: string;
  fieldLabel: string;
  fieldType: string;
  rationale: string;
}
interface Assessment {
  ilo: { covered: string[]; missing: IloMissing[]; coveragePercent: number };
  eige: { covered: string[]; missing: EigeMissing[]; coveragePercent: number };
  recommendations: Recommendation[];
  overallNote: string;
}
interface ImportResult {
  templateName: string;
  templatePurpose: string;
  templateDescription: string;
  sections: any[];
  assessment: Assessment;
}

interface Props {
  onClose: () => void;
}

type Step = 'upload' | 'analysing' | 'review' | 'saving' | 'done';

export function ImportTemplateModal({ onClose }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [includeRecommendations, setIncludeRecommendations] = useState(false);

  const analyse = async () => {
    if (!file) return;
    setError(null);
    setStep('analysing');

    const form = new FormData();
    form.append('file', file);
    form.append('name', name || file.name.replace(/\.[^.]+$/, ''));

    try {
      const res = await fetch('/api/templates/import-from-file', { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Analysis failed (${res.status})`);
      }
      const data: ImportResult = await res.json();
      setResult(data);
      setTemplateName(data.templateName || name || 'Imported Template');
      setStep('review');
    } catch (err: any) {
      setError(err.message);
      setStep('upload');
    }
  };

  const save = async () => {
    if (!result) return;
    setError(null);
    setStep('saving');

    let sections = result.sections;

    // Optionally append recommended fields as a new section
    if (includeRecommendations && result.assessment.recommendations.length > 0) {
      const recFields = result.assessment.recommendations.map((r, i) => ({
        id: `rec-field-${i}`,
        label: r.fieldLabel,
        type: r.fieldType || 'textarea',
        required: false,
        hint: `Recommended for ILO/EIGE compliance: ${r.rationale}`,
        rows: r.fieldType === 'textarea' ? 4 : undefined,
        ai: true,
        priority: 'should-have',
      }));
      sections = [
        ...sections,
        {
          id: 'compliance-additions',
          title: 'Compliance Additions (ILO / EIGE)',
          desc: 'Fields recommended to improve pay equity and gender equality compliance.',
          required: false,
          fields: recFields,
        },
      ];
    }

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          purpose: result.templatePurpose || 'general',
          description: result.templateDescription || '',
          sections,
          isDefault: false,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Save failed (${res.status})`);
      }
      const saved = await res.json();
      setStep('done');
      router.refresh();
      setTimeout(() => {
        onClose();
        router.push(`/templates/${saved.id}`);
      }, 1200);
    } catch (err: any) {
      setError(err.message);
      setStep('review');
    }
  };

  const coverageBar = (pct: number) => (
    <div className="h-1.5 w-full rounded-full bg-surface-page">
      <div
        className="h-1.5 rounded-full"
        style={{
          width: `${pct}%`,
          backgroundColor: pct >= 70 ? '#2DA44E' : pct >= 40 ? '#8A7560' : '#BC4C00',
        }}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border-default bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-text-primary">
            Import Template from File
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-lg leading-none"
          >
            x
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-md border border-danger/30 bg-danger-bg p-3 text-xs text-danger">
              {error}
            </div>
          )}

          {/* STEP: upload */}
          {(step === 'upload' || step === 'analysing') && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Upload your existing JD template. JD Suite will analyse its structure, map it to a
                compatible template, and assess it against ILO pay equity and EIGE gender equality
                criteria.
              </p>
              <p className="text-xs text-text-muted">
                Accepted formats: .docx, .pdf, .xlsx, .pptx, .txt. Max 2 MB.
              </p>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Template name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Corp JD Standard"
                  className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:border-brand-gold focus:outline-none"
                />
              </div>

              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".docx,.pdf,.xlsx,.pptx,.txt"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-border-default py-8 text-center text-sm text-text-muted transition hover:border-brand-gold hover:text-brand-gold"
                >
                  {file ? (
                    <span className="text-text-primary font-medium">{file.name}</span>
                  ) : (
                    'Click to select file'
                  )}
                </button>
              </div>

              <button
                onClick={analyse}
                disabled={!file || step === 'analysing'}
                className="w-full rounded-full bg-brand-gold py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {step === 'analysing' ? 'Analysing...' : 'Analyse Template'}
              </button>
            </div>
          )}

          {/* STEP: review */}
          {step === 'review' && result && (
            <div className="space-y-5">
              {/* Template name */}
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Template name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:border-brand-gold focus:outline-none"
                />
              </div>

              {/* Description */}
              {result.templateDescription && (
                <p className="text-sm text-text-secondary">{result.templateDescription}</p>
              )}

              {/* Structure summary */}
              <div className="rounded-lg border border-border-default bg-surface-page p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Proposed Structure
                </div>
                <div className="space-y-1.5">
                  {result.sections.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-text-primary">{s.title}</span>
                      <span className="text-xs text-text-muted">{s.fields?.length ?? 0} fields</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ILO coverage */}
              <div className="rounded-lg border border-border-default bg-surface-page p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    ILO Pay Equity Coverage
                  </span>
                  <span className="text-xs font-medium text-text-primary">
                    {result.assessment.ilo.coveragePercent}%
                  </span>
                </div>
                {coverageBar(result.assessment.ilo.coveragePercent)}
                {result.assessment.ilo.missing.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {result.assessment.ilo.missing.slice(0, 5).map((m) => (
                      <div key={m.criterion} className="text-[11px] text-text-muted">
                        <span className="text-danger font-medium">{m.criterion}</span> — add
                        "{m.suggestedField}" to {m.suggestedSection}
                      </div>
                    ))}
                    {result.assessment.ilo.missing.length > 5 && (
                      <div className="text-[11px] text-text-muted">
                        +{result.assessment.ilo.missing.length - 5} more gaps
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* EIGE coverage */}
              <div className="rounded-lg border border-border-default bg-surface-page p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    EIGE Gender Equality Coverage
                  </span>
                  <span className="text-xs font-medium text-text-primary">
                    {result.assessment.eige.coveragePercent}%
                  </span>
                </div>
                {coverageBar(result.assessment.eige.coveragePercent)}
                {result.assessment.eige.missing.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {result.assessment.eige.missing.slice(0, 4).map((m) => (
                      <div key={m.indicator} className="text-[11px] text-text-muted">
                        <span className="text-danger font-medium">{m.indicator}</span> — add
                        "{m.suggestedField}" to {m.suggestedSection}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Overall note */}
              {result.assessment.overallNote && (
                <p className="text-xs text-text-secondary">{result.assessment.overallNote}</p>
              )}

              {/* Include recommendations checkbox */}
              {result.assessment.recommendations.length > 0 && (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-default p-3 hover:border-brand-gold/50">
                  <input
                    type="checkbox"
                    checked={includeRecommendations}
                    onChange={(e) => setIncludeRecommendations(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      Add {result.assessment.recommendations.length} recommended compliance fields
                    </div>
                    <div className="text-xs text-text-muted">
                      Appends a "Compliance Additions" section with ILO/EIGE gap fields. You can
                      edit or remove them after saving.
                    </div>
                  </div>
                </label>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setStep('upload'); setResult(null); }}
                  className="flex-1 rounded-full border border-border-default py-2.5 text-sm text-text-secondary hover:border-brand-gold/50"
                >
                  Back
                </button>
                <button
                  onClick={save}
                  disabled={!templateName.trim()}
                  className="flex-1 rounded-full bg-brand-gold py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  Save Template
                </button>
              </div>
            </div>
          )}

          {/* STEP: saving */}
          {step === 'saving' && (
            <div className="py-12 text-center text-sm text-text-muted">Saving template...</div>
          )}

          {/* STEP: done */}
          {step === 'done' && (
            <div className="py-12 text-center">
              <div className="text-2xl text-brand-gold mb-2">ok</div>
              <div className="text-sm text-text-secondary">Template saved. Redirecting...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
