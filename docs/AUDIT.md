# JD Suite Ultra — Technical Audit Report

> Generated: 2026-05-10 · Auditors: Kimi K2 (Moonshot AI) + Claude Sonnet 4.6
> Scope: Documentation gaps, architectural bottlenecks, code/schema risks, missing docs, fix recommendations

---

## A. Documentation Gaps

Items that exist in code/schema but are missing or underexplained in DOCUMENTATION.md.

### A1. JWT Signature Not Verified in Middleware [HIGH]
`middleware.ts` only checks for the **presence** of the session cookie — it does not verify the JWT signature. DOCUMENTATION.md describes the middleware as a security boundary without noting this limitation. Route handlers must perform their own full `auth()` calls.

### A2. Embedding Tiers Have No Working Provider [CRITICAL]
`model-registry.ts` defines `embedding-small` and `embedding-large` tiers using **OpenAI model IDs** (`text-embedding-3-small/large`). The only AI provider implemented is `callAnthropic()`. No `OPENAI_API_KEY` env var is documented or used. If any code calls `callAi({ tier: 'embedding-small' })`, it will silently hit the Anthropic endpoint with an OpenAI model ID and fail.

### A3. AiUsageLog Has No orgId [HIGH]
The `AiUsageLog` model has no `orgId` field (confirmed in schema). Cost attribution per organisation is impossible from the log alone. The documentation describes AiUsageLog for "cost tracking" but does not note this gap.

### A4. ciGlobal Formula Excludes S Confidence [MEDIUM]
`ciGlobal = 0.65 * ci_R + 0.35 * ci_E` — Skills (S) confidence is not included in the global confidence interval. This is undocumented. A low-confidence S classification will not lower the global CI.

### A5. Band Clamping Edge Cases [MEDIUM]
Grades below 6 all clamp to `A1`; grades above 30 all clamp to `E5`. A JD with minimal R/S/E (e.g. a very thin description) could produce grade 0 and still display `A1`. This is not documented as a known edge case.

### A6. Sensitivity Weights Not Wired to UI or API [MEDIUM]
`SENSITIVITY_EFFORT_BOOSTED` (45/25/30) is defined in `compose.ts` but is not used by any API endpoint or UI control. The docs describe only the default weights and do not mention sensitivity analysis mode exists.

### A7. No Per-Call Timeout on Axiomera AI Calls [HIGH]
`extract-r.ts` and `extract-e.ts` have `MAX_RETRIES = 2` but no `AbortController` / timeout. On a slow Anthropic response, these calls can block a Vercel Function for the full 60-second timeout, failing the HTTP request. Not documented.

### A8. No JD Chunking for Long Descriptions [MEDIUM]
The full JD text is injected into a single Anthropic prompt. Prisma does not limit the `data` JSON field size. A JD with very long field values could exceed the model's context window (200K for Sonnet, but prompt overhead + 45 hypotheses list + full JD could approach limits). Undocumented.

### A9. Feature Flags Are Static (Require Redeploy) [LOW]
FLAGS are computed at module load time from `process.env`. Changing a flag requires a Vercel redeploy. Not documented — operators may expect runtime toggle support.

### A10. Missing Connector Coverage Documentation [MEDIUM]
Connectors for Workday, SAP SuccessFactors, iCIMS, Taleo, Recruitee, and Personio are absent. These cover the majority of enterprise ATS deployments in EMEA. Not mentioned as a known gap.

### A11. `Photo` Legacy Table [LOW]
Schema includes a `Photo` model described as "unrelated app, preserved to prevent DB drop." Not documented anywhere — confusing for new contributors.

### A12. GDPR / Consent Fields on User [MEDIUM]
`User` has `dataConsentAt`, `tosAcceptedAt`, `privacyAcceptedAt`, `marketingOptIn`, `newsletterOptIn`. The docs mention GDPR under "Security Notes" only superficially. No documentation on when these are set, what triggers them, or how they're enforced.

### A13. ApprovalRecord Workflow States [MEDIUM]
`ApprovalRecord` supports `DRAFT → MANAGER_VALIDATION → HR_REVIEW → GOVERNANCE_APPROVAL → APPROVED | REJECTED` but `ENABLE_APPROVAL_WORKFLOW` flag is OFF by default and the full state machine is undocumented.

### A14. `PmoaDocument.validityFlag` Logic [LOW]
The `recent | stale` validity flag is set during parsing but the threshold (what date makes a document "stale") is not documented.

---

## B. Architectural Bottlenecks

