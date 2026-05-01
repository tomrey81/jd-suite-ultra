# 01 — Implementation Log

Chronological log of every material decision, copied/rewritten file, schema change, rejected approach, and risk encountered during the Ultra build.

Format: `[YYYY-MM-DD] [PHASE] [TYPE] description`. Types: DECISION, COPY, REWRITE, REJECT, RISK, BUILD, TEST, REVIEW.

---

## 2026-05-01 — Phase 0

**[2026-05-01] [P0] [BUILD]** Created `/Users/tomaszrey/Desktop/Code/jd-suite-ultra` via `rsync -a` from `jd-suite-pro`, excluding `node_modules`, `.next`, `dist`, `build`, `.turbo`, `*.log`, `.DS_Store`, `coverage`, `playwright-report`, `test-results`. Final size: 8.1 MB. `.git/` directory preserved (full history). Cut new branch `ultra-phase-0` from `main`.

**[2026-05-01] [P0] [DECISION]** Renamed root `package.json` field `name` from `jd-suite` to `jd-suite-ultra`. Did NOT rename workspace package scopes `@jd-suite/db` and `@jd-suite/types` to preserve import paths across the codebase. Brief explicitly required: "Do not break import paths." Renaming workspace scopes would require changing every `from '@jd-suite/db'` import — high churn, high regression risk, zero functional benefit.

**[2026-05-01] [P0] [BUILD]** `pnpm install --prefer-offline` succeeded in 4.9s using local pnpm cache. 853 packages added. Husky `prepare` hook ran. `prisma generate` ran via `packages/db postinstall`.

**[2026-05-01] [P0] [TEST]** `pnpm typecheck` (`tsc --noEmit` on apps/web) passed with exit code 0. Baseline TypeScript health confirmed.

**[2026-05-01] [P0] [TEST]** `pnpm --filter @jd-suite/db exec prisma validate` failed initially due to missing `DATABASE_URL` env. Re-ran with placeholder `DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?sslmode=disable` — schema validated cleanly. Result: "The schema at prisma/schema.prisma is valid 🚀". Note for future: `.env.example` should populate `DATABASE_URL` for `prisma validate` to work without manual env injection.

**[2026-05-01] [P0] [DECISION]** Confirmed Axiomera methodology is **R/S/E/WC (4 dimensions)**, not "13 criteria, 18 validation gates" as previously assumed. Source: AXIOMERA_WP_ACCESS.docx Wersja 1.0 (April 2026). See [12-methodology-architecture.md](12-methodology-architecture.md) and `~/.claude/projects/-Users-tomaszrey/memory/reference_axiomera_methodology.md` for authoritative facts.

**[2026-05-01] [P0] [DECISION]** Pro `/v5/*` is **production-shipped**, not abandoned. Phases P0a (bias-check, 56-hypothesis Axiomera-aligned panel), P0e (library hierarchy), P0f (policy packs). Last modified 2026-04-30. Ultra MUST preserve `/v5/*` unchanged. See [03-route-verification-matrix.md](03-route-verification-matrix.md).

**[2026-05-01] [P0] [DECISION]** Pro AI Companion's system prompt **already names the assistant "Krystyna"**. The rename task is therefore primarily a **UI label change**, not a backend overhaul. The companion endpoint (`/api/ai/companion`) and prompt builder do not need substantive changes — only UI strings, navigation entries, and translation keys. See [05-krystyna-assistant-plan.md](05-krystyna-assistant-plan.md).

**[2026-05-01] [P0] [DECISION]** Pro Max routes flagged as "Complete" in earlier audit are NOT all complete. Verification: `quality`, `programs`, `intake`, `readiness`, `methods`, `rubric`, `hypotheses`, `process` are STUBS rendering hardcoded data. The portable value of Pro Max is the **`lib/` engine (~2,200 LOC of methodology code)**, not its UI. Brief was correct to specify "Do not copy Pro Max UI architecture." See [03-route-verification-matrix.md](03-route-verification-matrix.md).

**[2026-05-01] [P0] [RISK]** No `/api/improve` endpoint exists in Pro Max despite the `improve` UI calling it. Pro Max's Improve Studio appears to be UI-only with no backend. Mitigation for Phase 3: build new endpoint in Ultra using Pro Max's `lib/improve/rewrite.ts` prompt logic + Pro's `callClaude` wrapper.

