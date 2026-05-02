# 15 — Phase 3 Scope: Real Baseline + Hypothesis Unification

**Status:** In progress
**Branch:** `claude/distracted-hermann` (base: commit after G-7 harness merge `b214357`)
**Created:** 2026-05-02
**Owner:** Claude (distracted-hermann worktree)

---

## Context

Phase 2 shipped the G-7 golden harness with a mock-derived activation strategy: `callAi` is
intercepted by Vitest, and the mock builds R/E activation arrays directly from the fixture's
`expected_hypotheses` boolean flags (stripping the `hypo_` prefix). The Phase 2 baseline
report is:

| Metric | Result |
|--------|--------|
| Zone match | **3/15 (20%)** |
| Band match | **3/15 (20%)** |
| Borderline fixtures | 5 |

This 20% is **expected and not alarming**: the mock injects fixture-truth activations directly
into the scoring formula, but the formula has known gaps (S hardcoded to S2=90 for all
fixtures; E interaction markers all false; MGMT not computed). The real question Phase 3
answers is: *what does Claude actually say when given the JD text?* That answer is currently
unknown and is the primary blocker for all calibration work.

---

## Goals

### Goal 1 — Real Claude fixture baseline (HIGHEST LEVERAGE — do first)

**Scope:** Run the Axiomera R + E extraction pipeline with a real `ANTHROPIC_API_KEY`
against all 15 fixture JD texts. Capture Claude's raw activation JSON for each fixture.
Update the mock layer to prefer these captured responses. Re-run `pnpm test:golden` and
document the new zone/band match %.

**Why first:** This is the unblocker for everything else. Goals 3 and 4 require knowing
what Claude actually says. The current 20% baseline is an artifact of the mock — it tells
us nothing about engine accuracy. Captured responses give us the true baseline and reveal
where the formula fails vs. where Claude fails.

**Acceptance criteria:**
- [ ] Script `apps/web/scripts/capture-golden-claude-responses.ts` exists and is documented
- [ ] 30 JSON files captured: `apps/web/tests/golden/claude-fixtures/G-{01..15}.{r,e}-extract.json`
  (each contains the parsed activation array + metadata)
- [ ] Manifest file `apps/web/tests/golden/claude-fixtures/manifest.json` records capture
  timestamps, model ID, fixture IDs, and any errors
- [ ] `apps/web/lib/golden/claude-mock.ts` updated: `buildRMockResponse` / `buildEMockResponse`
  check for a captured file and load from it; fall back to boolean derivation if absent
- [ ] `pnpm test:golden` re-run; baseline report updated in this doc (§Appendix)
- [ ] Captured JSON files added to `.gitignore` (contain confidential JD analysis)
- [ ] `apps/web/tests/golden/claude-fixtures/README.md` committed explaining the directory

**Estimated effort:** 2–3 hours (script + run + mock update + report)

**Dependencies:** `ANTHROPIC_API_KEY` in environment; fixture file at
`~/Desktop/jd-suite-golden/golden-jd-fixtures.json`

**Risks:**
- Claude may produce different activation patterns than the fixture truth → expected;
  document divergences in the baseline report
- Rate limiting on 30 sequential calls → script adds 1–2s delay between calls + resumability
- Evidence verbatim check (`filterEvidenceInSource`) may reject some Claude quotes if
  Claude paraphrases → logged as warnings, not hard errors in capture mode

---

### Goal 2 — Hypothesis mapping unification (M2.4)

**Scope:** Populate `PRO_V5_ITEM_MAP` in
`apps/web/lib/axiomera/hypothesis-mapping.ts`. Map all 56 Pro v5 hypothesis IDs to
their closest Axiomera R/E marker keys. For each mapping: `axiomeraKeys`, `rationale`,
`confidence`. Where no Axiomera marker exists, document with `axiomeraKeys: []` and a
rationale. Build the admin consolidation view at `/admin/jds/[id]/comparison`.

**Why second:** The category-level map already exists and the comparison page doesn't
crash — this is calibration/completeness work. Does not block Goal 1 or Goal 3.

**Acceptance criteria:**
- [ ] All 56 Pro v5 keys present in `PRO_V5_ITEM_MAP`
- [ ] Every entry cites `guidance_en` or whitepaper section as evidence
- [ ] `hypotheses-counts.test.ts` asserts `Object.keys(PRO_V5_ITEM_MAP).length === 56`
- [ ] Admin comparison view updated to render per-item cross-references

**Estimated effort:** 3–4 hours (methodological review of both hypothesis sets)

**Dependencies:** `apps/web/lib/hypotheses/hypotheses.json` (56 Pro v5 IDs),
`r-hypotheses.ts` (19 Axiomera R keys), `e-hypotheses.ts` (45 Axiomera E keys)

**Risks:** Mappings must not be fabricated — requires careful reading of both systems.
Some Pro v5 items have no Axiomera analogue (stylistic checks); document explicitly.

---

### Goal 3 — MGMT detection in engine output