### B1. Admin Routes Not Enforced at Edge [CRITICAL]
`middleware.ts` only checks session cookie presence — it does not route-guard `/admin/*` paths for `isPlatformAdmin`. An attacker with any valid session cookie can attempt admin API routes. Individual route handlers must guard themselves, but a missed check is a privilege escalation.

**Impact**: If any admin API handler forgets the `isPlatformAdmin` check, any authenticated user gains admin access.

### B2. AiUsageLog Will Grow Unboundedly [HIGH]
`AiUsageLog` is insert-only with no archiving, partitioning, TTL, or cleanup strategy. In a busy org with 10 JDs/day × 5 AI operations each × 365 days = ~18K rows/year/org. At 100 orgs, 1.8M rows/year with no pruning. PostgreSQL table scans on large unpartitioned tables degrade at scale.

### B3. No AI Retry on Transient Errors [HIGH]
`call-ai.ts` has zero retry logic. Anthropic's API returns transient 529 (overloaded) errors during peak demand. A single failed call means a lost user action (e.g. full Axiomera run fails at R-extraction, costs nothing but loses the entire user workflow). The `MAX_RETRIES=2` in `extract-r.ts` only retries on _schema validation_ failure, not on HTTP errors.

### B4. Vercel Function Timeout Risk on Axiomera [HIGH]
The Axiomera pipeline runs two Claude calls sequentially (extractR + extractE), each potentially taking 20–40s. Total pipeline duration can approach or exceed Vercel's 60-second function timeout. No timeout guard exists.

### B5. JWT Session Strategy with Long Expiry [MEDIUM]
JWT sessions with 7-day expiry and no server-side invalidation mean a compromised token remains valid for up to 7 days. There is no session revocation mechanism (no `Session` table in active use, no blacklist). Role changes (e.g. demoting an admin) don't take effect until the JWT expires.

### B6. Single Neon Database for All Tenants [MEDIUM]
All orgs share one PostgreSQL database with row-level tenant isolation (orgId FK). A slow query from one large org can degrade performance for all. No read replica or query timeout strategy documented.

### B7. `data` JSON Column on JobDescription [MEDIUM]
All JD fields are stored in a single `Json` column (`data`). This makes:
- Querying by field value impossible without JSON operators (no index on field values)
- Partial field updates require a full JSON replace
- No schema enforcement on field structure at DB level

### B8. Rate Limiting Bucket Not Indexed Efficiently [MEDIUM]
`RateLimitBucket` relies on `key` lookups (e.g. `login:1.2.3.4`) but if there's no unique index on `key`, concurrent requests could create duplicate rows and bypass the limit via race condition.

### B9. GuestToken Expiry Not Enforced at DB Level [LOW]
`GuestToken.expiresAt` is checked in application logic but there's no DB-level trigger or scheduled job to clean up expired tokens. Over time the table grows with stale rows.

---

## C. Code & Schema Errors / Risks

### C1. Embedding Tiers Will Fail Silently [CRITICAL]
If `callAi({ tier: 'embedding-small' })` is called:
1. `callAnthropic()` receives `modelId = 'text-embedding-3-small'`
2. Anthropic API returns a 400 error ("model not found")
3. `callAi` logs an `AiUsageLog` row with `status='error'`
4. The caller receives an empty string or throws — depending on error handling path

No guard exists in `callAi()` to reject embedding tiers, and no OPENAI_API_KEY is wired.

### C2. Middleware Cookie Spoofing Risk [HIGH]
Any request with a cookie named `next-auth.session-token` (even an invalid or expired JWT) passes the middleware check. Route handlers using `auth()` from NextAuth will catch this, but any route handler that does NOT call `auth()` and relies solely on middleware passing the request is vulnerable.

### C3. `gradeToBand` Clamps Silently [MEDIUM]
```typescript
if (grade < 6) return 'A1';
if (grade > 30) return 'E5';
```
A grade of 0 (empty JD) returns 'A1' — the same as a genuine entry-level role. No warning or flag is emitted. A `contradictionFlag` may not be set because ciGlobal could still be 0.6+ if the LLM returns high confidence on zero activations.

### C4. `ciGlobal` Can Be Misleading When S Confidence Is Low [MEDIUM]
S level is derived deterministically from declared edu/exp — not from LLM extraction. S has no confidence score. If edu/exp are undeclared and ISCO fallback is used, the fallback is a population median with unknown uncertainty — but ciGlobal treats it as if S has no uncertainty contribution.

### C5. `AiUsageLog.orgId` Missing — Cost Reporting Broken [HIGH]
Without `orgId`, it is impossible to:
- Bill per-org AI usage
- Identify runaway cost by tenant
- Show org-level cost dashboards (Phase 4 `COST_DASHBOARD` flag)

