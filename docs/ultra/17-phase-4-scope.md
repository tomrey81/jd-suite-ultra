# 17 — Phase 4 Scope: R-Zone Calibration

**Status:** Planned
**Branch:** TBD (new worktree from `claude/distracted-hermann` after merge)
**Created:** 2026-05-03
**Owner:** Claude

---

## Context

Phase 3 established the real Claude baseline: **2/15 zone match (13%), 4/15 band match (27%)**.
Zone match is the primary metric — it measures R-extraction accuracy, which drives 47.2% of
the grade formula. The failure pattern is systematic:

| Pattern | Fixtures | Delta |
|---------|----------|-------|
| Engine over-fires (low zones 1–3) | G-01, G-02, G-03, G-04 | engine +1 to +2 above oracle |
| Engine over-fires (mid zones 4–6) | G-06, G-07, G-08, G-09 | engine +1 consistently |
| Engine under-fires (high zones 7–9) | G-12, G-13, G-14, G-15 | engine –1 to –3 |
| `general_direction` inconsistency | G-05, G-10 | oracle=true, engine=false |

Root cause (from Phase 3 failure analysis):
1. `structured_assignments` / `close_supervision` activate too broadly — fire in mid-level JDs
   that have any procedural language, pushing zone up for high zones and not filtering correctly
   for low zones.
2. `general_direction` (m_zone=5.17) fires inconsistently — both false-negatives (G-05, G-10)
   and false-positives (G-06, G-07 where it inflates zone).
3. `org_wide_impact` / `member_executive_committee` / `sets_enterprise_vision` / `reports_to_board`
   under-fire at zones 7–9 — formal government/legal JD language doesn't trigger them.

---

## Goals

### Goal 1 — Guidance_en audit and sharpening (highest leverage)

**Scope:** For each of the 8 R-hypotheses with systematic failure, read the current `guidance_en`
and rewrite it to be more discriminating. Then re-run the 15 captured Claude responses
(`pnpm capture`) and measure zone improvement.

**Target hypotheses:**

| Key | m_zone | Problem | Current guidance_en |
|-----|--------|---------|---------------------|
| `structured_assignments` | 2.06 | Over-fires in senior JDs | "Assignments are predefined and structured, not open-ended." |
| `close_supervision` | 1.56 | Over-fires in senior JDs | "Work is performed under direct, continuous supervision." |
| `general_direction` | 5.17 | Under-fires inconsistently | "Receives goals/outcomes, determines methods independently." |
| `org_wide_impact` | 6.94 | Under-fires at Z7+ | "Decisions affect the entire organisation, not just a function." |
| `member_executive_committee` | 7.25 | Under-fires at Z8–9 | "Role sits on executive committee / C-suite body." |
| `reports_to_board` | 7.25 | Under-fires at Z8–9 | "Direct reporting line to board of directors." |
| `sets_enterprise_vision` | 9.00 | Under-fires at Z9 | "Role sets the vision/direction for the whole enterprise..." |
| `influences_industry` | 4.00 | Outlier (N=1 anchor) | "Role has recognized industry-level influence..." |

**Acceptance criteria:**
- [ ] Each `guidance_en` rewrite is documented with: before / after / rationale
- [ ] Rewrites cite whitepaper or oracle anchor examples (not invented)
- [ ] `hypotheses-counts.test.ts` still passes (no key renames)
- [ ] Re-run capture script; new fixture responses stored at
  `tests/golden/claude-fixtures/` (overwrite with `--force` flag)
- [ ] New baseline report recorded in this doc §Appendix
- [ ] Target: zone match ≥ 5/15 (33%) — improvement over 2/15

**Effort:** 3–4 hours (audit + rewrite + re-capture + report)

**Risks:**
- Rewrites that are too restrictive may improve low-zone recall but hurt mid-zone
- `general_direction` is bidirectional — tightening may help G-05/G-10 but hurt G-07/G-08
- Re-capture costs ~$0.50 in API calls (30 requests × ~$0.017)

---

### Goal 2 — `computeWeightedZone` floor/ceiling adjustment

**Scope:** The current formula uses a simple weighted mean of `m_zone` values across active
hypotheses. This produces a systematic +1 bias for mid-range JDs because mid-level markers
(m_zone 5–6) coexist with low-level markers (m_zone 1–3) and pull the mean up.

Evaluate two options:
1. **Outlier trim:** drop the highest and lowest m_zone from the weighted mean when ≥ 5 active keys
2. **Level-stratified mean:** compute mean separately per level (1/2/3), weight by level count

**Acceptance criteria:**
- [ ] Analysis script comparing old vs new formula on all 15 captured fixtures (no new API calls)
- [ ] Formula change (if adopted) documented with before/after zone table
- [ ] `compose.test.ts` updated for any formula changes
- [ ] Target: does not regress zone match below Goal 1 result

**Effort:** 2 hours

---

### Goal 3 — Contradictions hardening

**Scope:** `detectContradictions()` in `r-hypotheses.ts` currently only checks
`(no_prior_experience AND general_direction)` and `(close_supervision AND org_wide_impact)`.
Add additional pairs that the Phase 3 baseline reveals as problematic:

| Pair | Problem observed |
|------|-----------------|
| `close_supervision` + `determines_escalation` | Both active in G-07 (zone 4) — contradictory |
| `structured_assignments` + `impact_beyond_team` | Both active in G-09 (zone 5) — unlikely |
| `no_prior_experience` + `drives_professional_development_others` | Logically impossible |
| `no_prior_experience` + `develops_professional_network` | Logically impossible |

