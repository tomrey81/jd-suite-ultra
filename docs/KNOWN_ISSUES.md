# JD Suite Ultra — Known Issues & Technical Debt

> Last updated: 2026-05-10
> Source: Technical audit by Kimi K2 + Claude Sonnet 4.6

This file tracks known bugs, architectural risks, and tech debt items that need to be addressed. Items are ordered by priority.

---

## 🔴 CRITICAL — Fix Immediately

### KI-001: Embedding Tiers Will Fail Silently

**File**: `apps/web/lib/ai/model-registry.ts`

`embedding-small` and `embedding-large` tiers reference OpenAI model IDs (`text-embedding-3-small/large`). Only `callAnthropic()` is implemented — no OpenAI provider exists. Any call using these tiers will:
1. Send an OpenAI model ID to the Anthropic API
2. Receive a 400 error
3. Log an `AiUsageLog` row with `cacheStatus='error'`
4. Return empty string to caller with no useful error

**Fix**: Remove embedding tiers from the registry, or implement an OpenAI provider and add `OPENAI_API_KEY` to env vars.

```typescript
// Remove from MODEL_REGISTRY until implemented:
// 'embedding-small': { ... }
// 'embedding-large': { ... }
```

---

### KI-002: Admin Routes Not Enforced at Middleware Level

**File**: `apps/web/middleware.ts`

`/admin/*` and `/api/admin/*` paths pass through middleware if any valid session cookie is present — regardless of `isPlatformAdmin` status. A non-admin user with a valid session cookie can reach admin route handlers.

**Current mitigation**: Each admin route handler checks `isPlatformAdmin`. But a single missed check = privilege escalation.

**Fix options**:
1. Add `isPlatformAdmin` claim to JWT payload, then extract it in middleware without DB access for a fast (unsigned) first-pass check
2. Add a middleware route pattern for `/admin` that always redirects unless the claim is present

---

## 🟠 HIGH — Fix in Current Sprint

### KI-003: AiUsageLog Missing orgId

**File**: `packages/db/prisma/schema.prisma` → `AiUsageLog`

No `orgId` on `AiUsageLog`. Cost attribution per organisation is impossible. The planned `ENABLE_COST_DASHBOARD` feature (Phase 4) cannot function without this.

**Fix**:
```prisma
model AiUsageLog {
  orgId  String?
  org    Organisation? @relation(fields: [orgId], references: [id])
  jdId   String?       // also add this for per-JD cost
  @@index([orgId])
  @@index([jdId])
}
```
Migration: `pnpm db:migrate:dev --name add-org-jd-to-ai-usage-log`

---

### KI-004: maxTokens Default May Truncate Axiomera JSON

**File**: `apps/web/lib/ai/call-ai.ts`

Default `maxTokens = 3000`. Axiomera `extractE` returns JSON for 45 hypotheses with verbatim evidence quotes — easily exceeds 3000 tokens when the JD is detailed. Truncated JSON fails validation, triggering all MAX_RETRIES and tripling cost.

**Fix**:
```typescript
// In extract-e.ts:
const result = await callAi({
  operation: 'jd.axiomera.extractE',
  maxTokens: 12_000,  // ← explicit override
  ...
});

// In extract-r.ts:
maxTokens: 8_000,
```

---

### KI-005: No Retry on Transient Anthropic HTTP Errors

**File**: `apps/web/lib/ai/call-ai.ts`

`callAi()` has zero retry logic for HTTP 429 (rate limit) and 529 (overloaded) responses. The `MAX_RETRIES=2` in `extract-r.ts` / `extract-e.ts` only retries on _JSON schema validation_ failure, not on network/HTTP errors.

**Fix**: Add exponential backoff retry in `callAnthropic()`:
```typescript
const RETRYABLE = new Set([429, 529]);
let delay = 1000;
for (let attempt = 0; attempt <= 3; attempt++) {
  const res = await fetch(ANTHROPIC_URL, { ... });
  if (res.ok) return parseResponse(res);
  if (RETRYABLE.has(res.status) && attempt < 3) {
    await new Promise(r => setTimeout(r, delay));
    delay *= 2;
    continue;
  }
  throw new Error(`Claude API ${res.status}: ${await res.text()}`);
}
```

