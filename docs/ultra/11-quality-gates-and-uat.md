# 11 — Quality Gates and UAT

Acceptance gates that every Ultra phase MUST pass before being considered complete. Modeled on Six-Sigma-style quality gates plus user acceptance testing.

---

## §1 — Universal gates (every phase)

| # | Gate | Tool | Required |
|---|------|------|----------|
| G-1 | Build passes | `pnpm build` | Yes |
| G-2 | TypeScript clean | `pnpm typecheck` | Yes |
| G-3 | ESLint clean | `pnpm lint` | Yes |
| G-4 | Prisma schema valid | `pnpm --filter @jd-suite/db prisma validate` | Yes |
| G-5 | Prisma migrations apply cleanly to a fresh DB | `prisma migrate dev` on empty DB | Yes |
| G-6 | Existing Pro routes still work | Playwright smoke suite | Yes |
| G-7 | Existing 16-criterion engine produces same scores on golden JD set | Vitest golden-set tests | Yes |
| G-8 | Existing Sonification works (broadcast + receiver decode) | Playwright + manual audio test | Yes |
| G-9 | `/v5/*` routes work unchanged | Playwright | Yes |
| G-10 | i18n routing works (locale switcher) | Playwright | Yes |
| G-11 | Auth flows work (login, magic link, register, reset-password) | Playwright | Yes |
| G-12 | No major console errors on critical routes | Playwright with `console.error` listener | Yes |
| G-13 | Migrated feature unit tests pass | Vitest | Yes |
| G-14 | Migrated feature has at least one Playwright smoke test | Playwright | Yes |
| G-15 | i18n verification (all keys in all locales) | `pnpm i18n:verify` | Yes |
| G-16 | AI usage logging captures every Claude/OpenAI call | Vitest integration test that mocks API and verifies `AiUsageLog` row | Yes (Phase 1+) |
| G-17 | Each migrated feature reaches >= 8/10 acceptance score (this doc §3) | Reviewer scoring | Yes |
| G-18 | Reviewer (Tomasz) explicitly signs off | Manual | Yes |

If any gate fails, the phase is NOT complete. The implementation log ([01](01-implementation-log.md)) must list which gate failed and why.

---

## §2 — Critical user journeys

These are end-to-end Playwright tests that MUST pass after every phase.

### CUJ-1 — Authentication
- Visit `/login`, enter valid credentials, redirected to dashboard
- Visit `/login`, enter invalid credentials, see error
- Visit `/forgot-password`, request reset, receive email (mocked), click link, set new password, login
- Visit `/register`, create new user + org, redirected to welcome flow

### CUJ-2 — Create JD
- Login, click "New JD"
- Choose template
- Fill required fields
- Save -> redirected to JD detail page
- `JDVersion` row created with `changeType=FIELD_EDIT` (or initial creation type)

### CUJ-3 — Edit JD
- Open existing JD
- Edit a field
- Save -> field updates, version history shows new entry

### CUJ-4 — Run existing 16-criterion evaluation
- Open JD with sufficient content
- Click "Evaluate"
- See 16-criterion results panel
- `EvalResult` row created
- Verify `AiUsageLog` row created (Phase 1+)

### CUJ-5 — Run Axiomera in shadow mode (Phase 1+)
- Set `ENABLE_AXIOMERA_ENGINE=true`, `ENABLE_AXIOMERA_SHADOW_MODE=true`
- Open same JD
- Click "Evaluate"
- 16-criterion shown to user
- Admin opens `/admin/jds/[id]/comparison` -> sees Axiomera vs 16-criterion side-by-side

### CUJ-6 — Compare evaluation results (Phase 1+)
- Admin comparison page shows: 16-criterion score, Axiomera grade, R/S/E/WC breakdown, delta commentary
- Both engines' detailed data accessible

### CUJ-7 — Rewrite JD (Phase 3+)
- Open JD, click "Improve"
- Select mode (e.g., "Eval-ready")
- See suggested changes with rationale
- Apply selected changes
- New `JDVersion` rows created

### CUJ-8 — Approve/reject JD (Phase 2+)
- Set `ENABLE_APPROVAL_WORKFLOW=true`
- Configure org with default 4-stage policy
- Author submits JD for review (DRAFT -> MANAGER_VALIDATION)
- Manager logs in, sees pending review, approves -> HR_REVIEW
- HR rejects with comment -> back to DRAFT
- `ApprovalRecord` and `JDVersion` rows linked correctly

