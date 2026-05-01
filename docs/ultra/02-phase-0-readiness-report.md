# 02 — Phase 0 Readiness Report

Evidence-based answers to all questions raised by the Ultra brief. Every claim cites a file, route, or model.

---

## §1 — What is `/v5/*` in Pro?

**Verdict:** Production-shipped parallel module. Active development as of 2026-04-30. NOT experimental, NOT abandoned. Ultra MUST preserve `/v5/*` unchanged.

### Routes (web)
| Route | File | Last modified | Status |
|-------|------|---------------|--------|
| `/v5` | `apps/web/app/v5/page.tsx` | 2026-04-30 01:17 | Static portal, links to P0a/P0e/P0f |
| `/v5/bias-check` | `apps/web/app/v5/bias-check/page.tsx` | 2026-04-30 11:37 | **shipped** — 4-layer bias engine + embedded 56-hypothesis HypothesisPanel |
| `/v5/library` | `apps/web/app/v5/library/page.tsx` | 2026-04-30 01:18 | **shipped** — Family × Level hierarchy browser |

### Routes (API)
| Route | File | Purpose |
|-------|------|---------|
| `POST /api/v5/bias-check` | `apps/web/app/api/v5/bias-check/route.ts` | Auth-required; calls `analyseBiasWithPacks` from `lib/bias/engine-with-packs.ts` |
| `GET /api/v5/policy-packs` | `apps/web/app/api/v5/policy-packs/route.ts` | Public metadata for ÍST 85, NZ Pay Equity, UK Birmingham packs |

### What `/v5/bias-check` actually does
4-layer bias output:
1. **Skew score** (-1 communal -> 0 balanced -> +1 agentic)
2. **EIGE coverage** (E1 cognitive, E2 emotional, E3 physical)
3. **Iceland implicit-bias detector** (pinkJobUndervaluation, machoLeadership, elektromonterTrap)
4. **Per-flag list** with severity/category/remediation

Plus the embedded **HypothesisPanel** that calls `/api/ai/test-hypotheses` and renders 56 Axiomera/PRISM-aligned binary hypotheses across 10 categories (`COG_LOW`, `COG_HIGH`, `EMO`, `PHY`, `R1_PEOPLE`, `R3_FIN`, `R4_STRAT`, `RISK`, `S2_COMM`, `OTHER`).

### Implication for Ultra Phase 1
Pro **already has a 56-hypothesis Axiomera-aligned panel**. Ultra's Axiomera engine (R + E + WC + S) overlaps with this. Reconciliation plan: see [12-methodology-architecture.md](12-methodology-architecture.md) §5. Net: do not delete `/api/ai/test-hypotheses` — it serves the v5 bias-check use case. Add the deeper Pro Max R(19)+E(45) engine as a separate, advanced "Axiomera Evaluation" surface.

---

## §2 — Existing Pro evaluation engines

**Five distinct scoring/quality systems exist in Pro today.** All MUST be preserved in Ultra.

| Engine | Implementation file | Output model | Storage | UI surface |
|--------|---------------------|-------------|---------|-----------|
| **16-Criterion Evaluation** | `apps/web/app/api/ai/evaluate/route.ts` + `packages/types/src/constants.ts` (`CRITERIA`) | `CriterionResult[]` + `overallCompleteness` | Prisma `EvalResult.criteria` (JSON) + `EvalResult.overallScore` | `/admin/jds/[id]` evaluation panel |
| **DQS** (Document Quality Score) | Computed in `apps/web/app/api/ai/analyse/route.ts` | `dqsScore: number (0–100)` | Transient (UI state) | `/admin/jds/[id]` "Document Completeness" |
| **ERS** (Evaluation Readiness Score) | Computed in `apps/web/app/api/ai/analyse/route.ts` | `ersScore: number (0–100)` | Transient | `/admin/jds/[id]` "Eval Readiness" |
| **Honest Review** | `apps/web/app/api/ai/honest-review/route.ts` | `{verdict, verdictReason, drivesDecisionToday, topWeaknesses, auditorObjections, topPriority, overallNarrative}` | Transient | `/admin/jds/[id]` Honest Review card |
| **Sonic Review** | `apps/web/app/api/ai/sonic-review/route.ts` | `{issues[], overallScore, readyForDecision}` | Transient | `/admin/jds/[id]` Sonic Review card |
| **Test Hypotheses** (Axiomera/PRISM) | `apps/web/app/api/ai/test-hypotheses/route.ts` + `apps/web/lib/hypotheses/hypotheses.json` | `HypothesesTestReport` with 56 binary results across 10 categories | Transient | `/v5/bias-check` HypothesisPanel |
| **Pay Groups (AI)** | `apps/web/app/api/ai/pay-groups/route.ts` | (not fully read; AI grouping suggestions) | (likely transient or `PayGroup` model) | `/admin/jds/[id]` and pay-groups admin |

