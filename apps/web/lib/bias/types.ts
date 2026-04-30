// JD Suite v5 — bias engine types. Mirrors spec §11.

export type Language = 'en' | 'pl';
export type LexiconCategory = 'agentic' | 'communal';
export type Severity = 'low' | 'medium' | 'high' | 'block';
export type PatternType = 'word' | 'regex';

export interface LexiconEntry {
  language: Language;
  codeType: LexiconCategory;
  patternType: PatternType;
  pattern: string;
  severity: Severity;
  notes: string;
  source: string;
  version: string;
}

export interface TitlePair {
  language: Language;
  masculine: string;
  feminine: string;
  neutral: string;
  severityIfSingular: Severity;
  notes: string;
}

export interface BiasFlag {
  layer: 'lexical' | 'title' | 'structural' | 'implicit';
  category: LexiconCategory | 'title-singular' | 'eige-coverage' | 'implicit-bias';
  severity: Severity;
  start: number;
  end: number;
  matched: string;
  pattern: string;
  notes: string;
  source: string;
  remediation?: string;
}

export interface BiasReport {
  language: Language;
  inputLength: number;
  agenticCount: number;
  communalCount: number;
  // Skew score in [-1, +1]. Positive = agentic-skewed, negative = communal-skewed.
  skewScore: number;
  // Severity bucket from |skewScore|: balanced (<0.25), soft warn (0.25..0.5), hard warn (>=0.5)
  skewLevel: 'balanced' | 'soft_warn' | 'hard_warn';
  flags: BiasFlag[];
  // Layer 3 (structural) — EIGE coverage for E1/E2/E3
  eigeCoverage: {
    cognitive: boolean;   // E1
    emotional: boolean;   // E2 — the canonical pink-job miss
    physical: boolean;    // E3
  };
  // Layer 4 — Iceland implicit-bias warnings
  implicit: {
    pinkJobUndervaluation: boolean;
    machoLeadership: boolean;
    elektromonterTrap: boolean;
  };
}