### CUJ-9 — Publish JD (Phase 2+)
- After APPROVED, admin clicks "Publish"
- Status -> PUBLISHED
- `ApprovalRecord` created with `toStage=PUBLISHED`

### CUJ-10 — Sonification broadcast — only allowed JDs (Phase 2+, flag-gated)
- With `ENABLE_APPROVAL_WORKFLOW=true`, open DRAFT JD's studio
- Click broadcast -> confirmation dialog appears
- Cancel -> no broadcast
- Open APPROVED JD's studio
- Click broadcast -> no dialog, broadcast proceeds
- Receiver decodes token correctly

### CUJ-11 — Export PDF/DOCX/XLSX
- Open JD, click Export
- Select PDF -> file downloads
- Select DOCX -> file downloads
- Select XLSX -> file downloads
- All formats contain expected JD content

### CUJ-12 — Export PPTX (Phase 3+, flag-gated)
- With `ENABLE_PPTX_EXPORT=true`, open Export dialog
- PPTX option is now visible
- Select PPTX -> 13-slide branded report downloads
- Slides include: title, executive summary, role list, audit status, scores, spider charts

### CUJ-13 — Switch languages
- Login, change locale to PL via switcher
- Reload -> UI is in Polish
- Open JD detail -> all UI labels in Polish
- Switch to DE -> UI in German
- Krystyna widget reads correct language

### CUJ-14 — Krystyna context awareness (Phase 2+)
- Set `ENABLE_KRYSTYNA_RENAME=true`
- Open Krystyna widget on `/jd/[id]`
- Ask: "What's the status of this JD?"
- Krystyna response references the open JD's title and status
- Avatar/name shows "Krystyna" in widget header

### CUJ-15 — Admin user management
- Admin opens `/admin/users`
- Create new user, assign role
- New user receives invite email (mocked)
- New user accepts, can log in
- `AdminAuditLog` row created for the user creation

### CUJ-16 — Audit / version history
- Open JD detail
- Click "Version history" -> see chronological list
- Each entry: actor, change type, timestamp, details
- (Phase 2+) Approval timeline visible alongside, both consistent

### CUJ-17 — AI cost tracking (Phase 1+)
- Run an evaluation on a JD
- Open admin DB query (or future `/admin/ai-cost` page Phase 6)
- Verify `AiUsageLog` rows for every AI operation triggered
- `estimatedCostUsd` is non-zero and within expected range

---

## §3 — Per-feature acceptance scoring (1–10)

Each migrated feature is scored on 10 dimensions. Below 8/10 = NOT complete.

| Dimension | What it measures |
|-----------|-------------------|
| 1. Functional correctness | Does it do what was specified? |
| 2. Build/test/lint clean | All universal gates pass |
| 3. Type safety | No `any`, no `as any`, no implicit-any. Zod schemas for AI outputs. |
| 4. Error handling | Errors don't crash UI; user sees actionable message |
| 5. Loading/empty states | Loading spinner shown; empty state explains what to do |
| 6. i18n compliance | All user-facing strings translated; no hardcoded English |
| 7. Accessibility | Semantic HTML, keyboard navigable, ARIA where needed |
| 8. Test coverage | Unit + at least one Playwright smoke test |
| 9. Cost awareness | AI calls go through `callAi()`; costs logged |
| 10. Documentation | Implementation log entry; user-facing label/help text |

### Scoring rubric per dimension

- **10/10:** Excellent; better than baseline expectation
- **9/10:** Excellent with minor cosmetic improvement opportunity
- **8/10:** Meets bar; ready to ship
- **7/10:** One known gap; document and ship-with-caveat
- **6/10 or lower:** NOT shippable; fix before completing phase

A feature scoring < 8 on ANY dimension is NOT complete. The implementation log must list specific deficiencies and the plan to address.