**16-Criterion details:**
- Categories: Knowledge & Skills (5), Effort (4), Responsibility (6), Work Environment (1) = 16 criteria total
- Status enum per criterion: `sufficient | partial | insufficient`
- Scale: each criterion has a `max` field (e.g., id 1 max=9, id 2 max=7, etc.)
- Stored: `EvalResult` Prisma model with `criteria: Json` field, `overallScore: Int`, `version: Int`, `jdId`, `createdById`

**Deletion impact:** Removing any of these engines would break the `/admin/jds/[id]` page panels and tests using `EvalResult`. **Do not delete; treat as legacy/comparison engines.**

---

## §3 — Methodology systems comparison

| Aspect | Pro 16-Criterion | Pro Max JDQ/R+E | Axiomera Whitepaper v1.0 |
|--------|-------------------|------------------|---------------------------|
| Source | Hay-style EUPTD-aligned | `lib/jdq/`, `lib/hypotheses/` | Quadrance whitepaper |
| Dimensions | 4 categories, 16 criteria | R + S + E (with WC scale) | R + S + E + WC |
| R | "Responsibility" 6 sub-criteria | 19 R-hypotheses (3 levels each) → 9 R-zones | 9 R-zones (Jaques TSD), Stratum I–VIII |
| S | "Knowledge & Skills" 5 sub-criteria + "Practical Skills" | `s-scale.ts` 5 levels + grade map | Edu × Exp 5×5 matrix (50/90/150/230/333 pts) |
| E | "Effort" 4 sub-criteria | 45 E-hypotheses (18 COG + 15 EMO + 12 PHY) | 35 hypotheses (subset of 54) with O*NET benchmark, COG 45% / EMO 25% / PHY 30% |
| WC | "Work Environment" 1 criterion (id 16) | `wc-scale.ts` ISCO_2 → W1–W5 | EWCS 2024, 12 vars × 42 ISCO_2 groups, 50–350 pts |
| Weights | Each criterion has `max` (0–9 scale) | `compose.ts` AXIOMERA_RSE_WEIGHTS | R 47.2%, S 33.3%, E 19.5%, WC separate |
| Grade formula | `overallCompleteness 0–100` | `Grade = round((R+S+E)/50)` | `Grade = round((R+S+E)/50)`, bands A1–E5 |
| Validation | None published | Cronbach α, O*NET ρ documented in code comments | Spearman ρ COG 0.702 / EMO 0.472 / PHY 0.587, η² differentiation, COSMIN 2024 |
| EU AI Act compliance | Implicit | Implicit | Art. 11/13/14/9 explicitly mapped |

### Is Pro Max JDQ the same as Axiomera?
**Yes, with caveats.** Pro Max's `lib/jdq/compose.ts` exports `AXIOMERA_RSE_WEIGHTS` and uses `computeGrade((R+S+E)/50)` — identical formula. R-hypothesis count (19) matches whitepaper's R-marker structure. E-hypothesis count is 45 in Pro Max code vs 35 in the validated subset of the whitepaper (54 total) — Pro Max may be using an older or a slightly different version. **Phase 1 must reconcile to whitepaper v1.0.**

### Does Pro Max R+E map to Axiomera 13 criteria?
**No — there are no "13 criteria" in Axiomera.** Whitepaper has 4 dimensions. Memory file claiming 13 criteria was inaccurate; corrected.

### Does Pro 16-criterion conflict with Axiomera?
**No conflict — different methodologies serving different purposes.**
- 16-criterion = simpler EUPTD readiness / pay equity gap analysis (Hay-style)
- Axiomera = full evidence-based grading (Jaques + CLT + EWCS + EU AI Act)