**Scope:** Derive `mgmt: boolean` from active management R/E keys and add it to
`AxiomeraRunOutput`. Enable and harden the currently-skipped MGMT assertion in
`golden.test.ts`. Detection rule (per `docs/ultra/14-golden-fixtures-setup.md §4 Gap 1`):

```
mgmt = true  if any of:
  manages_staff_directly   (E primary)
  manages_managers          (E primary)
  oversees_senior_leaders   (E primary)
  leads_multiple_functions  (E primary)
  full_mgmt_authority       (to add: derived from E interaction
                              manages_managers_x_full_authority)
```

**Why third:** Requires Goal 1 (real Claude responses reveal which management markers
Claude actually activates). With mock responses, the MGMT assertion was skipped because
the engine doesn't output the field — but we need to know if Claude reliably detects
management markers before asserting on them.

**Acceptance criteria:**
- [ ] `AxiomeraRunOutput` gains `mgmt: boolean`
- [ ] `runAxiomera()` derives and sets `mgmt` from `eActiveKeys`
- [ ] `golden.test.ts` MGMT assertion un-skipped; passes for all 15 fixtures
- [ ] 5 MGMT=true fixtures: G-09, G-11, G-13, G-14, G-15 (per fixture table in doc 14)

**Estimated effort:** 1.5–2 hours

**Dependencies:** Goal 1 (need real Claude responses to calibrate detection thresholds)

**Risks:** Claude may not reliably detect management markers in all 5 MGMT fixtures →
document failures, don't fabricate fixtures. Assertion may need to be soft (warn) for
borderline cases.

---

### Goal 4 — Edu/Exp on fixtures (S-score accuracy)

**Scope:** Add `declared_edu: SLevel` and `declared_exp: SLevel` fields to
`GoldenFixture` type and populate them for all 15 fixtures from oracle source data.
Update `golden.test.ts` to pass these to `runAxiomera()` (or directly to the S formula).
Re-run and document the impact on band match %.

**Why fourth:** 13/15 fixtures currently default to S=90 (S2 = basic qualifications),
which inflates grade for high-zone fixtures and deflates it for low-zone ones. With
correct Edu/Exp values, band assertions become meaningful. This is the last piece to
make the harness a real gate rather than a measurement tool.

**Acceptance criteria:**
- [ ] `GoldenFixture` interface gains `declared_edu` and `declared_exp` (both optional,
  type `SLevel = 1 | 2 | 3 | 4 | 5`)
- [ ] All 15 fixtures have values set (from oracle notes or Tomasz review)
- [ ] `golden.test.ts` passes `declaredEdu` + `declaredExp` to grade computation
- [ ] Band match % documented in updated baseline report
- [ ] Fixture file version bumped to 1.1.0

**Estimated effort:** 1–2 hours (type update is quick; populating the 15 values requires
Tomasz to review the oracle source)

**Dependencies:** Tomasz at desk with access to oracle source data (the edu/exp values
are in the original grading sheets)

**Risks:** Some fixtures may have ambiguous edu/exp (e.g., G-07 sexual violence
counsellor may require degree OR equivalent experience). Mark as borderline and
document.

---

## Out of scope for Phase 3

The following are explicitly deferred and will NOT be done in this phase:

| Item | Deferred to |
|------|-------------|
| Google Drive integration for fixture loading (GDrive stub in `fetch-fixtures.ts`) | Tomasz at desk (needs GCP service account) |
| Additional fixtures beyond G-15 (expanding the golden set) | Phase 4+ |
| UI work: admin comparison page redesign | Phase 4+ |
| Performance tuning (prompt caching, batching) | Phase 5 |
| Export of golden test results to Sheets/GDrive | Tomasz at desk |
| Playwright E2E tests for Axiomera engine | Phase 4 (after engine stabilises) |
| Rewrite/improvement suggestions engine (CUJ-7) | Phase 4+ |

---

## Branch strategy

Base branch: `claude/distracted-hermann` (which starts from `b214357` — G-7 harness merge).

Commits land in this order:
1. `phase3: scope doc` ← this file
2. `phase3: capture script for golden Claude responses`
3. `phase3: gitignore + README for claude-fixtures/`
4. `phase3: claude-mock prefers captured responses over derived activations`
5. `phase3: G-{01..15} captured Claude responses (manifest + schema)` — JSON files NOT
   committed (gitignored); only manifest schema + README
6. `phase3: updated baseline report — X/15 zone match` — after Tomasz runs the script

Tomasz will merge in this order once at desk:
1. `claude/phase1-cleanup` → `main`
2. `claude/phase2-g7-harness` → `main`
3. `claude/distracted-hermann` → `main` (this Phase 3 work)

---

## Sequencing rationale

Goal 1 → Goal 3 → Goal 4 → Goal 2

- Goal 1 is the unblocker. Without real Claude responses, all other metrics are
  artifacts of the mock strategy.
