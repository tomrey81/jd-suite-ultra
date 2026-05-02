/**
 * Hypothesis reconciliation mapping.
 *
 * Pro has a 56-hypothesis "test-hypotheses" panel powering /v5/bias-check.
 * Pro Max (and now Ultra Axiomera) has 19 R + 45 E = 64 markers.
 *
 * They are NOT identical sets. This file documents the relationship so that:
 *   - both panels can coexist (Pro v5 unchanged; Axiomera new)
 *   - we can later consolidate without losing methodological provenance
 *   - admin tooling can show "this Pro v5 hypothesis maps to Axiomera marker X"
 *
 * Source for mapping:
 *   - Pro hypotheses: apps/web/lib/hypotheses/hypotheses.json (56 items)
 *     categories: COG_LOW, COG_HIGH, EMO, PHY, R1_PEOPLE, R3_FIN, R4_STRAT,
 *                 RISK, S2_COMM, OTHER
 *   - Axiomera R-hypotheses: ./hypotheses/r-hypotheses.ts (19)
 *   - Axiomera E-hypotheses: ./hypotheses/e-hypotheses.ts (45)
 *
 * Phase 1 status: this is a SCAFFOLD with category-level guidance.
 * Per-item mapping requires reading both JSON sets carefully and is a
 * follow-up task before any consolidation. For now, both engines run
 * independently and admins can view both outputs.
 */

export type AxiomeraDimension = 'R' | 'E_COG' | 'E_EMO' | 'E_PHY' | 'S' | 'WC';

export interface ProV5CategoryMapping {
  category: string; // Pro hypothesis category
  mapsTo: AxiomeraDimension[]; // Axiomera dimensions covered
  notes: string;
}

export const PRO_V5_CATEGORY_MAP: ProV5CategoryMapping[] = [
  {
    category: 'COG_LOW',
    mapsTo: ['R'], // Low cognitive demand correlates with low R-zone
    notes:
      'Pro COG_LOW items (routine, supervised, low-discretion) overlap with Axiomera R-zones 1-2 LEVEL_1 markers (no_prior_experience, little_discretion, close_supervision, structured_assignments).',
  },
  {
    category: 'COG_HIGH',
    mapsTo: ['E_COG', 'R'],
    notes:
      'Pro COG_HIGH items (problem solving, planning) overlap with Axiomera COG markers (solves_without_precedent, beyond_existing_methods) AND R LEVEL_2/3 markers (impact_beyond_team, org_wide_impact).',
  },
  {
    category: 'EMO',
    mapsTo: ['E_EMO'],
    notes: 'Direct overlap with Axiomera EMO markers (manages_external_stakeholders, handles_emotionally_demanding_situations, etc.).',
  },
  {
    category: 'PHY',
    mapsTo: ['E_PHY', 'WC'],
    notes:
      'Pro PHY items map to Axiomera PHY markers (performs_physical_manual_work, works_in_hazardous_conditions). PHY hazard items also inform WC level via ISCO_2 lookup.',
  },
  {
    category: 'R1_PEOPLE',
    mapsTo: ['R', 'E_EMO'],
    notes:
      'Staff management. Maps to Axiomera R LEVEL_2/3 markers (drives_professional_development_others, coordinates_team_work) and E_EMO interaction markers (manages_staff × coaches_evaluates_team).',
  },
  {
    category: 'R3_FIN',
    mapsTo: ['R', 'E_COG'],
    notes:
      'Budget / P&L / resource allocation. Axiomera E COG primary markers (accountable_for_budget, influences_resource_allocation) and R LEVEL_2/3 (impact_beyond_team).',
  },
  {
    category: 'R4_STRAT',
    mapsTo: ['R'],
    notes:
      'Strategic direction, board reporting. Axiomera R LEVEL_3 (member_executive_committee, reports_to_board, sets_enterprise_vision).',
  },
  {
    category: 'RISK',
    mapsTo: ['E_COG'],
    notes:
      'Regulatory compliance, formal risk. Axiomera E COG primary marker ensures_regulatory_compliance and interaction performs_risk_analysis × ensures_regulatory_compliance.',
  },
  {
    category: 'S2_COMM',
    mapsTo: ['E_EMO'],
    notes:
      'External stakeholder management. Axiomera E EMO primary markers (manages_external_stakeholders, represents_org_externally).',
  },
  {
    category: 'OTHER',
    mapsTo: [],
    notes: 'Pro residual category; review per item to identify Axiomera coverage.',
  },
];

// TODO(phase-2): Populate PRO_V5_ITEM_MAP with verified per-item links.
//
// What is needed:
//   1. Read apps/web/lib/hypotheses/hypotheses.json (56 Pro v5 hypothesis IDs).
//   2. Read ./hypotheses/r-hypotheses.ts (19 R-markers) and
//      ./hypotheses/e-hypotheses.ts (45 E-markers) for Axiomera keys.
//   3. For each Pro v5 ID, identify the closest Axiomera marker(s) by comparing
//      the guidance_en field to the Pro hypothesis description.
//   4. Record confidence (high / medium / low) and a rationale line.
//   5. Add an admin comparison view that renders this mapping alongside both
//      engine outputs so auditors can see provenance.
//
// Acceptance criteria (from docs/ultra/13-hypothesis-mapping-followup.md):
//   - All 56 Pro v5 hypothesis IDs are present as keys in PRO_V5_ITEM_MAP.
//   - Every entry has ≥1 axiomeraKey OR an explicit note explaining no match.
//   - No mappings are fabricated: each must cite the guidance_en evidence.
//   - At least one passing unit test verifies all 56 keys are present.
//
// The category-level map above (PRO_V5_CATEGORY_MAP) is sufficient for
// Phase 1 coexistence. The per-item map is required only when the admin
// consolidation view (Phase 2 milestone M2.4) is built.
export const PRO_V5_ITEM_MAP: Record<
  string,
  { axiomeraKeys: string[]; rationale: string; confidence: 'high' | 'medium' | 'low' }
> = {
  // Populated in Phase 2. See TODO above and docs/ultra/13-hypothesis-mapping-followup.md.
};

/**
 * Helper: given a Pro v5 hypothesis category, return the Axiomera dimensions
 * that should also light up. Used in admin comparison view.
 */
export function axiomeraDimensionsForProCategory(category: string): AxiomeraDimension[] {
  const entry = PRO_V5_CATEGORY_MAP.find((m) => m.category === category);
  return entry?.mapsTo ?? [];
}
