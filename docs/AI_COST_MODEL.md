# JD Suite Ultra — AI Cost Model

> Last updated: 2026-05-10
> All prices in USD. Prices sourced from Anthropic pricing page, effective 2026-05-01.

---

## Model Registry

All AI calls go through `lib/ai/call-ai.ts → callAi()`. Model selection is determined by operation name via `MODEL_REGISTRY`.

### Registered Models

| Tier | Model ID | Input ($/M tokens) | Output ($/M tokens) | Use Case |
|------|----------|--------------------|---------------------|----------|
| `haiku` | claude-haiku-4-5-20251001 | $1.00 | $5.00 | Fast, cheap: field generation, linting, session summaries |
| `sonnet` | claude-sonnet-4-6 | $3.00 | $15.00 | Default: analysis, evaluation, bias scan, Axiomera |
| `opus` | claude-opus-4-6 | $15.00 | $75.00 | Reserved for highest-complexity operations |
| `embedding-small` | text-embedding-3-small | $0.02 | $0 | ⚠️ NOT IMPLEMENTED — no OpenAI provider |
| `embedding-large` | text-embedding-3-large | $0.13 | $0 | ⚠️ NOT IMPLEMENTED — no OpenAI provider |
| `deterministic` | none | $0 | $0 | Non-AI operations (composite scoring, exports) |

### Operation → Model Mapping

| Operation | Tier | Estimated Tokens (in/out) | Estimated Cost/Call |
|-----------|------|--------------------------|---------------------|
| `jd.analyse` | sonnet | 3000/2000 | ~$0.039 |
| `jd.evaluate.16criterion` | sonnet | 5000/3000 | ~$0.060 |
| `jd.axiomera.extractR` | sonnet | 6000/4000 | ~$0.078 |
| `jd.axiomera.extractE` | sonnet | 8000/6000 | ~$0.114 |
| `jd.honestReview` | sonnet | 3000/2000 | ~$0.039 |
| `jd.bias.scan` | sonnet | 3000/1500 | ~$0.032 |
| `jd.generateField` | haiku | 800/300 | ~$0.0023 |
| `jd.lint` | haiku | 2000/500 | ~$0.0045 |
| `jd.endSession.summary` | haiku | 1500/500 | ~$0.0040 |
| `companion.message` | sonnet | 2000/1500 | ~$0.029 |
| `pmoa.build-org` | sonnet | 8000/4000 | ~$0.084 |
| `pmoa.build-processes` | sonnet | 6000/3000 | ~$0.063 |

### Full Axiomera Run Cost

A complete Axiomera run (extractR + extractE + composite) costs approximately:
- `jd.axiomera.extractR`: ~$0.078
- `jd.axiomera.extractE`: ~$0.114
- `jd.axiomera.composite`: $0 (deterministic)
- **Total per run: ~$0.19**

With MAX_RETRIES=2 on schema validation failures, worst-case cost per run is **~$0.57** (3× retries each call).

---

## AiUsageLog Schema

Every `callAi()` invocation (success or failure) inserts one row:

```prisma
model AiUsageLog {
  id                  String    @id @default(uuid())
  createdAt           DateTime  @default(now())
  operation           String    // e.g. 'jd.axiomera.extractR'
  promptVersion       String    // from prompt-versions.ts
  modelId             String    // actual model ID used
  modelTier           String    // 'haiku' | 'sonnet' | 'opus' | ...
  inputTokensEst      Int       // pre-call estimate (4 chars/token)
  inputTokensActual   Int?      // from API response usage
  outputTokensActual  Int?      // from API response usage
  estimatedCostUsd    Float     // computed at call time from registry
  cacheStatus         String    // 'hit' | 'miss' | 'n/a' | 'error'
  durationMs          Int
  // Context (partially populated)
  jdId                String?
  programId           String?
  // orgId MISSING — cannot attribute cost to tenant (known issue)
}
```

### Known Gaps in AiUsageLog

1. **No orgId** — cannot split cost by organisation
2. **No index on jdId** — per-JD cost queries are slow
3. **No partitioning** — table will grow unboundedly (see growth projections below)

### Cost Query Examples