---

### KI-006: No Per-Call Timeout on Axiomera Functions

**File**: `apps/web/lib/axiomera/extract-r.ts`, `extract-e.ts`

No `AbortController` / timeout. Axiomera runs two Claude calls sequentially. On slow API responses (20–40s each), total duration can exceed Vercel's 60-second function timeout, causing the HTTP request to fail with no useful error.

**Fix**:
```typescript
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 50_000); // 50s guard
try {
  const res = await fetch(ANTHROPIC_URL, { signal: controller.signal, ... });
} finally {
  clearTimeout(timer);
}
```

---

### KI-007: RateLimitBucket.key Has No Unique Constraint

**File**: `packages/db/prisma/schema.prisma` → `RateLimitBucket`

Without `@unique` on `key`, concurrent login requests from the same IP can create multiple bucket rows, each with count=1, bypassing the rate limit.

**Fix**:
```prisma
model RateLimitBucket {
  key     String   @unique
  count   Int      @default(0)
  resetAt DateTime
  @@map("rate_limit_buckets")
}
```
Migration: `pnpm db:migrate:dev --name add-unique-rate-limit-bucket-key`

---

### KI-008: No Rate Limit on Password Reset Endpoint

**File**: `apps/web/app/api/auth/forgot-password/route.ts`

`POST /api/auth/forgot-password` can be called repeatedly with any email, generating unlimited `AuthToken` rows and potentially spamming any user's inbox.

**Fix**: Add rate limiting at the route handler:
```typescript
const rl = await checkRateLimit(`reset:email:${email}`, 3, 15 * 60 * 1000);
if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
const ipRl = await checkRateLimit(`reset:ip:${ip}`, 10, 15 * 60 * 1000);
if (!ipRl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
```

---

## 🟡 MEDIUM — Fix in Next Sprint

### KI-009: ImportedJobPosting.contentHash Not Indexed

**File**: `packages/db/prisma/schema.prisma`

Deduplication uses `contentHash` lookup but no index exists. Full table scan on every import.

**Fix**:
```prisma
model ImportedJobPosting {
  @@index([contentHash])
  @@index([sourceRunId])
}
```

---

### KI-010: JWT Sessions Have No Revocation Mechanism

**File**: `apps/web/lib/auth.ts`

7-day JWT sessions cannot be invalidated server-side. Role changes (e.g. demoting `isPlatformAdmin`) take up to 7 days to propagate.

**Fix options**:
1. Shorten JWT expiry to 1 hour + implement refresh token pattern
2. Add a `SessionRevocation` table with a blocklist of `jti` (JWT ID) values, checked in `auth()` callback
3. Add `jti` claim to JWT and check DB on each sensitive operation

---

### KI-011: JD `data` JSON Has No Schema Enforcement

**File**: `packages/db/prisma/schema.prisma` → `JobDescription.data`

All field values in a JD are in a single `Json` column. No field-level indexing, no partial update capability, no DB-level validation.

**Impact**: Cannot query "all JDs where jobTitle contains 'Engineer'" without expensive JSON operators.

**Fix** (long-term): Migrate to a `JDField` table:
```prisma
model JDField {
  id      String @id @default(uuid())
  jdId    String
  fieldId String
  value   String?
  @@index([jdId, fieldId])
}
```

---

### KI-012: AiUsageLog Will Grow Unboundedly

**File**: `packages/db/prisma/schema.prisma` → `AiUsageLog`

No archiving, TTL, or partitioning strategy. Projected growth: 1M+ rows/year at 50 orgs.

**Fix options**:
1. Add Vercel Cron to archive rows older than 90 days to `AiUsageLogArchive`
2. Enable PostgreSQL table partitioning by `createdAt` (monthly partitions)
3. Add Neon autoscaling threshold alerts

---

### KI-013: ciGlobal Excludes S Confidence

**File**: `apps/web/lib/axiomera/compose.ts`

`ciGlobal = 0.65 * ci_R + 0.35 * ci_E` — Skills (S) confidence is not included. When S source is `isco_median` (population fallback), confidence is effectively assumed perfect.

