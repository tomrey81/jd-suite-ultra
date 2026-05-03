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

### Phase 4 baseline (after Goals 1–3) — to be filled
```
Zone match: ?/15   Band match: ?/15
```