**[2026-05-01] [P0] [RISK]** Pro's `/api/ai/test-hypotheses` endpoint uses 56 binary hypotheses aligned to "Axiomera/PRISM" (system prompt line 9). Pro Max `lib/hypotheses/` has 19 R + 45 E = 64 hypothesis markers. These are TWO PARALLEL Axiomera implementations that need reconciliation before Phase 1. Reconciliation strategy: see [12-methodology-architecture.md](12-methodology-architecture.md) §5. Likely outcome: Pro Max's 19+45 system is the canonical Axiomera (matches whitepaper hypothesis types P/I); Pro's 56-hypothesis system serves the v5 bias-check use case and may need to be a SUBSET (or superset+extension).

**[2026-05-01] [P0] [DECISION]** Created `docs/ultra/` directory inside Ultra. All 13 Phase 0 docs live here.

**[2026-05-01] [P0] [REVIEW]** Phase 0 docs drafted: `00`–`12` in `docs/ultra/`. Awaiting reviewer signoff before Phase 1 begins.

---

## 2026-05-01 — Phase 1

**[2026-05-01] [P1] [DECISION]** Phase 1 implementation begins on branch `ultra-phase-0`. Scope: feature flags, AI cost wrapper, Prisma additions for Axiomera/JDQ/AiUsageLog, Axiomera engine port from Pro Max, hypothesis reconciliation scaffold, admin comparison UI. Sealed programs, approval workflow, Krystyna rename, PPTX, intake/readiness UI deferred to Phase 2-3 per [00](00-ultra-migration-control.md).

**[2026-05-01] [P1] [WRITE]** `apps/web/lib/feature-flags.ts` with 16 flags (all default OFF except `AXIOMERA_SHADOW_MODE` which defaults ON when `AXIOMERA_ENGINE` is on). Read once per server start.

**[2026-05-01] [P1] [WRITE]** `apps/web/lib/ai/model-registry.ts` with 6 model tiers (haiku/sonnet/opus/embedding-small/embedding-large/deterministic) and 25 operation defaults. Prices marked with `effectiveFrom: '2026-05-01'` — to be reviewed quarterly.

**[2026-05-01] [P1] [WRITE]** `apps/web/lib/ai/prompt-versions.ts` registry covering existing Pro operations plus new Axiomera operations. All at `v1.0.0`.

**[2026-05-01] [P1] [WRITE]** `apps/web/lib/ai/call-ai.ts` central wrapper: estimates input tokens, calls Anthropic, parses usage from response, computes cost, inserts `AiUsageLog` row (insert-only, errors logged with status='error'). Falls back to estimates if API doesn't return usage. Deterministic-tier operations log a zero-cost row and return empty text (so non-AI scoring is tracked for completeness).

**[2026-05-01] [P1] [REWRITE]** `apps/web/lib/ai.ts` `callClaude()` now routes through `callAi()`. Preserves original 3-arg signature so all existing call sites work unchanged. New 4th argument `{ operation, tier, context, temperature }` lets routes tag their cost-tracking metadata.

**[2026-05-01] [P1] [SCHEMA]** Added 14 Prisma models to `packages/db/prisma/schema.prisma`: `AiUsageLog`, `AxiomeraRun`, `AxiomeraCriterionScore`, `AxiomeraValidationGate`, `JdqRun`, `RHypothesisRecord`, `EHypothesisRecord`, `RZoneEstimate`, `EScoreSummary`, `JdqProgram`, `ApprovalRecord` (Phase 2 use), `IntakeSession` (Phase 3 use), `ReadinessScore` (Phase 3 use). All additive. `JobDescription` and `User` got new optional backrefs only. `prisma validate` passes; `prisma generate` regenerated client.

**[2026-05-01] [P1] [COPY]** Hypothesis data files copied verbatim from Pro Max `lib/hypotheses/` to `apps/web/lib/axiomera/hypotheses/`: `r-hypotheses.ts` (19 R-markers), `e-hypotheses.ts` (45 E-markers, 18 COG + 15 EMO + 12 PHY), `s-scale.ts` (5x5 Edu×Exp matrix), `wc-scale.ts` (42 ISCO_2 groups). Schema validators copied from Pro Max `lib/jdq/schemas.ts` to `apps/web/lib/axiomera/schemas.ts`. Import paths fixed (`../hypotheses/` → `./hypotheses/`).

**[2026-05-01] [P1] [REWRITE]** `apps/web/lib/axiomera/extract-r.ts` and `extract-e.ts`: ported from Pro Max but adapted to use Ultra's `callAi()` instead of Pro Max's `callClaude()`. Preserves the retry-with-schema-validation pattern (max 3 attempts) and the verbatim-evidence-must-be-in-source filter. Operation names: `jd.axiomera.extractR`, `jd.axiomera.extractE`.