### Decision: keep both, label clearly
- **Legacy 16-Criterion Evaluation** — kept as compatibility layer; existing customers continue to see it
- **Axiomera Evaluation** — new advanced engine; opt-in via flag; runs in shadow mode first
- **JDQ Quality Layer** — quality/readiness layer that feeds the Axiomera evidence
- **EUPTD Readiness** — separate compliance self-assessment (different concept; do not collapse into Axiomera)

Naming and UX details: [12-methodology-architecture.md](12-methodology-architecture.md).

---

## §4 — Production data fate

### What's in Pro Max today
Screenshots show real JDs:
- Merz Therapeutics Poland (audited)
- Profile_Marketing Manager (audited, quality 40)
- National Sales & Tender Manager (audited, quality 40)
- Profile_Medical Manager (audited, quality 40)
- Profile_KAM_Commercial (audited, quality 40)
- Finance Manager (audited, quality 76, "Najbliżej gotowości")

### Key questions
| Question | Answer |
|----------|--------|
| Is data migration required NOW? | **No.** Brief explicitly says "Treat production data migration as a separate Phase Data-Migration-1." |
| Are Pro Max users/pods/JDs to be migrated to Ultra? | Eventually, yes. Not in Phase 1. |
| Are sealed programs already created in Pro Max? | Likely no — `/programs` page in Pro Max is a STUB that says "Phase 1.1" for admin UI. Sealing API may exist but has not been actively used. |
| Are approval records / audit trails already present in Pro Max? | Yes — `audits` table receives JDQ run results. Pro Max has 7 audited JDs in production. |
| What must be preserved if data migration happens later? | (1) Audit immutability — existing audit_events records cannot be re-keyed or re-timestamped. (2) Sealed program weights — if any exist. (3) JD versioning history — every edit has a record. |
| Is there an immutability promise that must not be broken? | Yes. Approval ledger (`approvalRecords` in Pro Max), audit events (`auditEvents`), sealed JDQ programs (`jdqPrograms.sealed=true`). Breaking these would erase regulatory defensibility. |

### Decision (LOCKED)
- **No production data migration in Phase 1.**
- Phase 1 builds schema-compatible models so a future migration script can map cleanly.
- Phase 1 documents the field-by-field mapping in [12-methodology-architecture.md](12-methodology-architecture.md) so when Data-Migration-1 is approved, no archeology is required.
- If a Pro Max client needs to access their data on Ultra urgently, a temporary read-only export-import (PDF/PPTX export from Pro Max, manual re-entry in Ultra) is acceptable bridge.

---

## §5 — Route verification

Full per-route classification: [03-route-verification-matrix.md](03-route-verification-matrix.md).

Summary:
- Pro `/v5/*` routes: **all working, shipped**
- Pro Max routes claimed "Complete":
  - **REAL (11):** dashboard, library, editor, jd/[id], jd/new, studio, studio/library, swp, family, architecture, audit-trail, improve (UI only — calls non-existent /api/improve), sonic, generate, reports
  - **STUB (8):** quality, programs, intake, readiness, methods, rubric, hypotheses, process, spec
  - **MOCK (1):** external (hardcoded 6 source cards)
  - **HYBRID (1):** rasci (works in-memory, no persistence)

---

## §6 — Sonification non-interference

Full design: [04-sonification-contract.md](04-sonification-contract.md).

Key facts:
- `lib/jd-sonic.ts` `computeJdFingerprint(text, scale, root)` is **text-only and deterministic**.
- **No dependency on JDStatus, approval state, or evaluation results.**
- FSK token format: `jd:<uuid>` or path `/jd/<uuid>`.
- Receiver page is **public (no auth)** — anyone with the audio can decode the token.

**Implication:** Phase 1 schema additions (Axiomera tables) cannot break Sonification, because Sonification reads `JobDescription.data` (the JSON template fields) only. As long as `data` shape doesn't change, Sonification is safe.

**New rule for Phase 2 approval workflow:** If `ENABLE_APPROVAL_WORKFLOW=true`, Sonification's broadcast/publish UI MUST gate on `JDStatus = APPROVED` (or `PUBLISHED` if we add that stage). Receiver page stays public — only the broadcaster's UI gates.

---

## §7 — Krystyna decision

