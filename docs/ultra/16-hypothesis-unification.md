# 16 — Hypothesis Unification (M2.4)

**Status:** Phase 3 Goal 2 — implemented 2026-05-02
**Branch:** `claude/distracted-hermann`

---

## §1 — The two systems

| System | File | Count | Used by |
|--------|------|-------|---------|
| Legacy Pro v5 flags | `apps/web/lib/hypotheses/hypotheses.json` | 55 unique keys (id 54 duplicated — bug) | `/v5/bias-check`, `/api/ai/test-hypotheses`, fixture `expected_hypotheses` |
| Axiomera R-markers | `lib/axiomera/hypotheses/r-hypotheses.ts` | 19 primary | R-extraction engine |
| Axiomera E-markers | `lib/axiomera/hypotheses/e-hypotheses.ts` | 45 (23 primary + 22 interaction) | E-extraction engine |

**Canonical source of truth going forward:** Axiomera engine output (`rActiveKeys`, `eActiveKeys`).
Legacy flags are **derived** from engine output via `deriveLegacyHypothesisFlags()`.
The fixture `expected_hypotheses` field is retained as human-verified oracle for golden tests.

---

## §2 — Complete mapping (55 legacy keys)

Legend: **R** = Axiomera R primary, **E-P** = Axiomera E primary, **E-I** = Axiomera E interaction

| Legacy key | Category | Axiomera key(s) | Type | Confidence | Notes |
|---|---|---|---|---|---|
| `follows_fixed_procedures` | COG_LOW | `structured_assignments` | R | medium | Structural overlap; fixed procedures ≈ structured assignments |
| `routine_under_supervision` | COG_LOW | `close_supervision` + `structured_environment` | R+R | medium | Both must be active — routine implies supervision + structure |
| `no_prior_experience` | COG_LOW | `no_prior_experience` | R | **high** | Exact name match |
| `close_supervision` | COG_LOW | `close_supervision` | R | **high** | Exact name match |
| `little_discretion` | COG_LOW | `little_discretion` | R | **high** | Exact name match |
| `confirms_task_steps` | COG_LOW | `confirms_task_steps` | R | **high** | Exact name match |
| `structured_environment` | COG_LOW | `structured_environment` | R | **high** | Exact name match |
| `structured_assignments` | COG_LOW | `structured_assignments` | R | **high** | Exact name match |
| `follows_verbal_written_instructions` | COG_LOW | `follows_verbal_written_instructions` | R | **high** | Exact name match |
| `general_direction` | COG_HIGH | `general_direction` | R | **high** | Exact name match |
| `solves_recurring_problems` | COG_HIGH | `solves_recurring_problems` | R | **high** | Exact name match |
| `solves_without_precedent` | COG_HIGH | `solves_without_precedent` | E-P | **high** | Exact name match |
| `beyond_existing_methods` | COG_HIGH | `beyond_existing_methods` | E-P | **high** | Exact name match |
| `determines_escalation` | COG_HIGH | `determines_escalation` | R | **high** | Exact name match |
| `unpredictable_contexts` | COG_HIGH | `unpredictable_contexts` | E-P | **high** | Exact name match |
| `varied_non_routine` | COG_HIGH | `varied_non_routine` | E-P | **high** | Exact name match |
| `expert_own_discipline` | COG_HIGH | `expert_own_discipline` | E-P | **high** | Exact name match |
| `conducts_applied_research` | COG_HIGH | `conducts_applied_research` | E-P | **high** | Exact name match |
| `writes_analytical_reports` | COG_HIGH | `analytical_reports_x_research` OR `conducts_applied_research` | E-I / E-P | medium | No primary; interaction key implies both; fallback to research primary |
| `plans_establishes_milestones` | COG_HIGH | `milestones_x_project_management` OR `performs_project_management` | E-I / E-P | medium | No primary; interaction key implies both; fallback to PM primary |
| `performs_project_management` | COG_HIGH | `performs_project_management` | E-P | **high** | Exact name match |
| `provides_direct_customer_service` | S2_COMM | `direct_customer_x_em_dem` OR `manages_external_stakeholders` | E-I / E-P | low | No primary; direct customer is a subset of external stakeholder management; interaction key is closest |
| `manages_external_stakeholders` | S2_COMM | `manages_external_stakeholders` | E-P | **high** | Exact name match |
| `represents_org_externally` | S2_COMM | `represents_org_externally` | E-P | **high** | Exact name match |
| `develops_professional_network` | S2_COMM | `develops_professional_network` | R | **high** | Exact name match |
| `performs_physical_manual_work` | PHY | `performs_physical_manual_work` | E-P | **high** | Exact name match |
| `operates_maintains_equipment` | PHY | `operates_maintains_equipment` | E-P | **high** | Exact name match |
| `manages_staff_directly` | R1_PEOPLE | `manages_staff_directly` | E-P | **high** | Exact name match |
| `coaches_evaluates_team` | R1_PEOPLE | `manages_staff_x_coaches` OR `manages_staff_directly` | E-I / E-P | medium | No primary; interaction implies both; fallback to staff management |
| `manages_managers` | R1_PEOPLE | `manages_managers` | E-P | **high** | Exact name match |
| `full_mgmt_authority` | R1_PEOPLE | `manages_managers_x_full_authority` OR `manages_managers` | E-I / E-P | medium | No primary; interaction implies full authority; fallback to manages_managers |
| `oversees_senior_leaders` | R1_PEOPLE | `oversees_senior_leaders` | E-P | **high** | Exact name match |
| `drives_professional_development_others` | R1_PEOPLE | `drives_professional_development_others` | R | **high** | Exact name match |
| `accountable_for_budget` | R3_FIN | `accountable_for_budget` | E-P | **high** | Exact name match |
| `accountable_for_pnl` | R3_FIN | `accountable_for_budget_x_pnl` OR `pnl_x_function_strategy` | E-I | medium | No primary; P&L is always co-active with budget or strategy |
| `influences_resource_allocation` | R3_FIN | `influences_resource_allocation` | E-P | **high** | Exact name match |
| `shapes_function_strategy` | R4_STRAT | `shapes_function_strategy` | E-P | **high** | Exact name match |
| `influences_strategic_direction` | R4_STRAT | `strategic_direction_x_function_strategy` OR `highest_authority_planning_x_strategic_direction` | E-I | medium | No primary; strategic direction captured in interaction markers |
| `highest_authority_planning` | R4_STRAT | `highest_authority_planning_x_strategic_direction` | E-I | medium | No primary; interaction key subsumes this |
| `sets_enterprise_vision` | R4_STRAT | `sets_enterprise_vision` | R | **high** | Exact name match |
| `org_wide_impact` | R4_STRAT | `org_wide_impact` | R | **high** | Exact name match |
| `impact_beyond_team` | R4_STRAT | `impact_beyond_team` | R | **high** | Exact name match |
| `leads_multiple_functions` | R4_STRAT | `leads_multiple_functions` | E-P | **high** | Exact name match |
| `shapes_org_culture` | R4_STRAT | `leads_functions_x_shapes_culture` | E-I | medium | No primary; culture-shaping captured in interaction marker |
| `member_executive_committee` | R4_STRAT | `member_executive_committee` | R | **high** | Exact name match |
| `reports_to_board` | R4_STRAT | `reports_to_board` | R | **high** | Exact name match |
| `influences_industry` | R4_STRAT | `influences_industry` | R | **high** | Exact name match |
| `ensures_regulatory_compliance` | RISK | `ensures_regulatory_compliance` | E-P | **high** | Exact name match |
| `performs_risk_analysis` | RISK | `risk_analysis_x_compliance` OR `ensures_regulatory_compliance` | E-I / E-P | medium | No primary; risk analysis is always paired with compliance in the engine |
| `handles_emotionally_demanding_situations` | EMO | `handles_emotionally_demanding_situations` | E-P | **high** | Exact name match |
| `provides_care_or_welfare_services` | EMO | `provides_care_or_welfare_services` | E-P | **high** | Exact name match |
| `works_in_hazardous_conditions` | PHY | `works_in_hazardous_conditions` | E-P | **high** | Exact name match |
| `responsible_for_client_wellbeing` | EMO | `responsible_for_client_wellbeing` | E-P | **high** | Exact name match |
| `manages_confidential_personal_data` | EMO | *(none)* | — | **none** | No Axiomera analogue. Data stewardship is not modelled in the engine. Returns false. |
| `coordinates_team_work` | R1_PEOPLE | `coordinates_team_work` | R | **high** | Exact name match |