### C6. No Unique Constraint on `RateLimitBucket.key` [HIGH]
If missing, concurrent login attempts could create duplicate bucket rows, each with count=1, bypassing the rate limit. Needs `@@unique([key])` in schema.

### C7. `JDVersion.changeType` Is an Enum String, Not a DB Enum [LOW]
`changeType` is stored as a plain `String` in Prisma rather than a DB-level enum. Invalid strings can be inserted. Should be a Prisma `enum` or at minimum have a `@db.VarChar(50)` with application-level validation.

### C8. `ImportedJobPosting.contentHash` Not Indexed [MEDIUM]
Deduplication logic uses `contentHash` to detect duplicate postings. Without an index on this column, every dedup check is a full table scan — increasingly slow as `ImportedJobPosting` grows.

### C9. `PmoaDocument` Has No File Size Limit [LOW]
Upload handler stores file metadata but there is no documented max file size for PDF/DOCX uploads. Large files could exhaust Vercel Function memory (1GB limit) during parsing.

### C10. `BatchExport.jdIds` Is a Raw JSON Array [LOW]
`jdIds Json` stores an array of JD IDs without FK constraints. Deleted JDs will leave dangling references in batch exports with no cleanup.

### C11. `AuthToken` Has No Rate Limit on Issuance [MEDIUM]
`POST /api/auth/forgot-password` can be called repeatedly to generate unlimited `AuthToken` rows for any email address. Without issuance rate limiting, this enables DB row exhaustion and potential email bombing.

### C12. `callAi` maxTokens Default of 3000 May Truncate Axiomera Output [HIGH]
Axiomera R-extraction returns JSON for 19 hypotheses with evidence quotes. The full JSON response can easily exceed 3000 tokens if evidence quotes are long. Truncated JSON fails schema validation and triggers all MAX_RETRIES, tripling cost with likely final failure.

---

## D. Missing Technical Documents

| Document | Priority | Reason |
|----------|----------|--------|
| `docs/SECURITY.md` | CRITICAL | JWT limitation, admin enforcement, GDPR fields, token security |
| `docs/RUNBOOK.md` | HIGH | Deploy, rollback, DB migration, incident response, env var management |
| `docs/AI_COST_MODEL.md` | HIGH | AiUsageLog schema, cost attribution, model pricing, budgeting |
| `docs/DATA_MODEL.md` | HIGH | Entity relationship diagram, tenant isolation pattern, FK constraints |
| `docs/AXIOMERA_WHITEPAPER.md` | HIGH | R/S/E/WC factor definitions, hypothesis list, band table, scoring formula |
| `docs/KNOWN_ISSUES.md` | HIGH | This audit's findings, tech debt tracker |
| `docs/CONNECTOR_GUIDE.md` | MEDIUM | How to add a new ATS connector, testing, registration |
| `docs/FEATURE_FLAGS.md` | MEDIUM | All flags, their phase, dependencies, how to enable safely |
| `docs/API_ERRORS.md` | MEDIUM | Standardised error codes, HTTP status mapping, error shapes |
| `docs/GDPR_COMPLIANCE.md` | MEDIUM | Consent fields, data subject rights, export/delete flows |
| `docs/MIGRATIONS.md` | MEDIUM | Migration naming, deploy strategy, rollback procedure |
| `docs/PERFORMANCE.md` | LOW | AiUsageLog partitioning, Neon connection pool tuning, cache strategy |

---

## E. Fix Recommendations

### E1. CRITICAL — Add Admin Route Guard at Middleware Level
```typescript
// middleware.ts
if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
  // Full auth() check required — middleware cannot verify isPlatformAdmin
  // without DB access, so redirect to /forbidden and let route handler verify
  // or: parse JWT payload (without signature check) to read isPlatformAdmin claim
}
```
Short-term: Add `isPlatformAdmin: true` claim to the JWT token and read it in middleware for a fast (unsigned) check. Route handlers still call `auth()` + `db.user` for the signed verification.

### E2. CRITICAL — Remove Embedding Tiers or Implement OpenAI Provider
Either:
- Remove `embedding-small` and `embedding-large` from `MODEL_REGISTRY` until an OpenAI path exists
- Or: add `OPENAI_API_KEY` to env vars + implement `callOpenAI()` branch in `callAi()`

### E3. HIGH — Add orgId to AiUsageLog
```prisma
model AiUsageLog {
  // existing fields...
  orgId    String?  // Add this
  org      Organisation? @relation(fields: [orgId], references: [id])
}
```
Also add `jdId String?` for per-JD cost attribution. Run migration: `pnpm db:migrate:dev --name add-orgId-to-ai-usage-log`.

