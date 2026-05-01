# 07 — AI Cost Model

Ultra adds AI-heavy engines (Axiomera, JDQ, Krystyna conversations, regulation extraction). Without cost tracking, a 1000-JD batch could surprise the user with hundreds of dollars in API charges. This document defines the cost model, the pricing registry, the central AI wrapper, and the future Cost Dashboard.

**Phase 1 deliverable:** Minimal `AiUsageLog` Prisma model + central `callAi(operation, ...)` wrapper that logs every call. No pricing registry yet — that's Phase 2.

---

## §1 — Operations registry

Every AI call goes through one of these operations. Each operation has a fixed name (string) and a default model tier.

| Operation key | Purpose | Default tier | Token shape (typical) |
|---------------|---------|--------------|------------------------|
| `jd.analyse` | Extract fields + DQS/ERS from raw JD text | sonnet | in 2k–4k / out 1k |
| `jd.evaluate.16criterion` | Run 16-criterion evaluation | sonnet | in 3k / out 2k |
| `jd.evaluate.axiomera` | Run Axiomera R+S+E+WC scoring (composite call or per-dim) | opus | in 3k / out 1.5k |
| `jd.jdq.extractR` | Extract R-hypothesis activations | sonnet | in 2k / out 800 |
| `jd.jdq.extractE` | Extract E-hypothesis activations | sonnet | in 2k / out 1.2k |
| `jd.jdq.languageScore` | (deterministic — NO AI; tracked for completeness with `model='deterministic'`) | n/a | 0 / 0 |
| `jd.honestReview` | Honest-review verdict | sonnet | in 2k / out 1k |
| `jd.sonicReview` | Sonic review issues | sonnet | in 2k / out 1.5k |
| `jd.testHypotheses` | 56-hypothesis Axiomera/PRISM panel | sonnet | in 3k / out 2k |
| `jd.payGroups.suggest` | AI pay group suggestions | sonnet | in 4k / out 2k |
| `jd.improve.rewrite` | Rewrite JD in 5 modes | sonnet | in 3k / out 2k per mode |
| `jd.generateField` | Draft single field | haiku | in 2k / out 600 |
| `jd.endSession.summary` | End-of-session summary | haiku | in 2k / out 800 |
| `jd.lint` | Heuristic + AI linting | haiku | in 1.5k / out 500 |
| `jd.bias.scan` | Bias detection | sonnet | in 2k / out 1k |
| `companion.message` | Krystyna conversational turn | sonnet | varies; in 1–8k / out 0.5–1.5k |
| `regulation.extract.chunks` | Chunk regulation into sections | sonnet | in 6k / out 3k |
| `regulation.extract.tags` | Tag regulation chunks by topic | haiku | in 1k / out 300 per chunk |
| `regulation.embed` | Embed regulation chunk | embedding-small | per chunk |
| `regulation.suggestForJd` | Suggest regulations relevant to a JD | sonnet | in 3k / out 1k |
| `report.generateSummary` | Build executive summary for PPTX | sonnet | in 4k / out 2k |
| `sonic.diff` (Pro Max — only if revived) | Spoken vs written reconciliation | sonnet | in 4k / out 2k |

---

## §2 — Model registry (configurable, not hardcoded)

Stored in `apps/web/lib/ai/model-registry.ts` (or a config file in `packages/db/seed-data/` for DB-backed flexibility).