### Summary

| Match type | Count |
|---|---|
| Exact name match (primary R or E key) | 37 |
| Derivable from interaction key + fallback primary | 12 |
| No Axiomera analogue (always false) | 1 |
| **Total** | **55** |

Note: `hypotheses.json` has id 54 duplicated (`manages_confidential_personal_data` appears twice). Only 55 unique keys exist. The duplicate should be fixed in the fixture file.

---

## §3 — Derivation function

Implementation: `apps/web/lib/axiomera/legacy-hypothesis-bridge.ts`

```
deriveLegacyHypothesisFlags(rActiveKeys, eActiveKeys) → Record<string, boolean>
```

- For 37 exact matches: `result[key] = rActiveKeys.includes(key) || eActiveKeys.includes(key)`
- For 12 interaction-derived: check interaction key first; fall back to primary if absent
- For `manages_confidential_personal_data`: always `false`

---

## §4 — Known gaps

1. **`manages_confidential_personal_data`** — not modelled in engine. If this flag matters for compliance reporting, add a dedicated E-hypothesis in a future engine version.
2. **`provides_direct_customer_service`** — mapped to `manages_external_stakeholders` as fallback; confidence low. Engine treats customer contact as stakeholder management, which is broader.
3. **Interaction keys under-fire in real Claude** — E interaction keys (22 of 45) default to false in the derived mock strategy, so interaction-derived legacy flags will also be false in most cases until the engine prompt is tuned to activate interactions reliably.
4. **`hypotheses.json` duplicate** — id 54 (`manages_confidential_personal_data`) appears twice. Should be deduped, leaving 55 entries.