**Pro's AI Companion ALREADY identifies as Krystyna in its system prompt** (`apps/web/app/api/ai/companion/route.ts` line 47: `"You are Krystyna — the JD Suite AI Companion."`).

This means the rename is primarily a **UI surface change**, not a backend redesign. Full plan: [05-krystyna-assistant-plan.md](05-krystyna-assistant-plan.md).

---

## §8 — Internal Regulations module

**Neither Pro nor Pro Max implements this.** Confirmed gap.

Plan: [06-internal-regulations-module-plan.md](06-internal-regulations-module-plan.md). NOT to be implemented in Phase 1.

---

## §9 — AI cost model

No central cost-tracking mechanism exists in either Pro or Pro Max today. Each AI route calls `callClaude` directly with no usage logging.

Plan: [07-ai-cost-model.md](07-ai-cost-model.md). Phase 1 will add minimal `AiUsageLog` Prisma model + central wrapper.

---

## §10 — Rollback and feature flags

Plan: [08-rollback-and-feature-flag-plan.md](08-rollback-and-feature-flag-plan.md).

Critical commitment: when ALL feature flags are OFF, Ultra MUST behave identically to Pro. Phase 1 acceptance test will verify this.

---

## §11 — Approval workflow + JDVersion mapping

Pro's `JDVersion` model has `changeType` enum with these values:
`FIELD_EDIT | STATUS_CHANGE | COMMENT | IMPORT | AI_ASSIST | EVALUATION | EXPORT`.

Pro's `JDStatus` enum: `DRAFT | UNDER_REVISION | APPROVED | ARCHIVED`.

Pro Max's approval workflow has 6 stages. Mapping plan: [09-approval-versioning-design.md](09-approval-versioning-design.md).

Net: Ultra adds an `ApprovalRecord` model that **references** `JDVersion` records of `changeType = STATUS_CHANGE`. No drift.

---

## §12 — i18n

Pro uses `next-intl` with **9 locales**: en, pl, de, fr, es, sk, cs, ro, sv (NOT 12 as earlier audit doc claimed; corrected).

Plan: [10-i18n-migration-rules.md](10-i18n-migration-rules.md). Every migrated UI string MUST have keys in all 9 locale JSONs.

---

## §13 — Quality gates / smoke tests / UAT

Plan: [11-quality-gates-and-uat.md](11-quality-gates-and-uat.md). 10+ gates, 14 critical user journeys.

---

## Final blockers list

| # | Blocker | Severity | Resolution path |
|---|---------|----------|-----------------|
| 1 | Pro test-hypotheses (56) vs Pro Max R+E (19+45) reconciliation | High | [12-methodology-architecture.md](12-methodology-architecture.md) §5 + Phase 1 decision |
| 2 | No `/api/improve` exists in Pro Max | Medium | Phase 3 — port `lib/improve/rewrite.ts` prompt + new endpoint |
| 3 | Pro Max stubs for quality/programs/intake/readiness | Medium | Build proper UI in Ultra using Pro's Shadcn; do not copy Pro Max UI |
| 4 | Pro Max E-hypothesis count (45) vs whitepaper validated subset (35) | Low | Phase 1 — verify which set is canonical and document |
| 5 | DATABASE_URL not in `.env.example` for `prisma validate` | Low | Add placeholder to `.env.example` |
| 6 | No production data migration scoped — but real Pro Max users have data | Low (deferred) | Phase Data-Migration-1 |
| 7 | No central AI usage logging | Medium | Phase 1 first deliverable |

---

## Go / no-go recommendation

**Phase 0 deliverables: COMPLETE.**

Build verification:
- ✅ `pnpm install` succeeds
- ✅ `pnpm typecheck` passes
- ✅ Prisma schema valid (with `DATABASE_URL` placeholder)
- ✅ `.git/` history preserved
- ✅ `ultra-phase-0` branch cut from clean copy
- ✅ All 13 docs drafted

**Recommendation: GO for Phase 1 implementation, with the following gates:**
1. Reviewer (Tomasz) reads all 13 docs and either signs off or rejects.
2. Resolution plan agreed for Blocker #1 (test-hypotheses reconciliation).
3. Phase 1 scope locked to: methodology architecture, Prisma additions, Axiomera shadow mode, AI cost logging foundation. NO sealed programs UI, NO approval workflow, NO Krystyna rename UI in Phase 1 — those are Phase 2.
