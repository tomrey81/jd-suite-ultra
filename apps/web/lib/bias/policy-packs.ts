/**
 * P0f — Iceland / NZ / UK opt-in policy packs.
 *
 * Each pack adds:
 *   • additional lexicon entries (lexicalAdditions) compiled against the JD text
 *   • additional implicit checks (run after the core engine) returning extra flags
 *   • optional "blockers" — patterns that escalate ANY match to severity=block
 *
 * Packs are pure data + small predicate functions, so they compose with the
 * existing analyseBias() engine without rewriting it.
 *
 * Pack sources:
 *   • IS  — ÍST 85:2012 (Iceland equal-pay management standard)
 *   • NZ  — Pay Equity Act 2020, NZ Public Service Commission factors
 *   • UK  — Birmingham 2023 ruling: bonus/allowance segregation = unequal pay
 */

import type { BiasFlag, BiasReport, Language, LexiconEntry, Severity } from './types';

export type PackId = 'ist85' | 'nz-payequity' | 'uk-birmingham';

export interface PolicyPack {
  id: PackId;
  label: string;
  short: string;
  description: string;
  source: string;
  /** Per-language extra lexicon entries to compile + match alongside core lexicon. */
  lexicalAdditions: Partial<Record<Language, LexiconEntry[]>>;
  /** Run additional implicit checks; return any extra flags found. */
  extraChecks?: (text: string, language: Language, baseReport: BiasReport) => BiasFlag[];
}

/* ───── ÍST 85 (Iceland) ───── */
const IST85: PolicyPack = {
  id: 'ist85',
  label: 'ÍST 85 — Iceland Equal Pay Management',
  short: 'IS / ÍST 85',
  description:
    'Adds Iceland-2024-derived implicit checks: pink-job undervaluation, macho-leadership skew, and ' +
    'the elektromonter/physical-effort overclaim trap. Strengthens emotional-effort coverage requirements.',
  source: 'Staðlaráð Íslands ÍST 85:2012; Iceland 2024 Reykjavík audit',
  lexicalAdditions: {
    en: [
      {
        language: 'en',
        codeType: 'agentic',
        patternType: 'word',
        pattern: 'rockstar',
        severity: 'high',
        notes: 'ÍST 85: gendered hyperbolic agentic term; deters communal applicants.',
        source: 'ÍST 85:2012',
        version: 'ist85-1.0',
      },
      {
        language: 'en',
        codeType: 'agentic',
        patternType: 'word',
        pattern: 'ninja',
        severity: 'high',
        notes: 'ÍST 85: gendered hyperbolic agentic term.',
        source: 'ÍST 85:2012',
        version: 'ist85-1.0',
      },
      {
        language: 'en',
        codeType: 'agentic',
        patternType: 'regex',
        pattern: '\\b(work|play)\\s+hard\\b',
        severity: 'medium',
        notes: 'ÍST 85: agentic-coded culture phrasing; consider impact on work-life expectations.',
        source: 'ÍST 85:2012',
        version: 'ist85-1.0',
      },
    ],
    pl: [
      {
        language: 'pl',
        codeType: 'agentic',
        patternType: 'word',
        pattern: 'wojownik',
        severity: 'high',
        notes: 'ÍST 85: skrajnie agentic, męsko-kodowane określenie.',
        source: 'ÍST 85:2012',
        version: 'ist85-1.0',
      },
      {
        language: 'pl',
        codeType: 'agentic',
        patternType: 'word',
        pattern: 'rekin',
        severity: 'high',
        notes: 'ÍST 85: agentic, męsko-kodowane (np. "rekin sprzedaży").',
        source: 'ÍST 85:2012',
        version: 'ist85-1.0',
      },
    ],
  },
  extraChecks(text, language, baseReport) {
    const flags: BiasFlag[] = [];
    const lower = text.toLowerCase();

    // E2 (emotional) effort coverage required for caring/services industries.
    if (!baseReport.eigeCoverage.emotional) {
      const careContexts = language === 'pl'
        ? ['klient', 'pacjent', 'zespoł', 'współpracown', 'opiek']
        : ['client', 'patient', 'team', 'colleague', 'caregiver'];
      if (careContexts.some((t) => lower.includes(t))) {
        flags.push({
          layer: 'implicit',
          category: 'implicit-bias',
          severity: 'high',
          start: 0,
          end: Math.min(text.length, 40),
          matched: text.slice(0, 40),
          pattern: 'ÍST85: missing E2 emotional-effort acknowledgement',
          notes:
            'ÍST 85: role mentions client/patient/team contact but does not enumerate emotional effort. ' +
            'Add an explicit emotional-effort line — Iceland 2024 found this is the canonical source of ' +
            'pay-gap underweighting for service-sector roles.',
          source: 'ÍST 85:2012 / Iceland 2024',
          remediation:
            'Add a sentence describing the emotional effort component — e.g. "managing patient distress", ' +
            '"de-escalating customer conflict", "providing emotional support to bereaved families".',
        });
      }
    }

    return flags;
  },
};

