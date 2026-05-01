/**
 * Validation tests for Claude output schemas.
 * Does NOT call any AI.
 */

import { describe, it, expect } from 'vitest';
import {
  validateRActivations,
  validateEActivations,
  filterEvidenceInSource,
} from './schemas';

describe('validateRActivations', () => {
  it('rejects non-object', () => {
    const r = validateRActivations(null);
    expect(r.ok).toBe(false);
  });

  it('rejects missing activations array', () => {
    const r = validateRActivations({});
    expect(r.ok).toBe(false);
  });

  it('rejects unknown hypothesis key', () => {
    const r = validateRActivations({
      activations: [{ key: 'made_up_key', active: false, evidence: null }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects active=true without evidence', () => {
    const r = validateRActivations({
      activations: [{ key: 'no_prior_experience', active: true, evidence: null }],
    });
    expect(r.ok).toBe(false);
  });

  it('accepts well-formed activation', () => {
    const r = validateRActivations({
      activations: [
        {
          key: 'no_prior_experience',
          active: true,
          evidence: 'No prior experience required',
        },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('rejects duplicate keys', () => {
    const r = validateRActivations({
      activations: [
        { key: 'no_prior_experience', active: false, evidence: null },
        { key: 'no_prior_experience', active: false, evidence: null },
      ],
    });
    expect(r.ok).toBe(false);
  });
});

describe('filterEvidenceInSource (anti-hallucination)', () => {
  const source =
    'Senior Engineer responsible for system architecture. Reports to CTO.';

  it('keeps activations whose evidence is a verbatim substring (case-insensitive)', () => {
    const out = filterEvidenceInSource(
      [{ key: 'reports_to_board', active: true, evidence: 'Reports to CTO' }],
      source,
    );
    expect(out[0].active).toBe(true);
    expect(out[0].evidence).toBe('Reports to CTO');
  });

  it('strips activations with hallucinated evidence', () => {
    const out = filterEvidenceInSource(
      [
        {
          key: 'sets_enterprise_vision',
          active: true,
          evidence: 'sets the enterprise-wide vision', // not in source
        },
      ],
      source,
    );
    expect(out[0].active).toBe(false);
    expect(out[0].evidence).toBe(null);
  });

  it('strips overly short evidence (< 3 chars after normalisation)', () => {
    const out = filterEvidenceInSource(
      [{ key: 'reports_to_board', active: true, evidence: 'a' }],
      source,
    );
    expect(out[0].active).toBe(false);
  });
});

describe('validateEActivations', () => {
  it('accepts well-formed E activation', () => {
    const r = validateEActivations({
      activations: [
        {
          key: 'solves_without_precedent',
          active: true,
          evidence: 'handles novel problems with no precedent',
        },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('rejects unknown E key', () => {
    const r = validateEActivations({
      activations: [{ key: 'unknown_e_key', active: false, evidence: null }],
    });
    expect(r.ok).toBe(false);
  });
});