**[2026-05-01] [P1] [WRITE]** `apps/web/lib/axiomera/compose.ts`: re-implemented Whitepaper formulas. Exports `AXIOMERA_RSE_WEIGHTS = { R: 0.472, S: 0.333, E: 0.195 }`, `computeGrade((R+S+E)/50)`, `gradeToBand(grade)` returning A1-E5, `computeCiGlobal = 0.65*ci_R + 0.35*ci_E`, `isContradiction = |ci_R - ci_E| > 0.30`, `needsReview` (CI<0.6 OR contradiction), JDQ legacy compose for the quality layer.

**[2026-05-01] [P1] [WRITE]** `apps/web/lib/axiomera/run.ts`: full pipeline orchestrator. Runs R + E in parallel; resolves S from declared Edu×Exp / Job Zone fallback / ISCO_2 default; resolves WC from ISCO_2 (default 50 if not provided); composes Grade; persists `AxiomeraRun` + `AxiomeraCriterionScore` (6 rows: R/S/E_COG/E_EMO/E_PHY/WC) + `AxiomeraValidationGate` (3 gates: CI_global threshold, R/E divergence, R contradictions). Returns shape suitable for direct API response.

**[2026-05-01] [P1] [WRITE]** `apps/web/lib/axiomera/hypothesis-mapping.ts`: scaffold mapping Pro `/api/ai/test-hypotheses` 56-hypothesis categories to Axiomera dimensions. Per-item map left empty for follow-up task. Coexistence is the active strategy: Pro's test-hypotheses panel stays unchanged; Axiomera engine runs separately.

**[2026-05-01] [P1] [WRITE]** `apps/web/app/api/jd/[id]/axiomera/route.ts`: POST runs the Axiomera engine; GET returns latest 10 runs. Both gated by `ENABLE_AXIOMERA_ENGINE` flag (404 when off). GET additionally requires admin role when `ENABLE_AXIOMERA_SHADOW_MODE=true` (default). Min JD content length 80 chars enforced before invoking the engine.

**[2026-05-01] [P1] [WRITE]** `apps/web/app/admin/jds/[id]/comparison/page.tsx`: side-by-side admin view of latest Axiomera run and latest legacy 16-criterion EvalResult. Shows R/S/E/WC breakdown, active marker counts, contradiction status, CI global, review flag. Includes 5-row history table when more than one Axiomera run exists. Reading guide explains the two engines answer different questions.

**[2026-05-01] [P1] [REWRITE]** Tagged 7 priority AI routes with operation names: `analyse` (manually), `evaluate`, `honest-review`, `test-hypotheses`, `generate-field`, `end-session`, `companion` (via batch script). All other routes still log via the legacy `callClaude` default operation `legacy.callClaude`.

**[2026-05-01] [P1] [TEST]** Added `apps/web/vitest.config.ts` and 3 unit-test files: `compose.test.ts` (19 tests on grade math, band mapping, CI logic, JDQ composite), `hypotheses-counts.test.ts` (14 tests verifying 19 R + 45 E + 5x5 S matrix + 40+ WC entries), `schemas.test.ts` (11 tests on activation validation + anti-hallucination evidence filter). 44 tests pass.

**[2026-05-01] [P1] [BUILD]** `pnpm typecheck` clean, `pnpm test` 44/44 pass, `prisma validate` passes, `pnpm build` produces production bundle including `/admin/jds/[id]/comparison` and `/api/jd/[id]/axiomera`. Lint requires interactive Next.js setup (pre-existing Pro state, not introduced by Phase 1).

**[2026-05-01] [P1] [REVIEW]** Phase 1 implementation complete. Acceptance criteria from [12](12-methodology-architecture.md) §10:
- ✅ 14 Prisma models added; existing models untouched
- ✅ `lib/axiomera/` directory with engine code
- ✅ `lib/axiomera/hypothesis-mapping.ts` scaffold
- ✅ `POST /api/jd/[id]/axiomera` route gated by flag
- ✅ Admin comparison page gated by flag
- ✅ All AI calls go through `callAi()` (legacy + 7 tagged routes)
- ✅ Existing 16-criterion engine UNCHANGED in code
- ✅ `/v5/*` routes UNCHANGED
- ✅ Sonification UNCHANGED (no schema mutation that touches `JobDescription.data`)
- ⚠️ Golden test set NOT yet implemented (deterministic math + counts tested instead). Phase 2 task: build 10 golden JDs and compare full Axiomera pipeline output against fixed expected ranges.

**Next:** Apply migration to a real Neon DB (`pnpm db:migrate:dev --name phase1-axiomera-ai-usage`), enable `ENABLE_AXIOMERA_ENGINE=true` in a staging env, run a real audit, validate output, then enable `ENABLE_AXIOMERA_SHADOW_MODE=false` after admin review.