```typescript
// apps/web/lib/ai/model-registry.ts
export type ModelTier = 'haiku' | 'sonnet' | 'opus' | 'embedding-small' | 'embedding-large' | 'deterministic';

export interface ModelEntry {
  tier: ModelTier;
  modelId: string;          // e.g., 'claude-haiku-4-5-20251001'
  pricePerMTokensIn: number; // USD per 1M input tokens — UPDATE THESE QUARTERLY
  pricePerMTokensOut: number;
  pricePerMEmbedding?: number;
  effectiveFrom: string;    // ISO date, for audit trail
  notes?: string;
}

// EFFECTIVE 2026-05-01 — VERIFY AND UPDATE QUARTERLY
// Source: https://docs.claude.com/en/docs/build-with-claude/pricing
// (Manual update: read current pricing, replace numbers, bump effectiveFrom)
export const MODEL_REGISTRY: Record<ModelTier, ModelEntry> = {
  haiku: {
    tier: 'haiku',
    modelId: 'claude-haiku-4-5-20251001',
    pricePerMTokensIn: 1.0,    // PLACEHOLDER — verify
    pricePerMTokensOut: 5.0,
    effectiveFrom: '2026-05-01',
  },
  sonnet: {
    tier: 'sonnet',
    modelId: 'claude-sonnet-4-6',
    pricePerMTokensIn: 3.0,
    pricePerMTokensOut: 15.0,
    effectiveFrom: '2026-05-01',
  },
  opus: {
    tier: 'opus',
    modelId: 'claude-opus-4-6',
    pricePerMTokensIn: 15.0,
    pricePerMTokensOut: 75.0,
    effectiveFrom: '2026-05-01',
  },
  'embedding-small': {
    tier: 'embedding-small',
    modelId: 'text-embedding-3-small',
    pricePerMTokensIn: 0.02,
    pricePerMTokensOut: 0,
    pricePerMEmbedding: 0.02,
    effectiveFrom: '2026-05-01',
  },
  'embedding-large': {
    tier: 'embedding-large',
    modelId: 'text-embedding-3-large',
    pricePerMTokensIn: 0.13,
    pricePerMTokensOut: 0,
    pricePerMEmbedding: 0.13,
    effectiveFrom: '2026-05-01',
  },
  deterministic: {
    tier: 'deterministic',
    modelId: 'none',
    pricePerMTokensIn: 0,
    pricePerMTokensOut: 0,
    effectiveFrom: '2026-05-01',
    notes: 'Used for non-AI operations tracked for completeness',
  },
};
```

**Rule:** every quarter, an admin reviews and updates `MODEL_REGISTRY` with current Anthropic / OpenAI prices. The `effectiveFrom` field provides an audit trail. Old logged usage retains the price-at-time-of-call (stored in `AiUsageLog.estimatedCostUsd`), so historical cost reports remain accurate even after price updates.

---

## §3 — Prompt version registry

Each prompt has a version. Bumping the prompt requires bumping the version. The `AiUsageLog.promptVersion` lets us re-run regression tests against a specific prompt + model combo.

```typescript
// apps/web/lib/ai/prompt-versions.ts
export const PROMPT_VERSIONS: Record<string, string> = {
  'jd.analyse': 'v1.0.0',
  'jd.evaluate.16criterion': 'v1.0.0',
  'jd.evaluate.axiomera': 'v1.0.0',
  'jd.jdq.extractR': 'v1.0.0',
  'jd.jdq.extractE': 'v1.0.0',
  'companion.message': 'v1.2.0',
  // ...
};
```

When a prompt changes, bump the version. Golden tests pinned to a version still pass.

---

## §4 — `AiUsageLog` Prisma model

```prisma
model AiUsageLog {
  id                  String   @id @default(uuid())
  operation           String   // e.g. "jd.evaluate.axiomera"
  modelId             String   // e.g. "claude-sonnet-4-6"
  modelTier           String   // "sonnet"
  promptVersion       String   // "v1.0.0"
  orgId               String?
  userId              String?
  jdId                String?
  programId           String?  // for JDQ runs
  inputTokensEstimate Int?     // estimated before call (tiktoken-style)
  inputTokensActual   Int?     // from API response if provided
  outputTokensEstimate Int?
  outputTokensActual  Int?
  estimatedCostUsd    Decimal  @db.Decimal(10, 6)
  actualCostUsd       Decimal? @db.Decimal(10, 6)
  cacheStatus         String   // "hit" | "miss" | "n/a"
  cacheKey            String?
  durationMs          Int?
  status              String   // "ok" | "error" | "timeout" | "rate_limited"
  errorMessage        String?
  createdAt           DateTime @default(now())

  @@index([orgId, createdAt])
  @@index([operation, createdAt])
  @@index([userId])
  @@index([jdId])
  @@map("ai_usage_log")
}
```

Inserted on every `callAi()` invocation. Failed calls also logged (status="error") so we know when retries inflate cost.