```sql
-- Total spend last 30 days by operation
SELECT
  operation,
  "modelTier",
  COUNT(*)              as calls,
  SUM("estimatedCostUsd") as total_usd,
  AVG("durationMs")     as avg_ms,
  AVG("inputTokensActual")  as avg_tokens_in,
  AVG("outputTokensActual") as avg_tokens_out
FROM "AiUsageLog"
WHERE "createdAt" > NOW() - INTERVAL '30 days'
  AND "cacheStatus" != 'error'
GROUP BY operation, "modelTier"
ORDER BY total_usd DESC;

-- Failed calls (potential cost waste from retries)
SELECT operation, COUNT(*) as failures
FROM "AiUsageLog"
WHERE "cacheStatus" = 'error'
  AND "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY operation
ORDER BY failures DESC;

-- Cost per JD (requires jdId to be populated)
SELECT "jdId", SUM("estimatedCostUsd") as total_usd
FROM "AiUsageLog"
WHERE "jdId" IS NOT NULL
GROUP BY "jdId"
ORDER BY total_usd DESC
LIMIT 20;
```

---

## Cost Projections

### Per Organisation (medium usage)

| Activity | Frequency | Cost/Event | Monthly |
|----------|-----------|-----------|---------|
| Full JD analysis | 10/day | $0.039 | $11.70 |
| Axiomera run | 5/day | $0.19 | $28.50 |
| Bias scan | 5/day | $0.032 | $4.80 |
| Field generation | 20/day | $0.0023 | $1.38 |
| PMOA build-org | 2/day | $0.084 | $5.04 |
| **Total** | | | **~$51/month/org** |

### With Retry Overhead (if schema validation fails 30% of Axiomera runs)

Add ~30% to Axiomera line: $28.50 × 1.3 = $37.05/month/org.

### Scale: 50 active orgs

~$51 × 50 = **$2,550/month** in AI API costs (at medium usage).

---

## Cost Controls

### Current Controls
- All calls route through `callAi()` — no direct Anthropic SDK calls possible
- Every call logged to `AiUsageLog` — full audit trail
- `deterministic` tier costs $0 (composite scoring, exports)

### Recommended Additional Controls (not yet implemented)

1. **Per-org monthly budget cap**: Stop AI calls when `SUM(estimatedCostUsd) > org.aiBudgetUsd` for the current month
2. **Operation-level rate limiting**: e.g. max 5 Axiomera runs/JD/day
3. **Axiomera cost confirmation**: Show estimated cost to user before triggering run
4. **orgId on AiUsageLog**: Required for any per-org budget tracking

### Model Downgrade Strategy

If costs spike, downgrade specific operations without code changes:
```typescript
// model-registry.ts — temporarily downgrade Axiomera to haiku
'jd.axiomera.extractR': 'haiku',  // $1/$5 instead of $3/$15 → 3× cheaper
'jd.axiomera.extractE': 'haiku',  // Accuracy will degrade
```

---

## Prompt Version Registry

Prompt versions are tracked in `lib/ai/prompt-versions.ts`. Bump version when prompt changes to enable historical cost analysis by prompt generation.

| Operation | Current Version | Notes |
|-----------|----------------|-------|
| `jd.analyse` | v1.0.0 | |
| `jd.evaluate.16criterion` | v1.0.0 | |
| `jd.axiomera.extractR` | v1.0.0 | 19 R-hypotheses |
| `jd.axiomera.extractE` | v1.0.0 | 45 E-hypotheses |
| `jd.honestReview` | v1.0.0 | |
| `jd.bias.scan` | v1.0.0 | |
| `companion.message` | v1.0.0 | |

Query cost by prompt version:
```sql
SELECT "promptVersion", operation, AVG("estimatedCostUsd"), COUNT(*)
FROM "AiUsageLog"
GROUP BY "promptVersion", operation;
```

---

## Updating Prices

When Anthropic changes pricing:

1. Edit `lib/ai/model-registry.ts` → update `pricePerMTokensIn/Out` + bump `effectiveFrom`
2. Historical rows in `AiUsageLog` retain their original price — do not recompute
3. Add a comment noting the old vs new price:
```typescript
haiku: {
  // 2026-05-01: $1.00/$5.00 (was $0.25/$1.25 before 2026-04-01)
  pricePerMTokensIn: 1.0,
  pricePerMTokensOut: 5.0,
  effectiveFrom: '2026-05-01',
},
```
