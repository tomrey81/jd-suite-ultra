# 00 — Ultra Migration Control

**Status:** Phase 0 — readiness investigation complete; Phase 1 implementation pending review approval.
**Date created:** 2026-05-01
**Branch:** `ultra-phase-0`

## Source Repos

| Role | Path | Purpose |
|------|------|---------|
| Base | `/Users/tomaszrey/Desktop/Code/jd-suite-pro` | Architectural foundation. NOT TO BE MODIFIED. |
| Reference | `/Users/tomaszrey/Desktop/Code/jd-suite-pro-max` | Methodology source for selective porting. NOT TO BE MODIFIED. |
| Whitepaper | `/Users/tomaszrey/Desktop/screenshots/AXIOMERA_WP_ACCESS.docx` | Authoritative Axiomera methodology v1.0 (April 2026). |

## Target Repo

| Role | Path |
|------|------|
| Working repo | `/Users/tomaszrey/Desktop/Code/jd-suite-ultra` |
| Base branch | `ultra-phase-0` (cut from main, before any feature changes) |

## Non-Destructive Rules

1. `jd-suite-pro` MUST remain untouched. It is the rollback safety net.
2. `jd-suite-pro-max` MUST remain untouched. It is the methodology archive.
3. Inside Ultra:
   - Existing 16-criterion engine (`/api/ai/evaluate`, `EvalResult` model, `CRITERIA` constant) MUST be preserved.
   - Existing DQS/ERS computation MUST be preserved.
   - Existing `/v5/*` routes (bias-check, library, policy-packs) MUST be preserved.
   - Existing Sonification (FSK + receiver + Web Audio engine) MUST be preserved without behavior change.
   - Existing `JDStatus` enum and `JDVersion`/`AdminAuditLog` models MUST not be replaced — only extended.
   - All migrated features MUST be feature-flagged and default OFF.
4. NO Drizzle code from Pro Max is to be copied into Ultra.
5. NO hardcoded i18n strings from Pro Max are to be copied — all UI labels must use `next-intl`.
6. NO Pro Max page components are to be copied — only `lib/` business logic and methodology data.

## Rollback Strategy

| Tier | Mechanism | Recovery time |
|------|-----------|---------------|
| Repo | `jd-suite-pro` is untouched on disk. `jd-suite-ultra` is independent. | Immediate (just deploy Pro instead) |
| Branch | `ultra-phase-0` cut at clean copy point. Each phase gets its own branch. | < 5 min via `git switch` |
| Feature flag | Every migrated feature wrapped with `ENABLE_*` env flag. Defaults OFF. | Immediate (toggle env var, redeploy) |
| Schema | New Prisma models are additive. Existing models untouched. No data migration in Phase 1. | N/A — old data still works |
| Shadow mode | Axiomera/JDQ run in shadow alongside 16-criterion. User can compare. | N/A — both engines coexist |

## Feature-Flag Strategy

All flags are environment variables, read once at server start. UI surfaces gated by:
- Server: `process.env.ENABLE_*` check before route handler
- Client: `NEXT_PUBLIC_ENABLE_*` for visibility toggles

| Flag | Default | Controls |
|------|---------|----------|
| `ENABLE_AXIOMERA_ENGINE` | `false` | Axiomera RSE composition, R-zone calc, S matrix, E hypothesis scoring |
| `ENABLE_AXIOMERA_SHADOW` | `false` | Axiomera runs alongside 16-criterion but result hidden from non-admin |
| `ENABLE_JDQ_LAYER` | `false` | JDQ quality layer (language-score, edge-cases, R+E hypothesis evidence) |
| `ENABLE_R_E_HYPOTHESES` | `false` | Display R-zone + E-hypothesis evidence panels |
| `ENABLE_SEALED_PROGRAMS` | `false` | Program creation/sealing UI and API |
| `ENABLE_APPROVAL_WORKFLOW` | `false` | Multi-stage approval (default OFF preserves existing JDStatus simple flow) |
| `ENABLE_PPTX_EXPORT` | `false` | PPTX option in export dialog |
| `ENABLE_KRYSTYNA_RENAME` | `false` | UI label "Companion" -> "Krystyna" everywhere (system prompt is already Krystyna) |
| `ENABLE_INTERNAL_REGULATIONS` | `false` | Internal Regulations module routes + uploads |
| `ENABLE_COST_DASHBOARD` | `false` | AI cost dashboard route + cost overlays |
| `ENABLE_INTAKE_CHECKLIST` | `false` | Project Intake module |
| `ENABLE_JD_PROJECT_READINESS` | `false` | JD Project Readiness scoring (separate from EUPTD Readiness) |

