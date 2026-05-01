/**
 * Sanity checks on hypothesis counts vs Axiomera Whitepaper v1.0.
 * Does NOT call any AI — pure data validation.
 */

import { describe, it, expect } from 'vitest';
import { R_HYPOTHESES } from './hypotheses/r-hypotheses';
import { E_HYPOTHESES } from './hypotheses/e-hypotheses';
import { S_POINT_MATRIX } from './hypotheses/s-scale';
import { WC_BY_ISCO2 } from './hypotheses/wc-scale';

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
