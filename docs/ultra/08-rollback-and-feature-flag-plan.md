# 08 — Rollback and Feature-Flag Plan

Ultra MUST be safely rollback-able at every level (repo, branch, flag, schema, data). This document defines the mechanisms.

---

## §1 — Rollback tiers

| Tier | Mechanism | Recovery time | When to use |
|------|-----------|---------------|-------------|
| **T0 — Repo** | `jd-suite-pro` is untouched on disk; `jd-suite-ultra` is independent. Vercel/host can deploy either repo. | Immediate | Catastrophic failure of Ultra in production |
| **T1 — Branch** | Each phase has a branch (`ultra-phase-0`, `ultra-phase-1`, ...). Reverting to previous phase = `git switch`. | < 5 min | A phase introduces regressions discovered after merge |
| **T2 — Feature flag** | Each migrated feature gated by `ENABLE_*` env var; default OFF. | Immediate (edit env, redeploy) | A specific feature misbehaves; toggle off without losing other progress |
| **T3 — Shadow mode** | New engines (Axiomera, JDQ) run alongside legacy engines. User sees legacy output by default. | N/A | Validate new engines without affecting users |
| **T4 — Schema** | Prisma additions are additive; legacy tables/columns never dropped. | N/A — old data still readable | Not really a rollback — just non-destructive design |
| **T5 — Data migration** | Production data migration is its own phase, gated separately. Reversible by re-importing from Pro Max if needed. | Hours | Data corruption discovered post-migration |

---

## §2 — Feature flags master list

All flags follow naming convention `ENABLE_*` (server-side) and `NEXT_PUBLIC_ENABLE_*` (client-side mirror, only when needed).

| Flag | Default | Phase introduced | Controls |
|------|---------|------------------|----------|
| `ENABLE_AXIOMERA_ENGINE` | `false` | 1 | Axiomera RSE+WC scoring engine, API routes, admin shadow view |
| `ENABLE_AXIOMERA_SHADOW_MODE` | `true` (when AXIOMERA_ENGINE on) | 1 | When ON, Axiomera output visible only to admin; user sees 16-criterion |
| `ENABLE_JDQ_LAYER` | `false` | 1 | JDQ quality layer (language scoring, edge-case codes, R+E evidence) |
| `ENABLE_R_E_HYPOTHESES_PANEL` | `false` | 1 | R+E hypothesis evidence panel UI |
| `ENABLE_SEALED_PROGRAMS` | `false` | 2 | Program creation/sealing UI + API |
| `ENABLE_APPROVAL_WORKFLOW` | `false` | 2 | Multi-stage approval + ApprovalRecord; preserves JDStatus simple flow when off |
| `ENABLE_KRYSTYNA_RENAME` | `false` | 2 | UI label "Krystyna" replaces "Companion" / "AI Assistant" |
| `ENABLE_PPTX_EXPORT` | `false` | 3 | PPTX option in export dialog |
| `ENABLE_INTAKE_CHECKLIST` | `false` | 3 | Project Intake module |
| `ENABLE_JD_PROJECT_READINESS` | `false` | 3 | JD Project Readiness scoring (separate from EUPTD) |
| `ENABLE_METHOD_MATRIX` | `false` | 4 | Reference page for evaluation methods |
| `ENABLE_SPEC_DASHBOARD` | `false` | 4 | Methodology spec reference |
| `ENABLE_FAMILY_DIAGNOSTICS` | `false` | 4 | Family fit diagnostics integrated into architecture |
| `ENABLE_INTERNAL_REGULATIONS` | `false` | 5 | Internal Regulations module |
| `ENABLE_COST_DASHBOARD` | `false` | 6 | AI cost dashboard route |
| `ENABLE_AI_RESPONSE_CACHE` | `false` | 6 | Caching layer for AI responses |

**All-flags-off rule:** When every flag is `false`, Ultra MUST behave identically to the underlying Pro snapshot from which it was forked. This is the primary safety invariant.

---

## §3 — Flag implementation