When all flags are OFF, Ultra MUST behave identically to Pro.

## Methodology Decision Log (initial)

| Decision | Status | Reference |
|----------|--------|-----------|
| Axiomera = R/S/E/WC (4 dims), NOT 13 criteria | LOCKED | Whitepaper v1.0, [12-methodology-architecture.md](12-methodology-architecture.md) |
| Pro 16-criterion engine STAYS as legacy/comparison | LOCKED | Brief: "Do not delete existing Pro evaluation logic" |
| Axiomera enters Ultra in SHADOW mode first | LOCKED | Brief: "shadow mode first" |
| AI Companion renamed to Krystyna in UI; system prompt already says Krystyna | LOCKED | Investigation: companion route system prompt line 47 |
| `/v5/*` is production-shipped (P0a, P0e, P0f), NOT abandoned | LOCKED | Investigation: `/v5/page.tsx` declares "Parallel module · runs alongside JD Suite v4" |
| Sonification stays unchanged; no JD-status dependency exists today | LOCKED | Investigation: jd-sonic.ts is text-only, deterministic |
| No production data migration in Phase 1 | LOCKED | Brief: "Treat production data migration as a separate Phase Data-Migration-1" |
| Test-hypotheses endpoint (Pro, 56 hypotheses) and Pro Max R+E (19+45) need reconciliation | OPEN | See [12-methodology-architecture.md](12-methodology-architecture.md) §5 |

## Migration Phases

| Phase | Scope | Gate to start |
|-------|-------|---------------|
| Phase 0 | Discovery, doc set, Ultra repo, build verification | (this phase) |
| Phase 1 | Methodology architecture, Prisma additions, Axiomera shadow, AI cost logging | All Phase 0 docs reviewed; build green; reviewer signoff |
| Phase 2 | Sealed programs UI; approval workflow with JDVersion mapping; Krystyna UI rename | Phase 1 complete; golden test set passing |
| Phase 3 | PPTX export; Intake Checklist; JD Project Readiness | Phase 2 complete |
| Phase 4 | Method Matrix, Spec Dashboard, Family Diagnostics integration | Phase 3 complete |
| Phase 5 | Internal Regulations module | Phase 4 complete; product spec approved |
| Phase 6 | AI Cost Dashboard surfaced to admins | Phase 5 complete |
| Phase Data-1 | Production data migration from Pro Max (if/when needed) | Separate decision |

## Open Blockers

See [02-phase-0-readiness-report.md](02-phase-0-readiness-report.md) for the full list. Top blockers:
1. No `/api/improve` exists in Pro Max despite UI calling it. Improve Studio prompts must be ported with new endpoint creation in Ultra.
2. Pro Max `quality`, `programs`, `intake`, `readiness` pages are STUBS. UI must be designed in Ultra, not copied.
3. Pro's existing `test-hypotheses` endpoint (56 hypotheses) overlaps with Pro Max R+E (19+45 = 64). Need reconciliation map before Phase 1.

## Acceptance Gates

A Phase is considered complete only when ALL of the following pass. See [11-quality-gates-and-uat.md](11-quality-gates-and-uat.md) for full criteria.

- `pnpm typecheck` passes (currently: PASSING)
- `pnpm lint` passes
- `pnpm --filter @jd-suite/db exec prisma validate` passes (with `DATABASE_URL` env)
- `pnpm build` passes
- Existing Pro routes return same UI/behavior (smoke test)
- Existing 16-criterion evaluation produces same scores on golden set
- Existing Sonification works unchanged
- `/v5/*` routes work unchanged
- i18n still works (locale switch, fallback)
- Auth still works (login, magic link, register)
- New Axiomera/JDQ engine produces output that passes Zod schema validation
- New API routes log AI usage to `AiUsageLog`
- Each migrated feature has unit tests + at least one Playwright smoke test
- Reviewer (you, Tomasz) explicitly signs off

## Reviewer Signoff Log

| Phase | Reviewer | Date | Signed off |
|-------|----------|------|------------|
| Phase 0 | Tomasz Rey | (pending) | (pending) |