---

## §5 — Central wrapper: `callAi()`

Phase 1 deliverable. New file: `apps/web/lib/ai/call-ai.ts`.

```typescript
// apps/web/lib/ai/call-ai.ts
import { db } from '@jd-suite/db';
import { MODEL_REGISTRY, type ModelTier } from './model-registry';
import { PROMPT_VERSIONS } from './prompt-versions';

export interface CallAiOptions {
  operation: string;            // e.g. "jd.evaluate.axiomera"
  tier?: ModelTier;             // override default
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  context?: {
    orgId?: string;
    userId?: string;
    jdId?: string;
    programId?: string;
  };
  cacheKey?: string;            // if provided, hit AiResponseCache first
}

export interface CallAiResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
  cacheStatus: 'hit' | 'miss' | 'n/a';
}

export async function callAi(opts: CallAiOptions): Promise<CallAiResult> {
  const start = Date.now();
  const tier = opts.tier ?? defaultTierFor(opts.operation);
  const model = MODEL_REGISTRY[tier];
  const promptVersion = PROMPT_VERSIONS[opts.operation] ?? 'v0.0.0';

  // Cache check
  if (opts.cacheKey) {
    const hit = await db.aiResponseCache.findUnique({ where: { cacheKey: opts.cacheKey } });
    if (hit) {
      await logUsage({ ...opts, model, promptVersion, cacheStatus: 'hit', durationMs: Date.now() - start, status: 'ok', tokensIn: 0, tokensOut: 0, costUsd: 0 });
      return { text: hit.responseText, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, durationMs: Date.now() - start, cacheStatus: 'hit' };
    }
  }

  // Estimate input tokens before call (rough: 4 chars / token)
  const inputTokensEstimate = Math.ceil((opts.systemPrompt.length + opts.userPrompt.length) / 4);

  // Call provider
  let response;
  try {
    response = await callAnthropicOrOpenAI(model.modelId, opts);
  } catch (e) {
    await logUsage({ ...opts, model, promptVersion, cacheStatus: 'miss', durationMs: Date.now() - start, status: 'error', errorMessage: String(e), tokensIn: inputTokensEstimate, tokensOut: 0, costUsd: estimateCost(model, inputTokensEstimate, 0) });
    throw e;
  }

  const inputActual = response.usage?.input_tokens ?? inputTokensEstimate;
  const outputActual = response.usage?.output_tokens ?? Math.ceil(response.text.length / 4);
  const cost = estimateCost(model, inputActual, outputActual);

  // Cache write
  if (opts.cacheKey) {
    await db.aiResponseCache.create({
      data: { cacheKey: opts.cacheKey, responseText: response.text, modelId: model.modelId, createdAt: new Date() },
    }).catch(() => {/* ignore unique violation */});
  }

  await logUsage({ ...opts, model, promptVersion, cacheStatus: opts.cacheKey ? 'miss' : 'n/a', durationMs: Date.now() - start, status: 'ok', tokensIn: inputActual, tokensOut: outputActual, costUsd: cost });

  return { text: response.text, inputTokens: inputActual, outputTokens: outputActual, estimatedCostUsd: cost, durationMs: Date.now() - start, cacheStatus: opts.cacheKey ? 'miss' : 'n/a' };
}

function estimateCost(model: ModelEntry, tokensIn: number, tokensOut: number): number {
  return (tokensIn / 1_000_000) * model.pricePerMTokensIn + (tokensOut / 1_000_000) * model.pricePerMTokensOut;
}
```

(`AiResponseCache` is an optional Phase 2+ table — not Phase 1.)

---

## §6 — Per-JD audit cost estimate

Cost of running the **full Axiomera audit** on one JD (assuming sonnet tier for all):

