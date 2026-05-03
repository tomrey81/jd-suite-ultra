# 18 — Phase 5 Scope: E-Calibration + Full Pipeline Gate

**Status:** Planned (starts after Phase 4 merge)
**Branch:** TBD
**Created:** 2026-05-03
**Owner:** Claude

---

## Context

After Phase 4 (R-zone calibration), the primary remaining accuracy gap is in the E dimension
and the band assertion gate. Phase 3 baseline showed:

- E interaction markers: **all 22 defaulting to false** in real Claude responses — Claude is
  not activating interaction hypotheses despite JD evidence being present.
- Band match: **4/15 (27%)** — mostly an artifact of E being underscored; even with correct
  S values, E under-scoring deflates grade by 1–2 bands for mid-to-high zone roles.
- MGMT detection: soft (logs warnings, doesn't fail) — management markers under-fire, partly
  explained by the oracle's own non-monotone MGMT issue at Z6+ (documented in oracle methodology
  doc 2026-04-23). Harden only after oracle Phase 0 monotonicity fix is complete.

The golden harness is currently a **measurement tool, not a gate**. Phase 5 converts it into
a **hard gate** once zone match ≥ 8/15 and band match ≥ 8/15.

---

## Goals

### Goal 1 — E interaction marker activation (highest leverage for band match)

**Scope:** All 22 E interaction hypotheses (`type: 'I'`) currently return false from real
Claude responses. The system prompt says: "mark active ONLY if ALL components are clearly
present in the JD" — this constraint is correct but too restrictive without concrete guidance.

**Changes:**
1. Add example-based guidance to the E extraction system prompt for interaction keys:
   - Each interaction key should include a `guidance_en` example of what co-activation looks like
   - Example: `analytical_reports_x_research`: "Active when JD mentions both producing analytical
     reports AND conducting research — e.g. 'prepare evidence-based policy reports based on
     original research'"
2. Add `guidance_en` field to `EHypothesis` interface (currently absent)
3. Populate `guidance_en` for all 22 interaction keys in `e-hypotheses.ts`

**Acceptance criteria:**
- [ ] `EHypothesis` interface gains `guidance_en?: string`
- [ ] All 22 interaction keys have `guidance_en` populated
- [ ] E extraction system prompt includes guidance per hypothesis (same pattern as R prompt)
- [ ] Re-run capture script; verify ≥ 5 interaction keys now activate across the 15 fixtures
- [ ] `hypotheses-counts.test.ts` still passes

**Effort:** 3–4 hours

---

### Goal 2 — E primary marker audit (under-firing at zones 5–7)

**Scope:** Phase 3 captured responses show E primary COG markers under-firing for mid-to-high
zone roles. Key suspects (review captured responses in `tests/golden/claude-fixtures/`):

| Key | Expected zones | Suspected issue |
|-----|---------------|-----------------|
| `performs_project_management` | Z4–6 | Fires only when "project manager" in title |
| `accountable_for_budget` | Z5–7 | Misses implicit budget ownership |
| `shapes_function_strategy` | Z6–7 | Requires explicit "strategy" language |
| `manages_external_stakeholders` | Z4–6 | Under-fires when stakeholder mgmt is implicit |

For each: review `guidance_en`, compare against G-07 to G-13 captured responses, rewrite if needed.

**Acceptance criteria:**
- [ ] Audit of 4 primary E keys with rewrite where needed
- [ ] Documented before/after guidance_en changes
- [ ] Band match improves (target ≥ 6/15 after Goals 1+2 re-capture)

**Effort:** 2 hours

---

### Goal 3 — Harden MGMT golden assertion

