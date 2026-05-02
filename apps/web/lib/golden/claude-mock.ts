/**
 * Builds deterministic Claude activation responses from golden fixture data.
 *
 * Used by golden.test.ts to mock callAi without hitting the Anthropic API.
 *
 * Two response builders:
 *   buildRMockResponse(fixture)  → { text: JSON } matching extract-r.ts schema
 *   buildEMockResponse(fixture)  → { text: JSON } matching extract-e.ts schema
 *
 * Mapping logic:
 *   - R (19 keys): all present in fixture as hypo_<key>. Strip prefix → exact match.
 *   - E primary (23 keys): present in fixture as hypo_<key>. Strip prefix → exact match.
 *   - E interaction (22 keys): NOT in fixture. Default to false (conservative).
 *   - 13 fixture keys unmatched in engine: ignored here (documented in types.ts).
 *
 * Evidence strings: must be verbatim substrings of jd_text (required by
 * filterEvidenceInSource in schemas.ts). We use the first 30 chars of jd_text
 * as a safe universal evidence string for all active hypotheses.
 */

import { R_HYPOTHESES } from '@/lib/axiomera/hypotheses/r-hypotheses';
import { E_HYPOTHESES } from '@/lib/axiomera/hypotheses/e-hypotheses';
import type { GoldenFixture } from './types';
import type { CallAiResult } from '@/lib/ai/call-ai';
import type { ModelTier } from '@/lib/ai/model-registry';

const MOCK_RESULT_BASE: Omit<CallAiResult, 'text'> = {
  inputTokens: 0,
  outputTokens: 0,
  estimatedCostUsd: 0,
  durationMs: 0,
  cacheStatus: 'miss',
  modelId: 'mock',
  modelTier: 'standard' as ModelTier,
};

/**
 * E primary keys that are present in the fixture's expected_hypotheses.
 * Interaction keys (22 of 45) are NOT in the fixture and default to false.
 */
const E_PRIMARY_IN_FIXTURE = new Set([
  'solves_without_precedent', 'beyond_existing_methods', 'expert_own_discipline',
  'conducts_applied_research', 'performs_project_management', 'accountable_for_budget',
  'influences_resource_allocation', 'shapes_function_strategy', 'ensures_regulatory_compliance',
  'unpredictable_contexts', 'varied_non_routine', 'manages_external_stakeholders',
  'represents_org_externally', 'manages_staff_directly', 'manages_managers',
  'oversees_senior_leaders', 'leads_multiple_functions', 'handles_emotionally_demanding_situations',
  'provides_care_or_welfare_services', 'responsible_for_client_wellbeing',
  'performs_physical_manual_work', 'operates_maintains_equipment', 'works_in_hazardous_conditions',
]);

/** Build a mock R-extraction Claude response from fixture hypothesis data. */
export function buildRMockResponse(fixture: GoldenFixture): CallAiResult {
  // Use first 30 chars of jd_text as safe evidence (guaranteed in-source substring)
  const safeEvidence = fixture.jd_text.slice(0, 30).trimEnd();

  const activations = R_HYPOTHESES.map((h) => {
    const fixtureKey = `hypo_${h.key}`;
    const active = fixture.expected_hypotheses[fixtureKey] === true;
    return { key: h.key, active, evidence: active ? safeEvidence : null };
  });

  return { ...MOCK_RESULT_BASE, text: JSON.stringify({ activations }) };
}

/** Build a mock E-extraction Claude response from fixture hypothesis data. */
export function buildEMockResponse(fixture: GoldenFixture): CallAiResult {
  const safeEvidence = fixture.jd_text.slice(0, 30).trimEnd();

  const activations = E_HYPOTHESES.map((h) => {
    let active = false;
    if (E_PRIMARY_IN_FIXTURE.has(h.key)) {
      const fixtureKey = `hypo_${h.key}`;
      active = fixture.expected_hypotheses[fixtureKey] === true;
    }
    // Interaction keys default to false — not in fixture, conservative
    return { key: h.key, active, evidence: active ? safeEvidence : null };
  });

  return { ...MOCK_RESULT_BASE, text: JSON.stringify({ activations }) };
}
