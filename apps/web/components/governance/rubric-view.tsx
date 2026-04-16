'use client';

import { useState } from 'react';

// The 25 deterministic lint rules per the Governance Console spec
const RULES = {
  structure: [
    { id: 'A1', label: 'All 10 canonical sections present and non-empty' },
    { id: 'A2', label: 'Role Summary word count <= 80' },
    { id: 'A3', label: 'Each responsibility starts with a verb' },
    { id: 'A4', label: 'Must-Haves <= 7 items' },
    { id: 'A5', label: 'Nice-to-Haves separated and non-empty' },
    { id: 'A6', label: 'No duplicate strings within any list section' },
    { id: 'A7', label: 'Flesch-Kincaid reading grade <= 12' },
    { id: 'A8', label: 'No internal-only language detected' },
  ],
  bias: [
    { id: 'B1', label: 'No gender-coded terms' },
    { id: 'B2', label: 'No age-coded terms' },
    { id: 'B3', label: 'No rockstar/ninja/guru language' },
    { id: 'B4', label: 'Years of experience <= 10 (or justified)' },
    { id: 'B5', label: 'Degree requirement justified' },
    { id: 'B6', label: 'No unjustified native-language requirement' },
    { id: 'B7', label: 'Disability/accommodation statement present' },
    { id: 'B8', label: 'Pronouns neutral or inclusive' },
    { id: 'B9', label: 'No nationality/citizenship requirement without legal basis' },
  ],
  euptd: [
    { id: 'C1', label: 'Pay range present (min-max)' },
    { id: 'C2', label: 'Pay range currency specified (ISO)' },
    { id: 'C3', label: 'Pay basis specified (annual/monthly, gross/net)' },
    { id: 'C4', label: 'Pay components disclosed (base, variable, benefits)' },
    { id: 'C5', label: 'Job level reference present (descriptive)' },
    { id: 'C6', label: 'Selection criteria stated objectively' },
    { id: 'C7', label: 'Career progression statement present' },
    { id: 'C8', label: 'Right-to-information statement present' },
  ],
};

const WEIGHTS = { structure: 0.30, bias: 0.35, euptd: 0.35 };

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">{label}</span>
        <span className="font-mono text-sm font-bold" style={{ color }}>{score}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-border-default/40">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function RubricView() {
  const [selectedCategory, setSelectedCategory] = useState<'structure' | 'bias' | 'euptd'>('structure');

  // Placeholder scores (will be computed from JD data in Gate 2)
  const scores = { structure: 0, bias: 0, euptd: 0 };
  const total = Math.round(scores.structure * WEIGHTS.structure + scores.bias * WEIGHTS.bias + scores.euptd * WEIGHTS.euptd);

  const categories = [
    { key: 'structure' as const, label: 'Structure', count: RULES.structure.length, weight: '30%', color: '#2E7D88' },
    { key: 'bias' as const, label: 'Bias & Inclusivity', count: RULES.bias.length, weight: '35%', color: '#6B3FA0' },
    { key: 'euptd' as const, label: 'EUPTD Pay Transparency', count: RULES.euptd.length, weight: '35%', color: '#C05A0A' },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border-default bg-surface-card px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-display text-lg text-text-primary">Rubric</h1>
            <p className="text-xs text-text-muted">25 deterministic rules across 3 categories. No LLM judgment, only code.</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="rounded-md border border-border-default bg-surface-page px-4 py-2 text-center">
              <div className="text-[9px] uppercase tracking-wider text-text-muted">Total Score</div>
              <div className="font-mono text-2xl font-bold text-text-primary">{total}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Score Panel */}
        <div className="w-[280px] shrink-0 overflow-y-auto border-r border-border-default bg-surface-card p-5">
          <ScoreBar label="Structure (30%)" score={scores.structure} color="#2E7D88" />
          <ScoreBar label="Bias & Inclusivity (35%)" score={scores.bias} color="#6B3FA0" />
          <ScoreBar label="EUPTD Readiness (35%)" score={scores.euptd} color="#C05A0A" />

          <div className="mt-6 rounded-md border border-border-default bg-surface-page p-3">
            <div className="text-[9px] uppercase tracking-wider text-text-muted">Scoring Formula</div>
            <div className="mt-1 font-mono text-[10px] text-text-secondary">
              total = round(struct * 0.30 + bias * 0.35 + euptd * 0.35)
            </div>
            <div className="mt-2 text-[10px] text-text-muted">
              Each rule: pass = 1, fail = 0. Category = (passed / total) x 100.
            </div>
          </div>

          <div className="mt-6 rounded-md border border-warning/30 bg-warning-bg/50 p-3 text-xs text-text-secondary">
            Select a JD from the Library to run the linter. All 25 rules execute deterministically in the browser.
          </div>
        </div>

        {/* Right: Rules */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Category tabs */}
          <div className="mb-5 flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  selectedCategory === cat.key
                    ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                    : 'border-border-default bg-surface-card text-text-muted hover:text-text-secondary'
                }`}
              >
                {cat.label} ({cat.count}) [{cat.weight}]
              </button>
            ))}
          </div>

          {/* Rules list */}
          <div className="space-y-2">
            {RULES[selectedCategory].map((rule) => (
              <div
                key={rule.id}
                className="flex items-start gap-3 rounded-md border border-border-default bg-surface-card p-3"
              >
                <span className="mt-0.5 shrink-0 rounded border border-text-muted/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-text-muted">
                  {rule.id}
                </span>
                <div className="flex-1">
                  <div className="text-xs text-text-primary">{rule.label}</div>
                </div>
                <span className="shrink-0 rounded bg-surface-page px-2 py-0.5 text-[10px] text-text-muted">
                  pending
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