### Server-side
```typescript
// apps/web/lib/feature-flags.ts
export const FLAGS = {
  AXIOMERA_ENGINE: process.env.ENABLE_AXIOMERA_ENGINE === 'true',
  AXIOMERA_SHADOW_MODE: process.env.ENABLE_AXIOMERA_SHADOW_MODE !== 'false', // default true
  JDQ_LAYER: process.env.ENABLE_JDQ_LAYER === 'true',
  R_E_HYPOTHESES_PANEL: process.env.ENABLE_R_E_HYPOTHESES_PANEL === 'true',
  SEALED_PROGRAMS: process.env.ENABLE_SEALED_PROGRAMS === 'true',
  APPROVAL_WORKFLOW: process.env.ENABLE_APPROVAL_WORKFLOW === 'true',
  KRYSTYNA_RENAME: process.env.ENABLE_KRYSTYNA_RENAME === 'true',
  PPTX_EXPORT: process.env.ENABLE_PPTX_EXPORT === 'true',
  INTAKE_CHECKLIST: process.env.ENABLE_INTAKE_CHECKLIST === 'true',
  JD_PROJECT_READINESS: process.env.ENABLE_JD_PROJECT_READINESS === 'true',
  METHOD_MATRIX: process.env.ENABLE_METHOD_MATRIX === 'true',
  SPEC_DASHBOARD: process.env.ENABLE_SPEC_DASHBOARD === 'true',
  FAMILY_DIAGNOSTICS: process.env.ENABLE_FAMILY_DIAGNOSTICS === 'true',
  INTERNAL_REGULATIONS: process.env.ENABLE_INTERNAL_REGULATIONS === 'true',
  COST_DASHBOARD: process.env.ENABLE_COST_DASHBOARD === 'true',
  AI_RESPONSE_CACHE: process.env.ENABLE_AI_RESPONSE_CACHE === 'true',
} as const;
```

### Usage pattern in routes
```typescript
// apps/web/app/api/jd/[id]/axiomera/route.ts
import { FLAGS } from '@/lib/feature-flags';
export async function POST(req, { params }) {
  if (!FLAGS.AXIOMERA_ENGINE) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 404 });
  }
  // ... real logic
}
```

### Usage pattern in pages
```typescript
import { FLAGS } from '@/lib/feature-flags';
export default async function Page() {
  if (!FLAGS.INTAKE_CHECKLIST) {
    notFound();
  }
  // ...
}
```

### Client-side mirror (only where UI must conditionally show/hide)
```typescript
// next.config.ts — expose to client
env: {
  NEXT_PUBLIC_ENABLE_KRYSTYNA_RENAME: process.env.ENABLE_KRYSTYNA_RENAME ?? 'false',
}
```

---

## §4 — Shadow mode design

### Purpose
Run Axiomera/JDQ on a JD without affecting user-visible output. Compare against legacy engines. Only admins see shadow results.

### Behavior matrix

| `ENABLE_AXIOMERA_ENGINE` | `ENABLE_AXIOMERA_SHADOW_MODE` | What happens |
|--------------------------|-------------------------------|--------------|
| `false` | (any) | Axiomera not available. Existing 16-criterion is the only engine. |
| `true` | `true` | When user clicks "Evaluate", 16-criterion runs normally. Axiomera ALSO runs (async if possible) and stores result. User UI shows 16-criterion only. Admin UI shows both side-by-side with delta highlighted. |
| `true` | `false` | Axiomera runs and is shown to user as primary. 16-criterion still runs as comparison. UI labels both clearly. |

### Storage
Both engines write to their own tables:
- `EvalResult` (16-criterion) — already exists
- `AxiomeraRun` (new) — Phase 1
- `JdqRun` (new) — Phase 1

Querying both:
```typescript
const [legacy, axiomera] = await Promise.all([
  db.evalResult.findMany({ where: { jdId } }),
  db.axiomeraRun.findMany({ where: { jdId } }),
]);
```

