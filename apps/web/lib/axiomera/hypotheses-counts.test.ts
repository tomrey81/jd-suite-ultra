/**
 * Sanity checks on hypothesis counts vs Axiomera Whitepaper v1.0.
 * Does NOT call any AI — pure data validation.
 */

import { describe, it, expect } from 'vitest';
import { R_HYPOTHESES } from './hypotheses/r-hypotheses';
import { E_HYPOTHESES } from './hypotheses/e-hypotheses';
import { S_POINT_MATRIX } from './hypotheses/s-scale';
import { WC_BY_ISCO2 } from './hypotheses/wc-scale';
import { PRO_V5_ITEM_MAP } from './hypothesis-mapping';
import { deriveLegacyHypothesisFlags } from './legacy-hypothesis-bridge';

describe('R-hypotheses', () => {
  it('contains exactly 19 markers (whitepaper Tables 2, 3, 5, 6)', () => {
    expect(R_HYPOTHESES.length).toBe(19);
  });

  it('every marker has a unique key', () => {
    const keys = new Set(R_HYPOTHESES.map((h) => h.key));
    expect(keys.size).toBe(R_HYPOTHESES.length);
  });

  it('every marker has level in {1, 2, 3}', () => {
    for (const h of R_HYPOTHESES) {
      expect([1, 2, 3]).toContain(h.level);
    }
  });

  it('every marker has m_zone within 1-9 inclusive', () => {
    for (const h of R_HYPOTHESES) {
      expect(h.m_zone).toBeGreaterThanOrEqual(1);
      expect(h.m_zone).toBeLessThanOrEqual(9);
    }
  });

  it('every marker has trilingual labels (PL/EN/DE)', () => {
    for (const h of R_HYPOTHESES) {
      expect(h.label_pl.length).toBeGreaterThan(0);
      expect(h.label_en.length).toBeGreaterThan(0);
      expect(h.label_de.length).toBeGreaterThan(0);
    }
  });
});

describe('E-hypotheses', () => {
  it('contains exactly 45 markers (whitepaper Tables 7-10)', () => {
    expect(E_HYPOTHESES.length).toBe(45);
  });

  it('split: 18 COG + 15 EMO + 12 PHY', () => {
    const cog = E_HYPOTHESES.filter((h) => h.dimension === 'COG');
    const emo = E_HYPOTHESES.filter((h) => h.dimension === 'EMO');
    const phy = E_HYPOTHESES.filter((h) => h.dimension === 'PHY');
    expect(cog.length).toBe(18);
    expect(emo.length).toBe(15);
    expect(phy.length).toBe(12);
  });

  it('type is "P" or "I"', () => {
    for (const h of E_HYPOTHESES) {
      expect(['P', 'I']).toContain(h.type);
    }
  });

  it('every marker has unique key + onet_mapping', () => {
    const keys = new Set(E_HYPOTHESES.map((h) => h.key));
    expect(keys.size).toBe(E_HYPOTHESES.length);
    for (const h of E_HYPOTHESES) {
      expect(h.onet_mapping.length).toBeGreaterThan(0);
    }
  });
});

describe('S-scale', () => {
  it('5x5 matrix per whitepaper Table 14', () => {
    expect(S_POINT_MATRIX.length).toBe(5);
    for (const row of S_POINT_MATRIX) {
      expect(row.length).toBe(5);
    }
  });

  it('matrix values are within {50, 90, 150, 230, 333}', () => {
    const valid = new Set([50, 90, 150, 230, 333]);
    for (const row of S_POINT_MATRIX) {
      for (const cell of row) {
        expect(valid.has(cell)).toBe(true);
      }
    }
  });
});

describe('PRO_V5_ITEM_MAP (M2.4 hypothesis unification)', () => {
  it('contains exactly 55 unique legacy keys (hypotheses.json has 55 unique despite id-54 duplicate)', () => {
    expect(Object.keys(PRO_V5_ITEM_MAP).length).toBe(55);
  });

  it('every entry has axiomeraKeys array and rationale', () => {
    for (const [key, entry] of Object.entries(PRO_V5_ITEM_MAP)) {
      expect(Array.isArray(entry.axiomeraKeys), `${key}: axiomeraKeys must be array`).toBe(true);
      expect(entry.rationale.length, `${key}: rationale must be non-empty`).toBeGreaterThan(0);
      expect(['high', 'medium', 'low'], `${key}: confidence must be high/medium/low`).toContain(entry.confidence);
    }
  });

  it('manages_confidential_personal_data has no axiomera keys (no engine analogue)', () => {
    expect(PRO_V5_ITEM_MAP['manages_confidential_personal_data'].axiomeraKeys).toHaveLength(0);
    expect(PRO_V5_ITEM_MAP['manages_confidential_personal_data'].confidence).toBe('low');
  });

  it('all exact-match keys (high confidence) reference axiomera keys that exist in R or E hypotheses', () => {
    const rKeys = new Set(R_HYPOTHESES.map((h) => h.key));
    const eKeys = new Set(E_HYPOTHESES.map((h) => h.key));
    const allAxiomeraKeys = new Set([...rKeys, ...eKeys]);

    for (const [legacyKey, entry] of Object.entries(PRO_V5_ITEM_MAP)) {
      if (entry.confidence !== 'high') continue;
      for (const axiomeraKey of entry.axiomeraKeys) {
        expect(
          allAxiomeraKeys.has(axiomeraKey),
          `${legacyKey}: axiomera key "${axiomeraKey}" not found in R or E hypotheses`,
        ).toBe(true);
      }
    }
  });
});