When a contradiction is flagged, the engine sets `contradictionFlag=true` and triggers review.
This is a soft guard — it does not change zone computation, only confidence.

**Acceptance criteria:**
- [ ] 4 new contradiction pairs added to `detectContradictions()`
- [ ] `hypotheses-counts.test.ts` or new unit test covers all contradiction pairs
- [ ] No regressions in existing `schemas.test.ts`

**Effort:** 1 hour

---

### Goal 4 — Re-run baseline after Goals 1–3

After Goals 1–3 are committed:

```bash
GOLDEN_FIXTURES_PATH="..." pnpm test:golden
```

Record:
- Zone match % (target ≥ 5/15)
- Band match %
- Per-fixture Z↑ Ze Band↑ Bande table
- Which fixtures improved and why

---

## Out of scope for Phase 4

| Item | Deferred to |
|------|-------------|
| E-hypothesis prompt tuning | Phase 5 |
| E-interaction marker calibration | Phase 5 |
| WC dimension integration in golden test | Phase 5 |
| Adding more fixtures (G-16+) | Phase 5+ |
| Monotonicity fix in oracle dataset | Tomasz (oracle Phase 0 roadmap) |
| IRR measurement | Tomasz (oracle Phase 1 roadmap) |

---

## Appendix — Baselines

### Phase 3 Goal 4 (with declared Edu/Exp, real Claude responses)
```
Zone match: 2/15 (13%)   Band match: 4/15 (27%)
Systematic bias: +1 zone for mid-range; under-fires by 1–3 at zone 7–9
```

### Phase 4 Goal 1 result (guidance_en rewrite + re-capture)
```
Zone match: 6/15 (40%)   Band match: 2/15 (13%)
Matches: G-05 (aesthetician Z3), G-06 (train driver Z3), G-07 (counsellor Z4),
         G-09 (Head Rail Reform Z5), G-10 (Head Service Design Z6),
         G-11 (Head Innovation Z6)
```

**Per-fixture active-key analysis:**
| ID | Oracle Z | Engine Z | Active R keys | Δ |
|----|----------|----------|---------------|---|
| G-01 | 1 | 2 | little_discretion, structured_assignments, follows_verbal_written_instructions, structured_environment | +1 |
| G-02 | 1 | 2 | little_discretion, close_supervision, structured_assignments, structured_environment, solves_recurring_problems | +1 |
| G-03 | 2 | 3 | structured_assignments, structured_environment, solves_recurring_problems | +1 |
| G-04 | 2 | 3 | little_discretion, structured_assignments, follows_verbal_written_instructions, structured_environment, solves_recurring_problems | +1 |
| G-05 | 3 | 3 | structured_assignments, structured_environment, solves_recurring_problems | ✓ |
| G-06 | 3 | 3 | little_discretion, structured_assignments, follows_verbal_written_instructions, structured_environment, solves_recurring_problems | ✓ |
| G-07 | 4 | 4 | structured_environment, general_direction, [varies] | ✓ |
| G-08 | 5 | 6 | general_direction, impact_beyond_team | +1 |
| G-09 | 5 | 5 | general_direction, coordinates_team_work, impact_beyond_team | ✓ |
| G-10 | 6 | 6 | impact_beyond_team, org_wide_impact | ✓ |
| G-11 | 6 | 6 | general_direction, impact_beyond_team, org_wide_impact, [varies] | ✓ |
| G-12 | 7 | 6 | general_direction, impact_beyond_team | -1 |
| G-13 | 7 | 6 | general_direction, coordinates_team_work, impact_beyond_team, org_wide_impact | -1 |
| G-14 | 8 | 7 | coordinates_team_work, impact_beyond_team, org_wide_impact, reports_to_board, sets_enterprise_vision | -1 |
| G-15 | 9 | 6 | general_direction, coordinates_team_work, impact_beyond_team, org_wide_impact | -3 |

**Remaining failure patterns after Goal 1:**
- Z1–Z2 roles (G-01–G-04): systematic +1 over due to arithmetic mean — `structured_environment` (m_zone=3.21) always pulls mean above Z1 cutoff (1.5). Formula fix needed (Goal 2).
- Z5 under-coverage (G-08): `general_direction`+`impact_beyond_team` → 5.51 → Z6 (oracle Z5). One mid-anchor short.
- Z7 under-coverage (G-12, G-13): `org_wide_impact` under-fires or insufficient high-zone keys. Mean 6.x stays below Z7 threshold (6.5).
- Z8–Z9 (G-14, G-15): high-zone markers (`member_executive_committee`, `reports_to_board`, `sets_enterprise_vision`) under-fire or mean arithmetic insufficient to reach Z8+.

**Guidance changes that did NOT work as intended:**
- `structured_environment` / `solves_recurring_problems`: first attempt too restrictive → G-05 dropped to Z1 (regression). Second pass fixed.
- `sets_enterprise_vision` N=1 tightening: correctly stopped false positive in G-11 (Head of Innovation → no longer fires) while preserving G-14 (Chief Executives).
- `general_direction` relaxation to allow autonomous professional roles: correctly activated for counsellor (G-07), analyst (G-09), but may also activate for G-08 (Principal Solicitor, +1 over remains).

**Guidance changes that worked:**
- `general_direction`: exclusion of "support/assist" roles without blocking autonomous professionals → G-07 ✓, G-09 ✓
- `sets_enterprise_vision`: restricted to top-org authority → G-11 ✓ (was Z7, now Z6)
- `org_wide_impact`: broadened to public sector language → G-10 was already correct; G-12, G-13 still under-fire
- `reports_to_board`: broadened to governing bodies → fires in G-14 (Chief Executives) ✓
