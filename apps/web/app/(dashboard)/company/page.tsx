'use client';

import { useState, useEffect } from 'react';

interface CompanyData {
  name: string;
  country: string;
  size: 'micro' | 'small' | 'medium' | 'large';
  fte: string;
  industry: string;
  prevEval: boolean;
  prevMethod: string;
  prevYear: string;
  goal: string;
}

const SIZES = [
  { value: 'micro', label: 'Micro (<10)' },
  { value: 'small', label: 'Small (10-49)' },
  { value: 'medium', label: 'Medium (50-249)' },
  { value: 'large', label: 'Large (250+)' },
] as const;

const GOALS = [
  { value: 'eu_directive_compliance', label: 'EU Directive 2023/970 compliance' },
  { value: 'pay_equity_audit', label: 'Pay equity audit' },
  { value: 'restructuring', label: 'Restructuring / reorg' },
  { value: 'new_system', label: 'New pay system' },
  { value: 'other', label: 'Other' },
] as const;

const EIGE_PATHWAY: Record<string, string> = {
  micro: 'Micro (graduated factor method)',
  small: 'SME (pair comparison method)',
  medium: 'Large (point-factor method)',
  large: 'Large (point-factor method)',
};

const inputCls = 'w-full rounded-md border border-border-default bg-white px-3 py-2 font-body text-[13px] text-text-primary outline-none';

export default function CompanyPage() {
  const [co, setCo] = useState<CompanyData>({
    name: '', country: 'PL', size: 'medium', fte: '', industry: '',
    prevEval: false, prevMethod: '', prevYear: '', goal: 'eu_directive_compliance',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // TODO: Load from API once org settings endpoint exists
  }, []);

  const save = () => {
    // TODO: Save to API
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[820px]">
        <h1 className="mb-1 font-display text-2xl font-bold text-text-primary">Company Profile</h1>
        <p className="mb-6 text-[13px] leading-normal text-text-secondary">
          Organisation context calibrates EIGE pathway, country overlay, SWP hypotheses and Axiomera signals.
        </p>

        <div className="mb-5 grid grid-cols-2 gap-5">
          {/* Organisation Identity */}
          <div className="rounded-lg border border-border-default bg-white p-[22px]">
            <h2 className="mb-3.5 font-display text-[0.95rem] font-semibold">Organisation Identity</h2>
            {[
              { l: 'Company name', k: 'name' as const, ph: 'e.g. EUPTD Enterprises' },
              { l: 'Country (HQ)', k: 'country' as const, ph: 'PL / DE / CZ...' },
              { l: 'Industry', k: 'industry' as const, ph: 'e.g. Logistics & Supply Chain' },
              { l: 'Total FTE', k: 'fte' as const, ph: 'e.g. 850' },
            ].map(({ l, k, ph }) => (
              <div key={k} className="mb-3">
                <label className="mb-1 block text-[11px] font-semibold text-text-primary">{l}</label>
                <input
                  value={co[k]} onChange={(e) => setCo({ ...co, [k]: e.target.value })}
                  placeholder={ph} className={inputCls}
                />
              </div>
            ))}
            <div className="mb-3">
              <label className="mb-1.5 block text-[11px] font-semibold text-text-primary">Organisation size</label>
              <div className="flex flex-wrap gap-[7px]">
                {SIZES.map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => setCo({ ...co, size: value })}
                    className={`rounded-md border px-3 py-[5px] font-body text-xs transition-all ${co.size === value ? 'border-brand-gold bg-brand-gold-light' : 'border-border-default bg-white'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Evaluation History */}
          <div className="rounded-lg border border-border-default bg-white p-[22px]">
            <h2 className="mb-3.5 font-display text-[0.95rem] font-semibold">Evaluation History</h2>
            <label className="mb-3.5 flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={co.prevEval} onChange={(e) => setCo({ ...co, prevEval: e.target.checked })} />
              <span className="font-body text-xs text-text-primary">Roles were previously evaluated</span>
            </label>
            {co.prevEval && (
              <>
                {[
                  { l: 'Methodology used', k: 'prevMethod' as const, ph: 'Hay / Mercer / WTW / Aon / other' },
                  { l: 'Year of last evaluation', k: 'prevYear' as const, ph: 'e.g. 2019' },
                ].map(({ l, k, ph }) => (
                  <div key={k} className="mb-3">
                    <label className="mb-1 block text-[11px] font-semibold text-text-primary">{l}</label>
                    <input value={co[k]} onChange={(e) => setCo({ ...co, [k]: e.target.value })} placeholder={ph} className={inputCls} />
                  </div>
                ))}
              </>
            )}
            <div className="mb-3.5">
              <label className="mb-1.5 block text-[11px] font-semibold text-text-primary">Project goal</label>
              {GOALS.map(({ value, label }) => (
                <label key={value} className="mb-1.5 flex cursor-pointer items-center gap-[7px] font-body text-xs">
                  <input type="radio" checked={co.goal === value} onChange={() => setCo({ ...co, goal: value })} />
                  {label}
                </label>
              ))}
            </div>
            <div className="rounded-lg bg-info-bg p-3 text-[11px] leading-relaxed text-info">
              <strong>EIGE Pathway:</strong> {EIGE_PATHWAY[co.size]}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={save} className="rounded-md bg-brand-gold px-4 py-2 text-sm font-medium text-white">
            Save Company Profile
          </button>
          {saved && <span className="text-xs font-medium text-success">Saved</span>}
        </div>
      </div>
    </div>
  );
}