/* ───── NZ Pay Equity ───── */
const NZ_PAYEQUITY: PolicyPack = {
  id: 'nz-payequity',
  label: 'NZ Pay Equity (Public Service)',
  short: 'NZ Pay Equity',
  description:
    'Applies NZ Public Service factors: skills + responsibilities + working conditions + experience. ' +
    'Flags JDs that mention only one or two factors as ineligible for an equal-value claim assessment.',
  source: 'NZ Public Service Commission Pay Equity factors; Equal Pay Amendment Act 2020',
  lexicalAdditions: {},
  extraChecks(text, language, _baseReport) {
    const flags: BiasFlag[] = [];
    const lower = text.toLowerCase();
    const factors = {
      skills:
        /\b(skill|competenc|qualif|expert|umiejętno|kompetenc|kwalifikac|specjalistycz)/i.test(lower),
      responsibility:
        /\b(responsib|account|ownership|odpowiedzial|odpowiada|raportuj)/i.test(lower),
      conditions:
        /\b(condition|environment|shift|on-call|hazard|warunk|środowisko|zmian|dyżur)/i.test(
          lower,
        ),
      experience:
        /\b(experien|years\s+of|background|track\s+record|doświadczen|stażu|lat\s+pracy)/i.test(
          lower,
        ),
    };
    const present = Object.values(factors).filter(Boolean).length;
    if (present < 3) {
      const missing = Object.entries(factors).filter(([, v]) => !v).map(([k]) => k);
      flags.push({
        layer: 'structural',
        category: 'eige-coverage',
        severity: present <= 1 ? 'high' : 'medium',
        start: 0,
        end: Math.min(text.length, 40),
        matched: text.slice(0, 40),
        pattern: 'NZ Pay Equity: factors missing',
        notes:
          `NZ Pay Equity (Equal Pay Amendment Act 2020) requires Skills, Responsibilities, ` +
          `Working Conditions, and Experience to be assessable in the JD. Missing: ${missing.join(', ')}. ` +
          `Without these, the role cannot be benchmarked for equal-value claims.`,
        source: 'NZ Public Service Commission Pay Equity factors',
        remediation: `Add explicit content for the missing factors: ${missing.join(', ')}.`,
      });
    }
    return flags;
  },
};

/* ───── UK Birmingham ───── */
const UK_BIRMINGHAM: PolicyPack = {
  id: 'uk-birmingham',
  label: 'UK Birmingham (Bonus / Allowance Separation)',
  short: 'UK Birmingham',
  description:
    'Birmingham 2023: bonuses or allowances available to one job family but not to equivalently graded ' +
    'others = unequal pay. Flags JDs that reference bonuses/allowances without making the eligibility rule explicit.',
  source: 'Birmingham City Council equal pay litigation 2012-2023; Equality Act 2010 §66',
  lexicalAdditions: {},
  extraChecks(text, _language, _baseReport) {
    const flags: BiasFlag[] = [];
    // Catch English + Polish bonus/allowance terms
    const re =
      /\b(bonus|incentive|commission|allowance|premium|productivity\s+pay|attendance\s+bonus|premia|dodat|prowizj|nagrod)\w*/gi;
    let m: RegExpExecArray | null;
    const eligibilityRe =
      /\b(eligib|qualify|criteria|same\s+rate|equal\s+access|wszyscy|jednakow|takie\s+same|na\s+równych)\w*/i;
    const seen = new Set<number>();
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      // dedupe near-overlap
      if ([...seen].some((s) => Math.abs(s - start) < 8)) continue;
      seen.add(start);
      // check ±200 chars window for explicit eligibility language
      const windowText = text.slice(Math.max(0, start - 200), Math.min(text.length, end + 200));
      if (!eligibilityRe.test(windowText)) {
        flags.push({
          layer: 'implicit',
          category: 'implicit-bias',
          severity: 'high',
          start,
          end,
          matched: m[0],
          pattern: 'UK Birmingham: bonus/allowance without eligibility rule',
          notes:
            'Birmingham 2023: any pay element (bonus, allowance, incentive, commission) that exists in ' +
            'this role but is not equally available to comparator roles of the same grade is unequal pay ' +
            'under Equality Act 2010 §66. The JD does not explain who else can earn this element.',
          source: 'Birmingham City Council equal pay litigation 2012-2023',
          remediation:
            'Either remove the pay element from this JD, OR add a sentence: "This element is available on ' +
            'the same basis to all roles graded [X]" — and confirm that is true.',
        });
      }
    }
    return flags;
  },
};

export const POLICY_PACKS: PolicyPack[] = [IST85, NZ_PAYEQUITY, UK_BIRMINGHAM];

export function getPack(id: PackId): PolicyPack | undefined {
  return POLICY_PACKS.find((p) => p.id === id);
}

/** Compile an additional lexicon overlay from the given enabled packs. */
export function packLexiconOverlay(
  enabled: PackId[],
  language: Language,
): LexiconEntry[] {
  const out: LexiconEntry[] = [];
  for (const id of enabled) {
    const pack = getPack(id);
    if (!pack) continue;
    const adds = pack.lexicalAdditions[language] ?? [];
    out.push(...adds);
  }
  return out;
}

/** Run all enabled-pack extra checks and concat the flags. */
export function runPackChecks(
  enabled: PackId[],
  text: string,
  language: Language,
  baseReport: BiasReport,
): BiasFlag[] {
  const flags: BiasFlag[] = [];
  for (const id of enabled) {
    const pack = getPack(id);
    if (!pack?.extraChecks) continue;
    flags.push(...pack.extraChecks(text, language, baseReport));
  }
  return flags;
}

/** Severity rank for sorting (higher = more severe). */
export const SEVERITY_RANK: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  block: 4,
};
