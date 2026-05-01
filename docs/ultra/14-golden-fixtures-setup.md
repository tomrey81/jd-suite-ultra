# 14 — Golden Fixture Setup & Harness Architecture

**Status:** Phase 2 gate G-7 — harness built, baseline captured.
**Created:** 2026-05-01
**Fixture file:** `~/Desktop/jd-suite-golden/golden-jd-fixtures.json`

## §1 — Overview

The golden test harness (`apps/web/lib/axiomera/golden.test.ts`) runs the Axiomera
R + E extraction pipeline against 15 human-reviewed JD fixtures and reports
alignment with oracle (human) judgments. It is the primary regression guard for
the evaluation engine.

| Fixture | Job title | Zone | MGMT | Borderline |
|---------|-----------|------|------|------------|
| G-01 | forklift operator | 1 | No | No |
| G-02 | Pharmacy Aides | 1 | No | No |
| G-03 | ski lift operator | 2 | No | No |
| G-04 | automated optical inspection operator | 2 | No | No |
| G-05 | aesthetician | 3 | No | No |
| G-06 | train driver | 3 | No | No |
| G-07 | sexual violence counsellor | 4 | No | Yes |
| G-08 | Principal Solicitor | 5 | No | No |
| G-09 | Head of Rail Reform Analysis | 5 | Yes | No |
| G-10 | Head of Service Design | 6 | No | No |
| G-11 | Head of Innovation, Science and Technology | 6 | Yes | Yes |
| G-12 | Legal Adviser to the Chancellor of the High Court | 7 | No | No |
| G-13 | Assistant Director Procurement | 7 | Yes | Yes |
| G-14 | Chief Executives | 8 | Yes | Yes |
| G-15 | Associate General Counsel | 9 | Yes | No |

## §2 — Running the harness

```bash
# Must have fixture file at default path or set env var
GOLDEN_FIXTURES_PATH=~/Desktop/jd-suite-golden/golden-jd-fixtures.json pnpm --filter web test:golden

# Or add to shell profile:
export GOLDEN_FIXTURES_PATH=~/Desktop/jd-suite-golden/golden-jd-fixtures.json
pnpm --filter web test:golden
```

If the fixture file is unavailable, the suite **skips** (does not fail). CI without
`GOLDEN_FIXTURES_PATH` configured is safe.

## §3 — GDrive integration (stub — not yet implemented)

When `GOOGLE_SERVICE_ACCOUNT_KEY` and `GOLDEN_GDRIVE_FILE_ID` env vars are both
set, `fetch-fixtures.ts` will fetch from Google Drive instead of local disk.

**To implement (30-min task):**
1. `pnpm --filter web add googleapis`
2. Uncomment the GDrive implementation in `fetch-fixtures.ts`
3. Create a GCP service account with Drive read scope
4. Share the fixture Google Sheets / JSON file with the service account email
5. Export the JSON (or use Drive API to fetch the file by ID)
6. Set `GOOGLE_SERVICE_ACCOUNT_KEY='<json string>'` and `GOLDEN_GDRIVE_FILE_ID='<id>'`

## §4 — Known gaps and what Tomasz needs to do

### Gap 1: MGMT assertion is skipped
`AxiomeraRunOutput` does not include a `mgmt` field. The fixture has `mgmt: boolean`.

**Phase 2 task:** Add `mgmt` detection to the R-extraction pipeline. Detection logic:
any of these R keys active → `mgmt=true`:
`manages_staff_directly`, `manages_managers`, `oversees_senior_leaders`, `leads_multiple_functions`,
`full_mgmt_authority` (last key is in fixture but not engine — add to R-hypotheses or derive from E).

### Gap 2: 13 fixture hypothesis keys have no engine equivalent

These fixture keys (stripped of `hypo_`) are not present in either R or E hypothesis sets:

| Fixture key | Notes |
|-------------|-------|
| `follows_fixed_procedures` | Overlaps structurally with `structured_assignments`; not a distinct hypothesis in engine |
| `routine_under_supervision` | Overlaps with `close_supervision` + `structured_environment` |
| `accountable_for_pnl` | Engine has `accountable_for_budget`; P&L is a subset |
| `coaches_evaluates_team` | Engine E has `manages_staff_x_coaches` (interaction); fixture uses primary |
| `full_mgmt_authority` | Engine E has `manages_managers_x_full_authority` (interaction) |
| `highest_authority_planning` | Engine E has `highest_authority_planning_x_strategic_direction` (interaction) |
| `influences_strategic_direction` | Engine E has `strategic_direction_x_function_strategy` (interaction) |
| `manages_confidential_personal_data` | Not in current engine hypothesis set |
| `performs_risk_analysis` | Engine E has `risk_analysis_x_compliance` (interaction) |
| `plans_establishes_milestones` | Engine E has `milestones_x_project_management` (interaction) |
| `provides_direct_customer_service` | Engine E has `direct_customer_x_em_dem` (interaction) |
| `shapes_org_culture` | Engine E has `leads_functions_x_shapes_culture` (interaction) |
| `writes_analytical_reports` | Engine E has `analytical_reports_x_research` (interaction) |

**Phase 2 task:** Reconcile. Either add primary versions of these to the engine, or accept the
divergence and document which fixture keys map to which interaction keys.

### Gap 3: E interaction markers default to false in mock
The 22 E interaction keys (like `accountable_for_budget_x_pnl`) are not present in the fixture.
The mock sets them all to false (conservative default — correct per the engine's "when in doubt, inactive" rule).

**No action needed** until real Claude fixture responses are captured (see Gap 5).

### Gap 4: S defaults to S2 (90 points) for all fixtures
Fixtures do not declare Edu/Exp levels. S is hardcoded to 90 (S2 = basic qualifications).
This affects grade/band computation.

**Phase 2 task:** Add `declared_edu` and `declared_exp` fields to the fixture format and
populate for each fixture. This will make band assertions meaningful.

### Gap 5: Band assertion is soft (warns, doesn't fail)
Because S defaults to 90 and interaction E markers default to false, the computed
grade/band will diverge from oracle for many fixtures. The harness logs divergences
but does not fail on band mismatches.

**To harden:** capture real Claude responses (one live run per fixture), save as
`apps/web/tests/golden/claude-fixtures/G-{01..15}.{r,e}-extract.json`, and update
mock to return those. Then tighten band assertion to hard failure.

**Steps:**
1. Set `ENABLE_AXIOMERA_ENGINE=true`, `ANTHROPIC_API_KEY=...`
2. Run harness with real callAi (remove vi.mock temporarily)
3. Log Claude responses to file
4. Commit fixture responses
5. Update mock to load from files
6. Re-enable vi.mock

## §5 — Fixture format changelog

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial: 15 fixtures, 55 hypotheses, 5 grading systems |