### Scoring example template
```
Feature: Axiomera Engine (shadow mode)
1. Functional correctness: 9/10 — produces valid R/S/E/WC scores; one known issue with WC for ISCO_2 = 7
2. Build/test/lint clean: 10/10
3. Type safety: 9/10 — one `any` in legacy adapter; documented
4. Error handling: 8/10 — Claude timeout handled; rate-limit handling needs work
5. Loading/empty states: 8/10
6. i18n compliance: 8/10 — admin comparison page strings keyed
7. Accessibility: 7/10 — comparison table needs aria-labels — FIX before complete
8. Test coverage: 9/10 — 12 unit tests, 1 Playwright
9. Cost awareness: 10/10 — every call logged
10. Documentation: 9/10
Average: 8.7/10
Status: One dimension < 8 (accessibility). Fix required before phase complete.
```

---

## §4 — Golden test set

10 sample JDs, hand-curated, used as a regression baseline for every scoring engine change.

| Golden | Persona | Notes |
|--------|---------|-------|
| G-01 | Junior software developer | Edu=4 (Bachelor), Exp=1 (<1y), TSD short. Expected R-zone: 1-2. |
| G-02 | Senior data engineer | Edu=4-5, Exp=4 (7-15y). Expected R-zone: 3-4. |
| G-03 | Manager, 8 reports | Mid R, mid E. Expected R-zone: 5-6. |
| G-04 | VP, P&L responsibility | High R, function-strategy. Expected R-zone: 7. |
| G-05 | Senior specialist (no people mgmt) | High S, mid R, high COG-E. |
| G-06 | C-suite executive | R-zone 8-9, multiple functions. |
| G-07 | Ambiguous / underspecified JD | Should trigger UNKNOWN flags + low confidence |
| G-08 | Poorly written JD (vague, jargon) | Low language score; bias scan should flag |
| G-09 | Biased JD ("rockstar ninja", age-coded language) | Bias scan high severity |
| G-10 | Physical/manual role (forklift operator) | High WC, high PHY-E |

For each golden:
- Expected: R-zone range, S level range, E score range, WC level, total grade
- 16-criterion expected: overall completeness range, criterion statuses
- Each engine change must NOT regress these expected ranges

Files: `apps/web/tests/golden/{G-01..G-10}.jd.json` plus `apps/web/tests/golden/expectations.ts`.

---

## §5 — Cost regression test

For each engine change, run the full audit (analyse + 16-criterion + Axiomera + JDQ + bias) on G-01 through G-10 with a deterministic mock Claude (returns fixture responses). Verify:
- Every operation logged to `AiUsageLog`
- Total `estimatedCostUsd` per JD is within ±10% of baseline
- No operation called more times than expected

---

## §6 — Smoke test runtime budget

Total Playwright smoke suite: target < 5 minutes wall-clock on CI.

If a phase adds tests that push runtime over budget:
- Move some to a "slow" suite that runs nightly, not on PR
- Parallelize tests
- Reduce test data setup overhead

---

## §7 — Reviewer signoff procedure

For each phase:
1. Engineer (Claude or human dev) marks phase complete in [01-implementation-log.md](01-implementation-log.md)
2. Engineer fills the per-feature scoring template (this doc §3) for each feature in the phase
3. Engineer runs gates G-1 through G-16 and pastes pass/fail summary into log
4. Reviewer (Tomasz) reviews:
   - Implementation log
   - Acceptance scores
   - Smoke test output
   - Manual UI walkthrough (5-10 min) on `localhost:3000`
5. Reviewer signs off OR returns with specific feedback

No phase advances without explicit signoff.

---

## §8 — When a gate fails

1. Stop. Do not proceed to next phase.
2. Log the failure in [01-implementation-log.md](01-implementation-log.md) with `[GATE-FAIL]` tag.
3. Diagnose root cause.
4. Fix.
5. Re-run gate.
6. Continue.

Common fixes:
- Type errors after schema migration: regenerate Prisma client (`pnpm db:generate`)
- Missing translation key: add to all 9 locale files
- Smoke test flake: increase timeout OR fix race condition (do not skip)
- Cost over budget: cache more aggressively OR move to cheaper model tier

---

## §9 — UAT phases

After Phase 6 ship-readiness:

1. **Internal UAT** — Quadrance team (you) tests all features end-to-end on staging
2. **Pilot client UAT** — One willing client uses Ultra in parallel with Pro for 2 weeks
3. **Production rollout** — Per-org opt-in via admin setting; both URLs (Pro + Ultra) live for 30 days
4. **Pro deprecation** — After 30 days of stable Ultra usage, Pro URL becomes archive-mode (read-only)
