/**
 * Legacy hypothesis bridge — M2.4
 *
 * Derives the 55 Pro v5 legacy hypothesis flags from Axiomera engine output.
 * These flags are consumed by /v5/bias-check and the admin comparison view.
 *
 * Canonical source of truth: Axiomera engine output (rActiveKeys, eActiveKeys).
 * Legacy flags are derived, not independently computed.
 *
 * Mapping rationale: docs/ultra/16-hypothesis-unification.md §2
 *
 * Summary:
 *   42 keys: direct lookup (legacy key == axiomera key in R or E primary set)
 *   12 keys: interaction-key first, fallback to primary
 *    1 key:  no Axiomera analogue → always false (manages_confidential_personal_data)
 */

export type LegacyHypothesisFlags = Record<string, boolean>;

/**
 * Derive legacy Pro v5 hypothesis flags from Axiomera R and E active keys.
 *
 * @param rActiveKeys - active R-hypothesis keys from extractR()
 * @param eActiveKeys - active E-hypothesis keys from extractE()
 * @returns Record mapping every legacy key to true/false
 */
export function deriveLegacyHypothesisFlags(
  rActiveKeys: string[],
  eActiveKeys: string[],
): LegacyHypothesisFlags {
  const r = new Set(rActiveKeys);
  const e = new Set(eActiveKeys);

  /** true if key is active in R or E primary/interaction pool */
  const active = (key: string) => r.has(key) || e.has(key);

  return {
    // ── COG_LOW ────────────────────────────────────────────────────────────

    // Maps to R `structured_assignments` (structural overlap: fixed procedures ≈ structured assignments)
    follows_fixed_procedures: r.has('structured_assignments'),

    // Maps to R `close_supervision` + `structured_environment` — both must be active
    routine_under_supervision: r.has('close_supervision') && r.has('structured_environment'),

    // Exact R match
    no_prior_experience: active('no_prior_experience'),

    // Exact R match
    close_supervision: active('close_supervision'),

    // Exact R match
    little_discretion: active('little_discretion'),

    // Exact R match
    confirms_task_steps: active('confirms_task_steps'),

    // Exact R match
    structured_environment: active('structured_environment'),

    // Exact R match
    structured_assignments: active('structured_assignments'),

    // Exact R match
    follows_verbal_written_instructions: active('follows_verbal_written_instructions'),

    // ── COG_HIGH ───────────────────────────────────────────────────────────

    // Exact R match
    general_direction: active('general_direction'),

    // Exact R match
    solves_recurring_problems: active('solves_recurring_problems'),

    // Exact E-primary match
    solves_without_precedent: active('solves_without_precedent'),

    // Exact E-primary match
    beyond_existing_methods: active('beyond_existing_methods'),

    // Exact R match
    determines_escalation: active('determines_escalation'),

    // Exact E-primary match
    unpredictable_contexts: active('unpredictable_contexts'),

    // Exact E-primary match
    varied_non_routine: active('varied_non_routine'),

    // Exact E-primary match
    expert_own_discipline: active('expert_own_discipline'),

    // Exact E-primary match
    conducts_applied_research: active('conducts_applied_research'),

    // E interaction `analytical_reports_x_research`; fallback to E-primary `conducts_applied_research`
    writes_analytical_reports:
      e.has('analytical_reports_x_research') || e.has('conducts_applied_research'),

    // E interaction `milestones_x_project_management`; fallback to E-primary `performs_project_management`
    plans_establishes_milestones:
      e.has('milestones_x_project_management') || e.has('performs_project_management'),

    // Exact E-primary match
    performs_project_management: active('performs_project_management'),

    // ── S2_COMM ────────────────────────────────────────────────────────────

    // E interaction `direct_customer_x_em_dem`; fallback to E-primary `manages_external_stakeholders`
    provides_direct_customer_service:
      e.has('direct_customer_x_em_dem') || e.has('manages_external_stakeholders'),

    // Exact E-primary match
    manages_external_stakeholders: active('manages_external_stakeholders'),

    // Exact E-primary match
    represents_org_externally: active('represents_org_externally'),

    // Exact R match
    develops_professional_network: active('develops_professional_network'),

    // ── PHY ────────────────────────────────────────────────────────────────

    // Exact E-primary match
    performs_physical_manual_work: active('performs_physical_manual_work'),

    // Exact E-primary match
    operates_maintains_equipment: active('operates_maintains_equipment'),

    // Exact E-primary match
    works_in_hazardous_conditions: active('works_in_hazardous_conditions'),

    // ── R1_PEOPLE ──────────────────────────────────────────────────────────

    // Exact E-primary match
    manages_staff_directly: active('manages_staff_directly'),

    // E interaction `manages_staff_x_coaches`; fallback to E-primary `manages_staff_directly`
    coaches_evaluates_team:
      e.has('manages_staff_x_coaches') || e.has('manages_staff_directly'),

    // Exact E-primary match
    manages_managers: active('manages_managers'),

    // E interaction `manages_managers_x_full_authority`; fallback to E-primary `manages_managers`
    full_mgmt_authority:
      e.has('manages_managers_x_full_authority') || e.has('manages_managers'),

    // Exact E-primary match
    oversees_senior_leaders: active('oversees_senior_leaders'),

    // Exact R match
    drives_professional_development_others: active('drives_professional_development_others'),

    // Exact R match
    coordinates_team_work: active('coordinates_team_work'),

    // ── R3_FIN ─────────────────────────────────────────────────────────────

    // Exact E-primary match
    accountable_for_budget: active('accountable_for_budget'),

    // E interaction `accountable_for_budget_x_pnl` OR `pnl_x_function_strategy`
    accountable_for_pnl:
      e.has('accountable_for_budget_x_pnl') || e.has('pnl_x_function_strategy'),

    // Exact E-primary match
    influences_resource_allocation: active('influences_resource_allocation'),

    // ── R4_STRAT ───────────────────────────────────────────────────────────

    // Exact E-primary match
    shapes_function_strategy: active('shapes_function_strategy'),

    // E interaction `strategic_direction_x_function_strategy` OR `highest_authority_planning_x_strategic_direction`
    influences_strategic_direction:
      e.has('strategic_direction_x_function_strategy') ||
      e.has('highest_authority_planning_x_strategic_direction'),

    // E interaction `highest_authority_planning_x_strategic_direction`
    highest_authority_planning: e.has('highest_authority_planning_x_strategic_direction'),

    // Exact R match
    sets_enterprise_vision: active('sets_enterprise_vision'),

    // Exact R match
    org_wide_impact: active('org_wide_impact'),

    // Exact R match
    impact_beyond_team: active('impact_beyond_team'),

    // Exact E-primary match
    leads_multiple_functions: active('leads_multiple_functions'),

    // E interaction `leads_functions_x_shapes_culture`
    shapes_org_culture: e.has('leads_functions_x_shapes_culture'),

    // Exact R match
    member_executive_committee: active('member_executive_committee'),

    // Exact R match
    reports_to_board: active('reports_to_board'),

    // Exact R match
    influences_industry: active('influences_industry'),

    // ── RISK ───────────────────────────────────────────────────────────────

    // Exact E-primary match
    ensures_regulatory_compliance: active('ensures_regulatory_compliance'),

    // E interaction `risk_analysis_x_compliance`; fallback to E-primary `ensures_regulatory_compliance`
    performs_risk_analysis:
      e.has('risk_analysis_x_compliance') || e.has('ensures_regulatory_compliance'),

    // ── EMO ────────────────────────────────────────────────────────────────

    // Exact E-primary match
    handles_emotionally_demanding_situations: active('handles_emotionally_demanding_situations'),

    // Exact E-primary match
    provides_care_or_welfare_services: active('provides_care_or_welfare_services'),

    // Exact E-primary match
    responsible_for_client_wellbeing: active('responsible_for_client_wellbeing'),

    // No Axiomera analogue — data stewardship not modelled in engine (see doc 16 §4 gap 1)
    manages_confidential_personal_data: false,
  };
}