- Goal 3 (MGMT) depends on Goal 1 to verify that management markers activate reliably.
- Goal 4 (Edu/Exp) is independent of Goals 1–3 but benefits from seeing the real
  zone/band numbers first (to understand what's wrong with band match).
- Goal 2 (hypothesis mapping) is purely methodological and does not block the harness
  accuracy goals.

---

## Appendix — Baseline report (to be updated after Goal 1)

### Phase 2 baseline (mock-derived activations)

```
╔══════════════════════════════════════════════════════════════════╗
║              G-7 BASELINE REPORT — engine vs oracle             ║
╠══════════════════════════════════════════════════════════════════╣
║  Zone match:  3/15 (20%)  Band match: 3/15 (20%)                ║
╠══════════════════════════════════════════════════════════════════╣
║  Notes: S=90 (S2) for all fixtures; E interactions=false        ║
╚══════════════════════════════════════════════════════════════════╝
```

### Phase 3 baseline (real Claude responses) — captured 2026-05-02, model: claude-sonnet-4-6

```
╔══════════════════════════════════════════════════════════════════╗
║              G-7 BASELINE REPORT — engine vs oracle             ║
╠══════════════════════════════════════════════════════════════════╣
║  Zone match:  2/15 (13%)  Band match: 2/15 (13%)                ║
║  Borderline fixtures: 4                                         ║
╠══════════════════════════════════════════════════════════════════╣
║  ID    Title                         Z↑  Ze  Band↑ Bande  Match ║
║  G-01  forklift operator             1   2   A1    A2     ✗✗   ║
║  G-02  Pharmacy Aides                1   3   A1    A2     ✗✗   ║
║  G-03  ski lift operator             2   3   A2    A2     ✗✓   ║
║  G-04  automated optical inspection  2   3   A2    A2     ✗✓   ║
║  G-05  aesthetician                  3   3   B1    A2     ✓✗   ║
║  G-06  train driver                  3   4   B1    A3     ✗✗   ║
║  G-07  sexual violence counsellor    4   5   B2    A5     ✗✗   ║
║  G-08  Principal Solicitor           5   6   C1    A5     ✗✗   ║
║  G-09  Head of Rail Reform Analysis  5   6   C1    A5     ✗✗   ║
║  G-10  Head of Service Design        6   6   C2    A5     ✓✗   ║
║  G-11  Head of Innovation, Science   6   7   C2    B2     ✗✗   ║
║  G-12  Legal Adviser to Chancellor   7   6   D1    A5     ✗✗   ║
║  G-13  Assistant Director Procure.   7   6   D1    A5     ✗✗   ║
║  G-14  Chief Executives              8   7   D2    B3     ✗✗   ║
║  G-15  Associate General Counsel     9   6   E     A5     ✗✗   ║
╚══════════════════════════════════════════════════════════════════╝
```

#### Failure analysis

**Zone divergence pattern (13 of 15 fail):**
- Low zones (1–3): engine **over-fires** — Claude activates mid-level R-markers in simple
  roles (G-01 forklift: engine=2 vs oracle=1; G-02 pharmacy: engine=3 vs oracle=1)
- Mid zones (4–6): engine **over-fires by 1** consistently (G-06 train driver engine=4 vs 3;
  G-07 counsellor engine=5 vs 4; G-08 solicitor engine=6 vs 5)
- High zones (7–9): engine **under-fires** — Claude misses high-level markers (G-15 legal
  counsel engine=6 vs oracle=9, a 3-zone gap; G-12, G-13 engine=6 vs oracle=7)
- **Root cause hypothesis:** Claude over-activates `general_direction` (mid-level marker,
  m_zone≈5) in JDs that mention any supervisory language, and under-activates
  `influences_industry` / `org_wide_impact` / `sets_enterprise_vision` in senior roles
  where JD language is formal rather than explicit.

**R-key missing assertion failures (G-05, G-10):**
- Both fail on `general_direction` — oracle marks it true for aesthetician (zone 3) and
  Head of Service Design (zone 6), but Claude does not activate it.
- These are assertion failures from the fixture-truth check (not zone mismatch), meaning
  the fixture expects `general_direction=true` but Claude returns it false.

**Band scores all clustering at A2/A5:**
- Expected: S=90 (S2) default inflates all grades toward lower bands.
- E interaction markers all default to false (no E-interaction captures).
- **Goal 4 (Edu/Exp) is critical** to make band assertions meaningful.

#### What this tells us for next steps

| Finding | Action |
|---------|--------|
| Engine over-fires for zones 1–3 | Revisit R-hypothesis `m_zone` weights for low-level markers; `structured_assignments` / `close_supervision` activating too broadly |
| Engine under-fires for zones 7–9 | Prompt engineering: add more concrete examples for `org_wide_impact`, `member_executive_committee`, `sets_enterprise_vision` |
| `general_direction` inconsistency | Audit guidance_en for this key; Claude's interpretation diverges from oracle in both directions |
| Bands all A2/A5 | Goal 4 (Edu/Exp on fixtures) must be done before band match is meaningful |
| Systematic +1 zone bias for mid-range | Consider floor/ceiling adjustment in `computeWeightedZone` or tighter activation thresholds |
