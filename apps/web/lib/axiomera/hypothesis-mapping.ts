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

/**
 * Phase-1 follow-up TODO list (NOT implemented yet):
 *   1. Read apps/web/lib/hypotheses/hypotheses.json
 *   2. For each Pro hypothesis ID, identify the closest Axiomera marker(s)
 *   3. Populate PRO_V5_ITEM_MAP below with verified per-item links
 *   4. Add admin view rendering this mapping for transparency
 */
export const PRO_V5_ITEM_MAP: Record<
  string,
  { axiomeraKeys: string[]; rationale: string; confidence: 'high' | 'medium' | 'low' }
> = {
  // To be populated in a follow-up task. Example shape:
  // 'cog_problem_solving': {
  //   axiomeraKeys: ['solves_without_precedent', 'beyond_existing_methods'],
  //   rationale: 'Both detect novel-problem cognitive demand.',
  //   confidence: 'high',
  // },
};

/**
 * Helper: given a Pro v5 hypothesis category, return the Axiomera dimensions
 * that should also light up. Used in admin comparison view.
 */
export function axiomeraDimensionsForProCategory(category: string): AxiomeraDimension[] {
  const entry = PRO_V5_CATEGORY_MAP.find((m) => m.category === category);
  return entry?.mapsTo ?? [];
}