**Fix**: When `sSource === 'isco_median'`, assign `ci_S = 0.40` (low) and revise formula:
```typescript
export function computeCiGlobal(ci_R: number, ci_E: number, ci_S: number): number {
  return AXIOMERA_RSE_WEIGHTS.R * ci_R + AXIOMERA_RSE_WEIGHTS.S * ci_S + AXIOMERA_RSE_WEIGHTS.E * ci_E;
}
```

---

### KI-014: Band Clamping Silently Masks Zero-Grade JDs

**File**: `apps/web/lib/axiomera/compose.ts`

Grade of 0 (thin/empty JD) returns `A1` — same as a genuine entry-level role. No warning emitted.

**Fix**: Add early exit in `AxiomeraRun`:
```typescript
if (grade < 3) {
  // grade < 3 means R+S+E < 150 pts — likely an empty or nonsense JD
  return { ...result, band: 'A1', needsReview: true, contradictionFlag: true };
}
```

---

### KI-015: Expired Tokens Not Cleaned Up

Tables `GuestToken` and `AuthToken` accumulate expired rows with no cleanup.

**Fix**: Vercel Cron at `0 3 * * *` → `POST /api/cron/cleanup-tokens`:
```typescript
await db.guestToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
await db.authToken.deleteMany({ where: { expiresAt: { lt: new Date() }, usedAt: { not: null } } });
await db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
```

---

## 🟢 LOW — Backlog

### KI-016: Photo Table Is Undocumented Legacy

Add schema comment:
```prisma
/// DEPRECATED — legacy from pre-Ultra prototype. No active usage. Do not query.
model Photo { ... }
```

### KI-017: JDVersion.changeType Should Be a DB Enum

Currently a plain `String`. Convert to Prisma `enum` to prevent invalid values.

### KI-018: PmoaDocument Has No File Size Limit

Large PDF/DOCX uploads can exhaust Vercel Function memory. Add size check at upload:
```typescript
if (file.size > 10 * 1024 * 1024) { // 10MB limit
  return NextResponse.json({ error: 'File too large' }, { status: 413 });
}
```

### KI-019: BatchExport.jdIds Has No FK Constraint

Stores raw JSON array of JD IDs. Deleted JDs leave dangling references. Add cleanup on JD deletion.

### KI-020: Sensitivity Weights Not Wired to Any UI

`SENSITIVITY_EFFORT_BOOSTED` (45/25/30) is defined but never used. Wire to Axiomera run API as optional parameter or remove to reduce confusion.

---

## Issue Tracker Summary

| ID | Severity | Area | Status |
|----|----------|------|--------|
| KI-001 | CRITICAL | AI Provider | ✅ Fixed — guard in callAnthropic() + regulation.embed rerouted |
| KI-002 | CRITICAL | Security | ✅ Fixed — admin fast-check added to middleware.ts |
| KI-003 | HIGH | DB Schema | ✅ Already fixed — orgId/userId/jdId present in schema |
| KI-004 | HIGH | AI Tokens | ✅ Already fixed — extractR=4096, extractE=6144; default raised to 4096 |
| KI-005 | HIGH | AI Reliability | ✅ Fixed — retry with exp. backoff for 429/529 in callAnthropic() |
| KI-006 | HIGH | Timeouts | ✅ Fixed — AbortController 50s guard in callAnthropic() |
| KI-007 | HIGH | Rate Limiting | ✅ Already fixed — RateLimitBucket.key uses @id (PK = unique) |
| KI-008 | HIGH | Auth Security | ✅ Already fixed — forgot-password has checkRateLimit (5/hr/IP) |
| KI-009 | MEDIUM | DB Indexes | Open |
| KI-010 | MEDIUM | Auth Security | Open |
| KI-011 | MEDIUM | DB Schema | Backlog |
| KI-012 | MEDIUM | DB Performance | Open |
| KI-013 | MEDIUM | Axiomera | Open |
| KI-014 | MEDIUM | Axiomera | Open |
| KI-015 | MEDIUM | Maintenance | Open |
| KI-016 | LOW | DB Schema | Open |
| KI-017 | LOW | DB Schema | Open |
| KI-018 | LOW | File Upload | Open |
| KI-019 | LOW | DB Integrity | Open |
| KI-020 | LOW | Feature | Open |