**Scope:** The golden test MGMT assertion is currently soft (warns, doesn't fail). This goal
hardens it once two blockers are resolved:

**Blocker A** (oracle): Non-monotone `manages_staff_directly` in oracle dataset at Z6+
(documented in oracle methodology doc). Until Tomasz runs oracle Phase 0 monotonicity fix,
the fixture truth for G-10, G-12 may be wrong.

**Blocker B** (engine): Management E-markers under-fire due to interaction marker issue (Goal 1).

**When to proceed:** After Goal 1 is complete AND Tomasz confirms oracle MGMT values for
G-10 (Head of Service Design, MGMT=NIE) and G-12 (Legal Adviser, MGMT=NIE).

**Target:** MGMT=true for G-09, G-11, G-13, G-14, G-15 (5 fixtures). MGMT=false for G-01–G-08,
G-10, G-12 (10 fixtures).

**Acceptance criteria:**
- [ ] `golden.test.ts` MGMT assertion hardened from soft-warn to `expect(...).toBe(...)`
- [ ] Passes for all 15 fixtures
- [ ] Oracle monotonicity issue confirmed resolved (Tomasz sign-off)

**Effort:** 1 hour (code is trivial; blocker is data quality)

---

### Goal 4 — WC dimension in golden test

**Scope:** `AxiomeraRunOutput` already includes `wcPkt` and `wcLevel` but the golden test
ignores WC entirely. Add ISCO-2 codes to fixtures and assert on WC output.

**Changes:**
1. Add `declared_isco2?: number` to `GoldenFixture` type
2. Populate for all 15 fixtures from oracle source (ISCO-2 group 2-digit code)
3. Golden test passes `declaredIsco2` to `runAxiomera()` / `computeGrade()`
4. Soft assertion: log WC level divergence (don't fail — WC is a correction, not a gate)

**Acceptance criteria:**
- [ ] `GoldenFixture` interface gains `declared_isco2?`
- [ ] 15 ISCO-2 codes populated
- [ ] Soft WC assertion in golden test (warn only)
- [ ] Fixture file bumped to v1.2.0

**Effort:** 1.5 hours (mostly lookup work for 15 ISCO-2 codes)

**Dependencies:** Tomasz access to ISCO-2 lookup table (or use the `WC_BY_ISCO2` map to
verify plausible codes from role descriptions)

---

### Goal 5 — Golden harness becomes a hard gate

**Scope:** Convert the harness from "measurement + soft assertions" to a proper hard gate
that blocks CI on regression.

**Thresholds (proposed — tighten based on Phase 4 + Goals 1–3 results):**
- Zone match: hard fail if < 8/15 (53%)
- Band match: hard fail if < 8/15 (53%)
- MGMT: hard fail on known-MGMT=true fixtures (Goals 1+3 required first)

**Changes:**
1. `golden.test.ts`: replace zone soft-warn with hard `expect` only after threshold met
2. Add a `GOLDEN_HARD_GATE` env flag — if set, zone/band failures are hard failures
3. Update `vitest.config.ts` to run golden tests in CI with fixtures path set
4. Add `pnpm test:golden:ci` script that sets the flag and the fixtures path from env

**Acceptance criteria:**
- [ ] `GOLDEN_HARD_GATE=true pnpm test:golden` fails on zone mismatch (when below threshold)
- [ ] CI workflow passes when zone ≥ threshold
- [ ] `README.md` or docs updated explaining the gate and how to run locally

**Effort:** 2 hours

---

### Goal 6 — Prompt caching + batching (performance)

**Scope:** Each golden test run costs ~$0.50 (30 API calls). With prompt caching enabled
(`cache_control: ephemeral` on the hypothesis list), the system prompt portion (largest
input block) is cached across calls. Expected savings: ~60–70% of input token cost.

**Changes:**
1. `call-ai.ts`: add `cache_control` to the system prompt message block
2. Capture script: add `--no-cache` flag to disable for baseline measurement
3. Verify caching via manifest `cache_status` field

**Acceptance criteria:**
- [ ] Caching enabled in `callAi()` for Axiomera operations
- [ ] Capture script reports cache hit/miss per call in manifest
- [ ] Cost per full capture run drops by ≥ 40% (measured from manifest token counts)

**Effort:** 1 hour

---

## Sequencing

Goal 1 → Goal 2 → re-capture → Goal 4 → Goal 3 (requires Tomasz) → Goal 5 → Goal 6

- Goals 1+2: E calibration (independent, do together)
- Goal 4 (WC ISCO-2): independent, can be done in parallel with Goals 1+2
- Goal 3 (MGMT harden): blocks on Tomasz oracle confirmation
- Goal 5 (hard gate): blocks on Goals 1–3 results
- Goal 6 (caching): independent, can be done any time

---

## Out of scope for Phase 5

| Item | Deferred to |
|------|-------------|
| Additional fixtures beyond G-15 | Phase 6 (after oracle Phase 1 IRR) |
| V2 model (train classifier on oracle dataset) | Phase 6+ |
| Admin comparison page redesign | Phase 6 |
| /v5/bias-check integration with legacy bridge | Phase 6 |
| Playwright E2E for Axiomera pipeline | Phase 6 |
| External validity study (KF/Hay blind) | Oracle Phase 2 (Tomasz) |

---

## Appendix — Baselines

### Phase 4 exit (target, to be filled after Phase 4)
```
Zone match: ≥5/15   Band match: ?/15
```

### Phase 5 gate target
```
Zone match: ≥8/15 (53%)   Band match: ≥8/15 (53%)
MGMT: 5/5 hard pass
```