### Admin comparison UI
Path: `/admin/jds/[id]/comparison` (Phase 1, gated by `AXIOMERA_ENGINE`)
Shows:
- 16-criterion overall score
- Axiomera grade + R/S/E/WC breakdown
- Delta analysis ("Why these differ" — auto-generated commentary)

---

## §5 — Schema rollback rules

### Additive-only principle
Phase 1 schema migration:
- ADD: `AxiomeraRun`, `AxiomeraCriterionScore`, `AxiomeraValidationGate`, `JdqRun`, `RHypothesisRecord`, `EHypothesisRecord`, `RZoneEstimate`, `EScoreSummary`, `JdqProgram`, `JdqProgramVersion`, `ApprovalRecord`, `AiUsageLog`, `IntakeSession`, `ReadinessScore`
- DO NOT MODIFY: `JobDescription`, `JDVersion`, `EvalResult`, `JDStatus` enum, any existing field
- DO NOT DROP: any existing column or model

### Forward migration
```bash
pnpm --filter @jd-suite/db prisma migrate dev --name "phase1-axiomera-jdq-additions"
```

### Backward "rollback"
Reverting Prisma migrations cleanly is painful in production. Strategy: **don't roll back schema**. Instead, drop unused tables in a future migration if Ultra is abandoned. Existing data in legacy tables remains readable.

If a Prisma migration fails mid-deploy:
1. Stop deploy
2. `prisma migrate resolve --rolled-back <migration-name>` to mark it
3. Fix the migration file
4. Re-run

### Schema rollback drill (Phase 1 acceptance)
Before merging Phase 1, run:
```bash
git switch ultra-phase-0   # before migration
pnpm install
pnpm --filter @jd-suite/db prisma migrate dev   # only baseline migrations apply
pnpm typecheck    # passes
pnpm test         # passes (excluding new tests)
```

This proves: if we revert Ultra to Phase 0, the codebase + DB still work.

---

## §6 — Vercel deployment rollback

### Setup
- Pro and Ultra have separate Vercel projects
- Pro stays deployed at original URL (e.g., `jd-suite-pro.vercel.app`)
- Ultra deploys to new URL (e.g., `jd-suite-ultra.vercel.app`)
- DNS flip is the production switchover trigger

### Rollback procedure if Ultra fails in production
1. **Immediate:** Toggle problematic feature flag OFF in Vercel env. Redeploy (~ 2 min).
2. **If multiple flags involved:** Set ALL `ENABLE_*` flags to `false`. Ultra now matches Pro behavior.
3. **If platform-level failure:** DNS flip back to Pro URL. Recovery time = DNS TTL (typically < 5 min).
4. **If data corruption suspected:** Stop traffic to Ultra. Investigate with read-only query. Restore from Neon backup.

### Vercel CLI HOME link trap (per memory)
When deploying Ultra, ALWAYS verify `~/.vercel/project.json` does not get rewritten by linking from a HOME subdir. After deploy, verify the returned production URL matches the expected project (`jd-suite-ultra` not `jd-suite-pro`).

---

## §7 — Acceptance tests for rollback safety

| Test | Pass criteria |
|------|---------------|
| RB-T1 | With ALL flags off, Ultra behaves identically to Pro on smoke tests (login, create JD, edit, evaluate, sonification). |
| RB-T2 | Set `ENABLE_AXIOMERA_ENGINE=false` after running Axiomera audits on 5 JDs. Verify: 16-criterion still works, Axiomera UI hidden, data preserved in `AxiomeraRun` table (no orphan errors). |
| RB-T3 | Run Phase 1 migration. Then revert to `ultra-phase-0` branch and re-run typecheck + smoke tests. All pass. (Schema migration not rolled back, but legacy code still works against extended schema.) |
| RB-T4 | Toggle `ENABLE_KRYSTYNA_RENAME` mid-session. Refresh. UI updates correctly. |
| RB-T5 | Force a Claude API outage (mock 503). Verify: AI calls log status='error' with errorMessage; UI shows graceful fallback; Ultra doesn't crash. |