### E4. HIGH — Add Retry + Timeout to callAi
```typescript
// In callAnthropic():
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 55_000); // 55s < Vercel 60s limit
try {
  const res = await fetch(ANTHROPIC_URL, { ..., signal: controller.signal });
  // Retry on 429, 529 with exponential backoff
} finally {
  clearTimeout(timeout);
}
```

### E5. HIGH — Add Unique Constraint on RateLimitBucket.key
```prisma
model RateLimitBucket {
  key     String   @unique  // ← add this
  // ...
  @@map("rate_limit_buckets")
}
```

### E6. HIGH — Index ImportedJobPosting.contentHash
```prisma
model ImportedJobPosting {
  contentHash String?
  @@index([contentHash])  // ← add this
}
```

### E7. HIGH — Increase maxTokens for Axiomera Operations
In `model-registry.ts` or `call-ai.ts`, set operation-specific token limits:
```typescript
// In callAi options per operation:
'jd.axiomera.extractR': { maxTokens: 8000 },
'jd.axiomera.extractE': { maxTokens: 12000 },
```

### E8. HIGH — Rate Limit AuthToken Issuance
In `POST /api/auth/forgot-password`:
```typescript
const rl = await checkRateLimit(`reset:${email}`, 3, 15 * 60 * 1000);
if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
```

### E9. MEDIUM — Document Band Clamping and Zero-Grade Edge Cases
Add validation: if `grade < 3` (i.e. R+S+E < 150 total points), set `needsReview = true` and `contradictionFlag = true` regardless of ciGlobal value. Log a warning.

### E10. MEDIUM — Include S Confidence in ciGlobal
When S source is `isco_median` (population fallback), treat S confidence as `low` (0.40) and incorporate:
```typescript
// Revised formula
ciGlobal = 0.472 * ci_R + 0.333 * ci_S + 0.195 * ci_E
```

### E11. MEDIUM — Add Rate Limit on AuthToken issuance per IP
Separate from per-email: `reset:ip:{x-forwarded-for}` → max 10 in 15 min.

### E12. MEDIUM — Clean Up Expired GuestTokens + AuthTokens
Add a Vercel Cron job (`vercel.json`) or n8n workflow:
```json
{
  "crons": [{
    "path": "/api/cron/cleanup-tokens",
    "schedule": "0 3 * * *"
  }]
}
```
Route deletes `GuestToken` where `expiresAt < now()` and `AuthToken` where `expiresAt < now() AND usedAt IS NOT NULL`.

### E13. LOW — Add DB-Level JDVersion.changeType Enum
```prisma
enum ChangeType {
  FIELD_EDIT
  STATUS_CHANGE
  COMMENT
  IMPORT
  AI_ASSIST
  EVALUATION
  EXPORT
}

model JDVersion {
  changeType ChangeType
}
```

### E14. LOW — Document Photo Table Deprecation
Either drop it with a migration or add a comment in schema:
```prisma
/// DEPRECATED — legacy table from pre-Ultra prototype. Do not use.
/// Kept to avoid accidental DROP TABLE on shared Neon instance.
model Photo { ... }
```

---

## Summary Matrix

| ID | Area | Severity | Effort | Priority |
|----|------|----------|--------|----------|
| C1 / E2 | Embedding tiers broken | CRITICAL | Low | 🔴 Now |
| B1 / E1 | Admin not enforced at edge | CRITICAL | Medium | 🔴 Now |
| C5 / E3 | AiUsageLog missing orgId | HIGH | Low | 🟠 Soon |
| C12 / E7 | maxTokens truncates Axiomera | HIGH | Low | 🟠 Soon |
| C6 / E5 | RateLimitBucket no unique | HIGH | Low | 🟠 Soon |
| B3 / E4 | No AI retry on transient error | HIGH | Medium | 🟠 Soon |
| C11 / E8 | No rate limit on password reset | HIGH | Low | 🟠 Soon |
| C8 / E6 | contentHash not indexed | MEDIUM | Low | 🟡 Next sprint |
| B2 | AiUsageLog unbounded growth | MEDIUM | Medium | 🟡 Next sprint |
| B5 | JWT no revocation | MEDIUM | High | 🟡 Next sprint |
| C4 / E10 | S confidence excluded from CI | MEDIUM | Low | 🟡 Next sprint |
| E12 | Expired token cleanup | MEDIUM | Low | 🟡 Next sprint |
| E9 | Zero-grade edge case undocumented | LOW | Low | 🟢 Backlog |
| E14 | Photo table undocumented | LOW | Low | 🟢 Backlog |
