'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  sections: Section[];
  assessment: Assessment;
}

interface Section {
  id: string;
  title: string;
  desc?: string;
  fields?: unknown[];
}

// UI is either on the upload form or the review panel. Loading states are
// tracked separately so TypeScript does not narrow us into a corner.
type Step = 'upload' | 'review' | 'done';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportTemplatePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [isLoading, setIsLoading] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<ImportResult | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [includeRecommendations, setIncludeRecommendations] = useState(false);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const analyse = async () => {
    if (!file || isLoading) return;
    setError(null);
    setIsLoading(true);

    const form = new FormData();
    form.append('file', file);
    form.append('name', name.trim() || file.name.replace(/\.[^.]+$/, ''));

    try {
      const res = await fetch('/api/templates/import-from-file', { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(typeof err.error === 'string' ? err.error : `Analysis failed (${res.status})`);
      }
      const data = await res.json() as ImportResult;
      setResult(data);
      setTemplateName(data.templateName || name.trim() || 'Imported Template');
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const save = async () => {
    if (!result || isLoading) return;
    setError(null);
    setIsLoading(true);

    let sections = result.sections;

    if (includeRecommendations && result.assessment.recommendations.length > 0) {
      const complianceFields = result.assessment.recommendations.map((r, i) => ({
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
          fields: complianceFields,
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
        const err = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(typeof err.error === 'string' ? err.error : `Save failed (${res.status})`);
      }

      const saved = await res.json() as { id: string };
      setStep('done');
      setTimeout(() => router.push(`/templates/${saved.id}`), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setResult(null);
    setError(null);
    setIsLoading(false);
  };

  // -------------------------------------------------------------------------
  // Sub-renders
  // -------------------------------------------------------------------------

  const CoverageBar = ({ pct }: { pct: number }) => (
    <div className="h-2 w-full rounded-full bg-surface-page">
      <div
        className="h-2 rounded-full transition-all"
        style={{
          width: `${pct}%`,
          backgroundColor: pct >= 70 ? '#2DA44E' : pct >= 40 ? '#8A7560' : '#BC4C00',
        }}
      />
    </div>
  );

  // -------------------------------------------------------------------------
  // Render: done
  // -------------------------------------------------------------------------

  if (step === 'done') {
    return (
      <div className="rounded-2xl border border-border-default bg-white p-16 text-center">
        <div className="text-3xl font-semibold text-brand-gold mb-2">Saved</div>
        <p className="text-sm text-text-secondary">Redirecting to template editor...</p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: main
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md border border-danger/30 bg-danger-bg p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Upload form */}
      {step === 'upload' && (
        <div className="rounded-2xl border border-border-default bg-white p-8 space-y-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Template name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Billennium JD Standard, MPWiK PSC, Merz Pharma"
              className="w-full rounded-lg border border-border-default px-3 py-2.5 text-sm focus:border-brand-gold focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-text-muted">
              This becomes the template name in JD Suite. You can edit it before saving.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Template file
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".docx,.pdf,.xlsx,.pptx,.txt"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-border-default py-12 text-center transition hover:border-brand-gold hover:bg-brand-gold/5"
            >
              {file ? (
                <div>
                  <div className="text-base font-medium text-text-primary">{file.name}</div>
                  <div className="mt-1 text-xs text-text-muted">
                    {(file.size / 1024).toFixed(0)} KB - click to change
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-text-muted">Click to select file</div>
                  <div className="mt-1 text-xs text-text-muted">
                    .docx, .pdf, .xlsx, .pptx, .txt - max 2 MB
                  </div>
                </div>
              )}
            </button>
          </div>

          <div className="rounded-lg bg-surface-page p-4 text-[12px] text-text-muted space-y-1">
            <div className="font-medium text-text-secondary mb-1">What happens next</div>
            <div>1. JD Suite extracts text from your file and sends it to Claude for analysis.</div>
            <div>2. The AI maps your template structure to JD Suite sections and fields.</div>
            <div>3. You get an ILO pay equity and EIGE gender equality gap assessment.</div>
            <div>4. You review the proposed template, optionally add compliance fields, then save.</div>
          </div>

          <button
            onClick={analyse}
            disabled={!file || isLoading}
            className="w-full rounded-full bg-brand-gold py-3 text-sm font-medium text-white disabled:opacity-50 hover:bg-brand-gold/90"
          >
            {isLoading ? 'Analysing - this takes 20-40 seconds...' : 'Analyse Template'}
          </button>
        </div>
      )}

      {/* Review panel */}
      {step === 'review' && result && (
        <>
          {/* Template name */}
          <div className="rounded-2xl border border-border-default bg-white p-6">
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Template name
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full rounded-lg border border-border-default px-3 py-2.5 text-sm focus:border-brand-gold focus:outline-none"
            />
            {result.templateDescription && (
              <p className="mt-2 text-sm text-text-secondary">{result.templateDescription}</p>
            )}
          </div>

          {/* Proposed structure */}
          <div className="rounded-2xl border border-border-default bg-white p-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Proposed Structure - {result.sections.length} sections
            </div>
            <div className="divide-y divide-border-default">
              {result.sections.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="text-sm font-medium text-text-primary">{s.title}</span>
                    {s.desc && (
                      <span className="ml-2 text-xs text-text-muted">{s.desc}</span>
                    )}
                  </div>
                  <span className="text-xs text-text-muted shrink-0 ml-4">
                    {Array.isArray(s.fields) ? s.fields.length : 0} fields
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ILO pay equity */}
          <div className="rounded-2xl border border-border-default bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                ILO Pay Equity Coverage
              </span>
              <span className="text-sm font-semibold text-text-primary">
                {result.assessment.ilo.coveragePercent}%
                <span className="ml-1 text-xs font-normal text-text-muted">
                  ({result.assessment.ilo.covered.length}/
                  {result.assessment.ilo.covered.length + result.assessment.ilo.missing.length} criteria)
                </span>
              </span>
            </div>
            <CoverageBar pct={result.assessment.ilo.coveragePercent} />
            {result.assessment.ilo.missing.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                  Missing criteria
                </div>
                {result.assessment.ilo.missing.map((m) => (
                  <div key={m.criterion} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-danger shrink-0" />
                    <span>
                      <span className="font-medium text-text-primary">{m.criterion}</span>
                      <span className="text-text-muted">
                        {' '}— add &ldquo;{m.suggestedField}&rdquo; to {m.suggestedSection}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {result.assessment.ilo.covered.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.assessment.ilo.covered.map((c) => (
                  <span key={c} className="rounded-full bg-success-bg px-2 py-0.5 text-[10px] text-success">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* EIGE gender equality */}
          <div className="rounded-2xl border border-border-default bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                EIGE Gender Equality Coverage
              </span>
              <span className="text-sm font-semibold text-text-primary">
                {result.assessment.eige.coveragePercent}%
              </span>
            </div>
            <CoverageBar pct={result.assessment.eige.coveragePercent} />
            {result.assessment.eige.missing.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                  Missing indicators
                </div>
                {result.assessment.eige.missing.map((m) => (
                  <div key={m.indicator} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                    <span>
                      <span className="font-medium text-text-primary">{m.indicator}</span>
                      <span className="text-text-muted">
                        {' '}— add &ldquo;{m.suggestedField}&rdquo; to {m.suggestedSection}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assessment summary */}
          {result.assessment.overallNote && (
            <div className="rounded-2xl border border-border-default bg-white p-6">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
                Assessment summary
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {result.assessment.overallNote}
              </p>
            </div>
          )}

          {/* Compliance recommendations */}
          {result.assessment.recommendations.length > 0 && (
            <div className="rounded-2xl border border-border-default bg-white p-6">
              <label className="flex cursor-pointer items-start gap-3">
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
                  <div className="mt-0.5 text-xs text-text-muted">
                    Appends a &ldquo;Compliance Additions (ILO / EIGE)&rdquo; section. You can edit or remove fields after saving.
                  </div>
                </div>
              </label>
              {includeRecommendations && (
                <div className="mt-4 space-y-2 border-t border-border-default pt-4">
                  {result.assessment.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <span className="rounded bg-brand-gold/10 px-1.5 py-0.5 text-brand-gold font-medium shrink-0">
                        {r.fieldType}
                      </span>
                      <div>
                        <span className="font-medium text-text-primary">{r.fieldLabel}</span>
                        <span className="text-text-muted"> in {r.section}</span>
                        <div className="text-text-muted mt-0.5">{r.rationale}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={reset}
              disabled={isLoading}
              className="flex-1 rounded-full border border-border-default py-3 text-sm text-text-secondary hover:border-brand-gold/50 disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={save}
              disabled={!templateName.trim() || isLoading}
              className="flex-1 rounded-full bg-brand-gold py-3 text-sm font-medium text-white disabled:opacity-50 hover:bg-brand-gold/90"
            >
              {isLoading ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
