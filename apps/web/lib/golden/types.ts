/**
 * TypeScript types for the golden JD fixture format (v1.1.0).
 *
 * Fixture file: ~/Desktop/jd-suite-golden/golden-jd-fixtures.json
 * Loaded via: apps/web/lib/golden/fetch-fixtures.ts
 *
 * v1.1.0 adds: declared_edu and declared_exp (SLevel 1-5) for all 15 fixtures.
 * Derivation methodology: docs/ultra/15-phase-3-scope.md §Goal 4.
 */

export interface OracleGrade {
  zone: number;
  grade_level: string; // e.g. "AX1/A1", "AX5/C1", "AX9/E"
  mgmt: string;        // e.g. "NIE", "TAK"
  confidence: number;
  borderline: string;
  gold_status: string;
  reasoning: string;
}

export interface GoldenFixture {
  id: string;          // e.g. "G-01"
  source_row: number;
  job_title: string;
  zone_human: number;  // 1–9, human-reviewed Axiomera zone (primary truth)
  zone_confidence: number;
  borderline: boolean;
  mgmt: boolean;       // true = management role (NOTE: engine does not output this yet — gap)
  mgmt_consistent_across_systems?: boolean;
  tagger?: string;
  gold_status: string; // "gold_reviewed" | "gold_core"
  /**
   * Declared education level (SLevel 1–5).
   * 1=primary/none, 2=vocational, 3=HS/technical secondary, 4=bachelor's, 5=master's/PhD.
   * Derived from oracle edu/exp free-text — see docs/ultra/15-phase-3-scope.md §Goal 4.
   * Optional for backwards compatibility with v1.0.0 fixtures.
   */
  declared_edu?: 1 | 2 | 3 | 4 | 5;
  /**
   * Declared experience level (SLevel 1–5).
   * 1=≤1yr, 2=>1–3yr, 3=>3–7yr, 4=>7–15yr, 5=>15yr+.
   * Derived from oracle year-range exp field (midpoint mapping) or zone when absent.
   * Optional for backwards compatibility with v1.0.0 fixtures.
   */
  declared_exp?: 1 | 2 | 3 | 4 | 5;
  jd_text: string;
  /**
   * 55 binary hypothesis flags. Keys use `hypo_` prefix.
   * 19 match Axiomera R-hypothesis keys (strip `hypo_`).
   * 23 match Axiomera E-hypothesis primary keys (strip `hypo_`).
   * 13 are extra keys not present in current engine (documented in docs/ultra/14-golden-fixtures-setup.md).
   */
  expected_hypotheses: Record<string, boolean>;
  expected_grades: {
    oracle_consensus: OracleGrade;
    kf?: { grade: string; reasoning: string };
    mercer_ipe?: { grade: string; reasoning: string };
    wtw_ggs?: { grade: string; reasoning: string };
    aon_radford?: { grade: string; reasoning: string };
  };
  notes?: string;
}

export interface GoldenFixtureFile {
  version: string;
  fixtures: GoldenFixture[];
}