| Operation | Calls | Avg in tokens | Avg out tokens | Cost (USD) |
|-----------|-------|---------------|----------------|------------|
| `jd.analyse` | 1 | 3000 | 1000 | $0.024 |
| `jd.jdq.extractR` | 1 | 2000 | 800 | $0.018 |
| `jd.jdq.extractE` | 1 | 2000 | 1200 | $0.024 |
| `jd.jdq.languageScore` | 1 | 0 | 0 | $0 (deterministic) |
| `jd.evaluate.axiomera` (composite) | 1 | 3000 | 1500 | $0.0315 |
| `jd.testHypotheses` (56 hyp) | 1 | 3000 | 2000 | $0.039 |
| `jd.evaluate.16criterion` | 1 | 3000 | 2000 | $0.039 |
| `jd.honestReview` | 1 | 2000 | 1000 | $0.021 |
| `jd.bias.scan` | 1 | 2000 | 1000 | $0.021 |
| **Total per JD** | 9 | ~17k | ~10.5k | **~$0.218** |

Optional add-ons:
- `jd.improve.rewrite` × 5 modes = +$0.165
- `jd.sonicReview` = +$0.039
- `report.generateSummary` (PPTX) = +$0.042

### Batch projections (sonnet tier, full audit, no caching, no rewrites)

| JDs | Cost |
|-----|------|
| 1 | $0.22 |
| 10 | $2.18 |
| 100 | $21.80 |
| 1000 | **$218** |

With caching enabled (typical hit rate ~30% on re-runs without JD changes):
| JDs | Cost |
|-----|------|
| 1000 (first run) | $218 |
| 1000 (re-audit, 30% cache) | ~$153 |

### Tier optimization

If we move "easy" operations to haiku (`generateField`, `endSession`, `lint`):
- Haiku ~5× cheaper than sonnet for input, ~3× cheaper for output
- Saves ~20–30% on full audit cost

If we move opus to **only** the final composite Axiomera scoring (where stakes are highest):
- Opus call: $0.075 (vs $0.0315 sonnet) — 2.4× more expensive
- For 1000 JDs: +$43.50 total — small premium for the most defensibility-critical step

---

## §7 — Caching strategy

Cache key: `sha256(operation + promptVersion + modelId + sha256(jd.data))`.

- Cache hit when JD content is byte-identical and prompt + model version unchanged
- Default TTL: 90 days
- Invalidate on JD edit (delete cache entries with that jdId)
- Manual purge endpoint for admins

**Phase 1 implementation:** No caching layer. All calls are uncached. `AiResponseCache` model is documented but commented out in `schema.prisma`.

**Phase 2:** Implement caching for deterministic operations (R/E extraction).

---

## §8 — Cost Dashboard (Phase 6)

Route: `/admin/ai-cost` (gated by `ENABLE_COST_DASHBOARD`).

Tiles:
- Total cost (org, this month)
- Cost by feature (operation breakdown)
- Cost by JD (top 10 most expensive JDs)
- Cost by user (who is running the most operations)
- Forecast (extrapolation from last 7 days)
- Cache hit rate

Graphs:
- Daily cost timeseries
- Per-operation pie chart

Warnings:
- Banner when projected monthly cost > org-configured budget
- Pre-confirmation modal before any batch > 50 JDs ("Estimated cost: $X. Continue?")

---

## §9 — Phase scoping summary

| Phase | AI cost deliverable |
|-------|---------------------|
| Phase 1 | `AiUsageLog` model + `callAi()` wrapper. ALL existing AI routes (analyse, evaluate, honest-review, etc.) refactored to go through `callAi()`. No caching, no dashboard. Logs are insert-only. |
| Phase 2 | Migrate Pro Max methodology engines (Axiomera, JDQ) through `callAi()`. Pricing registry kept up to date. |
| Phase 3 | Per-org budget config (soft warnings). |
| Phase 6 | `AiResponseCache` model + caching. Cost Dashboard UI. Pre-batch confirmation. |

---

## §10 — Acceptance tests

| Test | Pass criteria |
|------|---------------|
| AC-T1 | After Phase 1, every existing AI route writes one row to `AiUsageLog` per call. |
| AC-T2 | Failed calls log status='error' with errorMessage. |
| AC-T3 | `estimatedCostUsd` is non-zero for sonnet calls and zero for `tier='deterministic'`. |
| AC-T4 | Updating `MODEL_REGISTRY` does NOT change `actualCostUsd` on historical rows. |
| AC-T5 | Running an Axiomera audit on a 500-word JD produces total log spend < $0.30. |
