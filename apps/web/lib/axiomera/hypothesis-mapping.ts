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
 * Per-item mapping: all 55 unique Pro v5 hypothesis keys → Axiomera R/E marker keys.
 * Implemented in Phase 3 (M2.4). Full rationale in docs/ultra/16-hypothesis-unification.md §2.
 *
 * hypotheses.json has id-54 duplicated (manages_confidential_personal_data appears twice),
 * yielding 55 unique keys despite 56 JSON entries.
 *
 * Derivation logic: apps/web/lib/axiomera/legacy-hypothesis-bridge.ts
 */
export const PRO_V5_ITEM_MAP: Record<
  string,
  { axiomeraKeys: string[]; rationale: string; confidence: 'high' | 'medium' | 'low' }
> = {
  // ── COG_LOW ──────────────────────────────────────────────────────────────────
  follows_fixed_procedures: {
    axiomeraKeys: ['structured_assignments'],
    rationale: 'Structural overlap: following fixed procedures ≈ receiving structured assignments with defined scope.',
    confidence: 'medium',
  },
  routine_under_supervision: {
    axiomeraKeys: ['close_supervision', 'structured_environment'],
    rationale: 'Routine under supervision implies both close_supervision (regular reporting) and structured_environment (predictable context). Both must be active.',
    confidence: 'medium',
  },
  no_prior_experience: {
    axiomeraKeys: ['no_prior_experience'],
    rationale: 'Exact name match. R-hypothesis LEVEL_1.',
    confidence: 'high',
  },
  close_supervision: {
    axiomeraKeys: ['close_supervision'],
    rationale: 'Exact name match. R-hypothesis LEVEL_1.',
    confidence: 'high',
  },
  little_discretion: {
    axiomeraKeys: ['little_discretion'],
    rationale: 'Exact name match. R-hypothesis LEVEL_1.',
    confidence: 'high',
  },
  confirms_task_steps: {
    axiomeraKeys: ['confirms_task_steps'],
    rationale: 'Exact name match. R-hypothesis LEVEL_1.',
    confidence: 'high',
  },
  structured_environment: {
    axiomeraKeys: ['structured_environment'],
    rationale: 'Exact name match. R-hypothesis LEVEL_1.',
    confidence: 'high',
  },
  structured_assignments: {
    axiomeraKeys: ['structured_assignments'],
    rationale: 'Exact name match. R-hypothesis LEVEL_1.',
    confidence: 'high',
  },
  follows_verbal_written_instructions: {
    axiomeraKeys: ['follows_verbal_written_instructions'],
    rationale: 'Exact name match. R-hypothesis LEVEL_1.',
    confidence: 'high',
  },

  // ── COG_HIGH ─────────────────────────────────────────────────────────────────
  general_direction: {
    axiomeraKeys: ['general_direction'],
    rationale: 'Exact name match. R-hypothesis LEVEL_2.',
    confidence: 'high',
  },
  solves_recurring_problems: {
    axiomeraKeys: ['solves_recurring_problems'],
    rationale: 'Exact name match. R-hypothesis LEVEL_2.',
    confidence: 'high',
  },
  solves_without_precedent: {
    axiomeraKeys: ['solves_without_precedent'],
    rationale: 'Exact name match. E-hypothesis primary COG.',
    confidence: 'high',
  },
  beyond_existing_methods: {
    axiomeraKeys: ['beyond_existing_methods'],
    rationale: 'Exact name match. E-hypothesis primary COG.',
    confidence: 'high',
  },
  determines_escalation: {
    axiomeraKeys: ['determines_escalation'],
    rationale: 'Exact name match. R-hypothesis LEVEL_2.',
    confidence: 'high',
  },
  unpredictable_contexts: {
    axiomeraKeys: ['unpredictable_contexts'],
    rationale: 'Exact name match. E-hypothesis primary COG.',
    confidence: 'high',
  },
  varied_non_routine: {
    axiomeraKeys: ['varied_non_routine'],
    rationale: 'Exact name match. E-hypothesis primary COG.',
    confidence: 'high',
  },
  expert_own_discipline: {
    axiomeraKeys: ['expert_own_discipline'],
    rationale: 'Exact name match. E-hypothesis primary COG.',
    confidence: 'high',
  },
  conducts_applied_research: {
    axiomeraKeys: ['conducts_applied_research'],
    rationale: 'Exact name match. E-hypothesis primary COG.',
    confidence: 'high',
  },
  writes_analytical_reports: {
    axiomeraKeys: ['analytical_reports_x_research', 'conducts_applied_research'],
    rationale: 'No primary marker. E interaction analytical_reports_x_research is closest; fallback to conducts_applied_research primary if interaction absent.',
    confidence: 'medium',
  },
  plans_establishes_milestones: {
    axiomeraKeys: ['milestones_x_project_management', 'performs_project_management'],
    rationale: 'No primary marker. E interaction milestones_x_project_management is closest; fallback to performs_project_management primary.',
    confidence: 'medium',
  },
  performs_project_management: {
    axiomeraKeys: ['performs_project_management'],
    rationale: 'Exact name match. E-hypothesis primary COG.',
    confidence: 'high',
  },

  // ── S2_COMM ──────────────────────────────────────────────────────────────────
  provides_direct_customer_service: {
    axiomeraKeys: ['direct_customer_x_em_dem', 'manages_external_stakeholders'],
    rationale: 'No primary marker. E interaction direct_customer_x_em_dem is closest; fallback to manages_external_stakeholders. Customer contact is a subset of external stakeholder management.',
    confidence: 'low',
  },
  manages_external_stakeholders: {
    axiomeraKeys: ['manages_external_stakeholders'],
    rationale: 'Exact name match. E-hypothesis primary EMO.',
    confidence: 'high',
  },
  represents_org_externally: {
    axiomeraKeys: ['represents_org_externally'],
    rationale: 'Exact name match. E-hypothesis primary EMO.',
    confidence: 'high',
  },
  develops_professional_network: {
    axiomeraKeys: ['develops_professional_network'],
    rationale: 'Exact name match. R-hypothesis LEVEL_2.',
    confidence: 'high',
  },

  // ── PHY ──────────────────────────────────────────────────────────────────────
  performs_physical_manual_work: {
    axiomeraKeys: ['performs_physical_manual_work'],
    rationale: 'Exact name match. E-hypothesis primary PHY.',
    confidence: 'high',
  },
  operates_maintains_equipment: {
    axiomeraKeys: ['operates_maintains_equipment'],
    rationale: 'Exact name match. E-hypothesis primary PHY.',
    confidence: 'high',
  },
  works_in_hazardous_conditions: {
    axiomeraKeys: ['works_in_hazardous_conditions'],
    rationale: 'Exact name match. E-hypothesis primary PHY.',
    confidence: 'high',
  },

  // ── R1_PEOPLE ─────────────────────────────────────────────────────────────────
  manages_staff_directly: {
    axiomeraKeys: ['manages_staff_directly'],
    rationale: 'Exact name match. E-hypothesis primary EMO (management cluster).',
    confidence: 'high',
  },
  coaches_evaluates_team: {
    axiomeraKeys: ['manages_staff_x_coaches', 'manages_staff_directly'],
    rationale: 'No primary marker. E interaction manages_staff_x_coaches captures both staff mgmt and coaching; fallback to manages_staff_directly primary.',
    confidence: 'medium',
  },
  manages_managers: {
    axiomeraKeys: ['manages_managers'],
    rationale: 'Exact name match. E-hypothesis primary EMO (management cluster).',
    confidence: 'high',
  },
  full_mgmt_authority: {
    axiomeraKeys: ['manages_managers_x_full_authority', 'manages_managers'],
    rationale: 'No primary marker. E interaction manages_managers_x_full_authority captures full authority; fallback to manages_managers primary.',
    confidence: 'medium',
  },
  oversees_senior_leaders: {
    axiomeraKeys: ['oversees_senior_leaders'],
    rationale: 'Exact name match. E-hypothesis primary EMO (management cluster).',
    confidence: 'high',
  },
  drives_professional_development_others: {
    axiomeraKeys: ['drives_professional_development_others'],
    rationale: 'Exact name match. R-hypothesis LEVEL_2.',
    confidence: 'high',
  },
  coordinates_team_work: {
    axiomeraKeys: ['coordinates_team_work'],
    rationale: 'Exact name match. R-hypothesis LEVEL_2.',
    confidence: 'high',
  },

  // ── R3_FIN ────────────────────────────────────────────────────────────────────
  accountable_for_budget: {
    axiomeraKeys: ['accountable_for_budget'],
    rationale: 'Exact name match. E-hypothesis primary COG.',
    confidence: 'high',
  },
  accountable_for_pnl: {
    axiomeraKeys: ['accountable_for_budget_x_pnl', 'pnl_x_function_strategy'],
    rationale: 'No primary marker. P&L is always co-active with budget or strategy. Covered by two E interaction keys.',
    confidence: 'medium',
  },
  influences_resource_allocation: {
    axiomeraKeys: ['influences_resource_allocation'],
    rationale: 'Exact name match. E-hypothesis primary COG.',
    confidence: 'high',
  },

  // ── R4_STRAT ──────────────────────────────────────────────────────────────────
  shapes_function_strategy: {
    axiomeraKeys: ['shapes_function_strategy'],
    rationale: 'Exact name match. E-hypothesis primary COG.',
    confidence: 'high',
  },
  influences_strategic_direction: {
    axiomeraKeys: ['strategic_direction_x_function_strategy', 'highest_authority_planning_x_strategic_direction'],
    rationale: 'No primary marker. Strategic direction captured in two E interaction keys.',
    confidence: 'medium',
  },
  highest_authority_planning: {
    axiomeraKeys: ['highest_authority_planning_x_strategic_direction'],
    rationale: 'No primary marker. E interaction highest_authority_planning_x_strategic_direction subsumes this concept.',
    confidence: 'medium',
  },
  sets_enterprise_vision: {
    axiomeraKeys: ['sets_enterprise_vision'],
    rationale: 'Exact name match. R-hypothesis LEVEL_3.',
    confidence: 'high',
  },
  org_wide_impact: {
    axiomeraKeys: ['org_wide_impact'],
    rationale: 'Exact name match. R-hypothesis LEVEL_3.',
    confidence: 'high',
  },
  impact_beyond_team: {
    axiomeraKeys: ['impact_beyond_team'],
    rationale: 'Exact name match. R-hypothesis LEVEL_2.',
    confidence: 'high',
  },
  leads_multiple_functions: {
    axiomeraKeys: ['leads_multiple_functions'],
    rationale: 'Exact name match. E-hypothesis primary EMO (management cluster).',
    confidence: 'high',
  },
  shapes_org_culture: {
    axiomeraKeys: ['leads_functions_x_shapes_culture'],
    rationale: 'No primary marker. E interaction leads_functions_x_shapes_culture captures culture-shaping as co-activation with leading multiple functions.',
    confidence: 'medium',
  },
  member_executive_committee: {
    axiomeraKeys: ['member_executive_committee'],
    rationale: 'Exact name match. R-hypothesis LEVEL_3.',
    confidence: 'high',
  },
  reports_to_board: {
    axiomeraKeys: ['reports_to_board'],
    rationale: 'Exact name match. R-hypothesis LEVEL_3.',
    confidence: 'high',
  },
  influences_industry: {
    axiomeraKeys: ['influences_industry'],
    rationale: 'Exact name match. R-hypothesis LEVEL_3.',
    confidence: 'high',
  },

  // ── RISK ──────────────────────────────────────────────────────────────────────
  ensures_regulatory_compliance: {
    axiomeraKeys: ['ensures_regulatory_compliance'],
    rationale: 'Exact name match. E-hypothesis primary COG.',
    confidence: 'high',
  },
  performs_risk_analysis: {
    axiomeraKeys: ['risk_analysis_x_compliance', 'ensures_regulatory_compliance'],
    rationale: 'No primary marker. Risk analysis is always paired with compliance in the engine. E interaction risk_analysis_x_compliance is closest; fallback to compliance primary.',
    confidence: 'medium',
  },

  // ── EMO ───────────────────────────────────────────────────────────────────────
  handles_emotionally_demanding_situations: {
    axiomeraKeys: ['handles_emotionally_demanding_situations'],
    rationale: 'Exact name match. E-hypothesis primary EMO.',
    confidence: 'high',
  },
  provides_care_or_welfare_services: {
    axiomeraKeys: ['provides_care_or_welfare_services'],
    rationale: 'Exact name match. E-hypothesis primary EMO.',
    confidence: 'high',
  },
  responsible_for_client_wellbeing: {
    axiomeraKeys: ['responsible_for_client_wellbeing'],
    rationale: 'Exact name match. E-hypothesis primary EMO.',
    confidence: 'high',
  },
  manages_confidential_personal_data: {
    axiomeraKeys: [],
    rationale: 'No Axiomera analogue. Data stewardship (GDPR/confidentiality) is not modelled in the R or E hypothesis sets. Always returns false. Add dedicated E-hypothesis in a future engine version if compliance reporting requires this flag.',
    confidence: 'low',
  },
};

/**
 * Helper: given a Pro v5 hypothesis category, return the Axiomera dimensions
 * that should also light up. Used in admin comparison view.
 */
export function axiomeraDimensionsForProCategory(category: string): AxiomeraDimension[] {
  const entry = PRO_V5_CATEGORY_MAP.find((m) => m.category === category);
  return entry?.mapsTo ?? [];
}