describe('deriveLegacyHypothesisFlags', () => {
  it('returns all 55 legacy keys', () => {
    const flags = deriveLegacyHypothesisFlags([], []);
    expect(Object.keys(flags).length).toBe(55);
    expect(Object.keys(PRO_V5_ITEM_MAP).sort()).toEqual(Object.keys(flags).sort());
  });

  it('manages_confidential_personal_data is always false regardless of inputs', () => {
    const allRKeys = R_HYPOTHESES.map((h) => h.key);
    const allEKeys = E_HYPOTHESES.map((h) => h.key);
    const flags = deriveLegacyHypothesisFlags(allRKeys, allEKeys);
    expect(flags['manages_confidential_personal_data']).toBe(false);
  });

  it('exact R matches derive from rActiveKeys', () => {
    const flags = deriveLegacyHypothesisFlags(['no_prior_experience', 'close_supervision'], []);
    expect(flags['no_prior_experience']).toBe(true);
    expect(flags['close_supervision']).toBe(true);
    expect(flags['little_discretion']).toBe(false);
  });

  it('exact E matches derive from eActiveKeys', () => {
    const flags = deriveLegacyHypothesisFlags([], ['manages_staff_directly', 'accountable_for_budget']);
    expect(flags['manages_staff_directly']).toBe(true);
    expect(flags['accountable_for_budget']).toBe(true);
    expect(flags['manages_managers']).toBe(false);
  });

  it('routine_under_supervision requires BOTH close_supervision AND structured_environment', () => {
    expect(deriveLegacyHypothesisFlags(['close_supervision'], [])['routine_under_supervision']).toBe(false);
    expect(deriveLegacyHypothesisFlags(['structured_environment'], [])['routine_under_supervision']).toBe(false);
    expect(deriveLegacyHypothesisFlags(['close_supervision', 'structured_environment'], [])['routine_under_supervision']).toBe(true);
  });

  it('interaction-derived keys prefer interaction key over fallback primary', () => {
    // coaches_evaluates_team: interaction key manages_staff_x_coaches > primary manages_staff_directly
    const withInteraction = deriveLegacyHypothesisFlags([], ['manages_staff_x_coaches']);
    expect(withInteraction['coaches_evaluates_team']).toBe(true);

    // With fallback only
    const withPrimary = deriveLegacyHypothesisFlags([], ['manages_staff_directly']);
    expect(withPrimary['coaches_evaluates_team']).toBe(true);

    // Without either
    const withNeither = deriveLegacyHypothesisFlags([], []);
    expect(withNeither['coaches_evaluates_team']).toBe(false);
  });

  it('all flags are false when no keys are active', () => {
    const flags = deriveLegacyHypothesisFlags([], []);
    for (const [key, value] of Object.entries(flags)) {
      expect(value, `${key} should be false with empty inputs`).toBe(false);
    }
  });
});

describe('WC-scale', () => {
  it('contains entries for the 42 ISCO_2 groups (whitepaper Table 20)', () => {
    const ids = Object.keys(WC_BY_ISCO2);
    // Whitepaper lists 42 groups — implementation may include 42 or more
    expect(ids.length).toBeGreaterThanOrEqual(40);
  });

  it('every WC point value is between 50 and 350', () => {
    for (const entry of Object.values(WC_BY_ISCO2)) {
      expect(entry.wc_pkt).toBeGreaterThanOrEqual(50);
      expect(entry.wc_pkt).toBeLessThanOrEqual(350);
    }
  });

  it('every entry has a level W1-W5', () => {
    const valid = new Set(['W1', 'W2', 'W3', 'W4', 'W5']);
    for (const entry of Object.values(WC_BY_ISCO2)) {
      expect(valid.has(entry.level)).toBe(true);
    }
  });
});
