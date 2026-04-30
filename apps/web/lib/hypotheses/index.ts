import raw from './hypotheses.json';

export type HypothesisCategory =
  | 'COG_LOW'
  | 'COG_HIGH'
  | 'EMO'
  | 'PHY'
  | 'R1_PEOPLE'
  | 'R3_FIN'
  | 'R4_STRAT'
  | 'RISK'
  | 'S2_COMM'
  | 'OTHER';

export interface Hypothesis {
  id: number;
  key: string;
  pl: string;
  category: HypothesisCategory;
}

export const HYPOTHESES: Hypothesis[] = raw as Hypothesis[];

export const CATEGORY_LABELS: Record<HypothesisCategory, { label: string; description: string; color: string }> = {
  COG_LOW: {
    label: 'Cognitive — routine',
    description: 'Hypotheses indicating routine, supervised, low-discretion work (Axiomera COG low end)',
    color: '#7A7060',
  },
  COG_HIGH: {
    label: 'Cognitive — complex',
    description: 'Hypotheses indicating problem solving, planning, project management (Axiomera COG high end)',
    color: '#1F6FEB',
  },
  S2_COMM: {
    label: 'Communication — external',
    description: 'External stakeholder management, representation (Axiomera S2)',
    color: '#2DA44E',
  },
  PHY: {
    label: 'Physical / hazardous',
    description: 'Manual work, equipment, hazardous conditions (Axiomera PHY / WC1)',
    color: '#BC4C00',
  },
  R1_PEOPLE: {
    label: 'Responsibility — people',
    description: 'Direct staff management, mentoring, hire/fire authority (Axiomera R1)',
    color: '#8250DF',
  },
  R3_FIN: {
    label: 'Responsibility — financial',
    description: 'Budget, P&L, resource allocation (Axiomera R3)',
    color: '#0969DA',
  },
  R4_STRAT: {
    label: 'Responsibility — strategic',
    description: 'Strategic direction, executive committee, board reporting (Axiomera R4)',
    color: '#9B2C2C',
  },
  RISK: {
    label: 'Risk & compliance',
    description: 'Regulatory compliance ownership, formal risk analysis',
    color: '#5C6BC0',
  },
  EMO: {
    label: 'Emotional / WC2',
    description: 'Emotional demands, care services, confidentiality (Axiomera EMO / WC2)',
    color: '#C05A0A',
  },
  OTHER: {
    label: 'Other',
    description: 'Uncategorised',
    color: '#8A8070',
  },
};

export function groupByCategory(hypotheses: Hypothesis[]): Record<HypothesisCategory, Hypothesis[]> {
  const groups = {} as Record<HypothesisCategory, Hypothesis[]>;
  for (const cat of Object.keys(CATEGORY_LABELS) as HypothesisCategory[]) groups[cat] = [];
  for (const h of hypotheses) groups[h.category].push(h);
  return groups;
}

// Verdict for a single hypothesis
export type HypothesisVerdict = 'TRUE' | 'FALSE' | 'UNKNOWN';

export interface HypothesisResult {
  id: number;
  key: string;
  verdict: HypothesisVerdict;
  /** 0-100 — how confident the AI is in the verdict */
  confidence: number;
  /** Short evidence quote from the JD, if found */
  evidence?: string;
  /** Brief reason if no evidence found */
  rationale?: string;
}

export interface HypothesesTestReport {
  jdId?: string;
  testedAt: string;
  language: 'pl' | 'en';
  totalHypotheses: number;
  trueCount: number;
  falseCount: number;
  unknownCount: number;
  results: HypothesisResult[];
  /** Aggregated by category — count and percentage of TRUE hypotheses */
  byCategory: Record<HypothesisCategory, { total: number; trueCount: number; falseCount: number; unknownCount: number; pctTrue: number }>;
}
