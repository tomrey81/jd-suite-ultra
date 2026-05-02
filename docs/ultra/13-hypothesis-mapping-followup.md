# 13 — Hypothesis Mapping Follow-up (Phase 2)

**Status:** Deferred from Phase 1. Tracked for Phase 2, milestone M2.4.
**Created:** 2026-05-01
**Owner:** Phase 2 implementer

## The gap

`apps/web/lib/axiomera/hypothesis-mapping.ts` contains:

- **`PRO_V5_CATEGORY_MAP`** (complete) — 10 Pro v5 categories mapped to Axiomera dimensions. Sufficient for Phase 1 coexistence.
- **`PRO_V5_ITEM_MAP`** (empty) — intended to map all 56 Pro v5 hypothesis IDs to specific Axiomera marker keys. Not populated because no authoritative cross-reference exists in the source repos.

## Why it was deferred

Two separate hypothesis systems coexist in Ultra:

| System | Source | Count | Used by |
|--------|--------|-------|---------|
| Pro v5 hypotheses | `apps/web/lib/hypotheses/hypotheses.json` | 56 binary items | `/v5/bias-check`, `/api/ai/test-hypotheses` |
| Axiomera R-markers | `lib/axiomera/hypotheses/r-hypotheses.ts` | 19 items | Axiomera engine |
| Axiomera E-markers | `lib/axiomera/hypotheses/e-hypotheses.ts` | 45 items | Axiomera engine |

The two systems were independently authored and use different taxonomies. A per-item mapping requires reading and comparing both sets against the whitepaper — a methodological task, not a code task. It must not be fabricated.

Phase 1 runs both engines independently. The category-level map is enough for the Phase 1 admin comparison view to indicate which Axiomera *dimensions* a Pro v5 *category* touches. The full per-item consolidation is only required when M2.4 (admin hypothesis consolidation view) is built.

## What Phase 2 needs to do

1. Read `apps/web/lib/hypotheses/hypotheses.json` — identify all 56 hypothesis IDs and their category, label, and description fields.
2. For each ID, find the closest Axiomera marker by comparing the hypothesis description to the `guidance_en` field in `r-hypotheses.ts` / `e-hypotheses.ts`.
3. Record in `PRO_V5_ITEM_MAP`:
   ```ts
   'cog_problem_solving': {
     axiomeraKeys: ['solves_without_precedent', 'beyond_existing_methods'],
     rationale: 'Both detect novel-problem cognitive demand (guidance_en match).',
     confidence: 'high',
   }
   ```
4. Where no Axiomera marker matches, record an explicit entry with `axiomeraKeys: []` and a rationale explaining why (e.g. "Pro v5 item is a stylistic check with no Axiomera analogue").
5. Build the admin consolidation view (M2.4) that renders this mapping alongside both engine outputs.
6. Add a unit test asserting all 56 Pro v5 keys are present in `PRO_V5_ITEM_MAP`.

## Acceptance criteria

- [ ] All 56 Pro v5 hypothesis IDs present as keys in `PRO_V5_ITEM_MAP`
- [ ] Every entry has ≥1 `axiomeraKey` OR an explicit `axiomeraKeys: []` with documented rationale
- [ ] No mapping is fabricated — each cites `guidance_en` or whitepaper section as evidence
- [ ] Unit test `hypotheses-counts.test.ts` extended: assert `Object.keys(PRO_V5_ITEM_MAP).length === 56`
- [ ] Admin comparison view at `/admin/jds/[id]/comparison` updated to render per-item links when available

## Risk

If Phase 2 skips this and ships the consolidation view with `PRO_V5_ITEM_MAP` still empty, the view will silently show no cross-references. The `axiomeraDimensionsForProCategory()` helper still works (it uses `PRO_V5_CATEGORY_MAP`), so the comparison page is not broken — it just lacks per-item detail.
