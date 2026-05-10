# JD Suite Ultra — Data Model

> Last updated: 2026-05-10
> Source of truth: `packages/db/prisma/schema.prisma`

---

## Entity Relationship Overview

```
Organisation ──< Membership >── User
     │
     ├──< JobDescription ──< JDVersion (audit trail)
     │         │          ──< JDComment
     │         │          ──< GuestToken
     │         │          ──< JDCheckout (tamper detection)
     │         │          ──< EvalResult
     │         │          ──< AxiomeraRun ──< AxiomeraCriterionScore
     │         │          ──< JdqRun               ──< AxiomeraValidationGate
     │         │          ──< Export                ──< RHypothesisRecord
     │         │                                    ──< EHypothesisRecord
     │         ├── Template (system or org)
     │         └── PayGroupMember >── PayGroup ──< PayGroupAuditLog
     │
     ├──< Template (org-scoped)
     ├──< PayGroup ──< PayGroupMember
     ├──< JobFamily ──< JobArchitectureSlot
     ├──< OrgChart
     ├──< Process ──< ProcessRole
     └──< BatchExport

User ──< AiUsageLog (no orgId — known gap)
     ──< AxiomeraRun (createdById)
     ──< AdminAuditLog
     ──< CompanionRequest
     ──< EuptdReadinessResponse

SourceConnection ──< SourceRun ──< ImportedJobPosting ──< RawSourceSnapshot
OrgInferenceRun ──< OrgNode, OrgEdge
ExtraContextItem

PmoaDocument ──> PmoaDepartment ──< PmoaPosition ──< PmoaAssignment
PmoaProcess ──< PmoaProcessStep ──< PmoaRasciCell
PmoaIssue
```

---

## Core Entities

### Organisation

**Table**: `organisations`

The top-level tenant. All user data is isolated per organisation.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | String | Display name |
| `plan` | String | `'free'` \| `'pro'` \| `'ultra'` |
| `settings` | Json | Org-level config (locale, branding) |

**Indexes**: `id` (PK)

**Tenant isolation pattern**: Every data table except `User`, `AuthToken`, `AccessCode`, and `AiUsageLog` carries `orgId`. Every query is scoped `WHERE orgId = session.orgId`.

---

### User

**Table**: `users`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `email` | String | Unique, lowercase |
| `passwordHash` | String? | bcryptjs, cost 10. Null for OAuth-only users |
| `isPlatformAdmin` | Boolean | Global super-admin flag |
| `dataConsentAt` | DateTime? | GDPR consent timestamp |
| `tosAcceptedAt` | DateTime? | Terms acceptance |
| `lastLoginAt` | DateTime? | Updated on each successful login |
| `preferredLanguage` | String? | ISO-639-1 (`pl`, `en`, `de`) |

---

### Membership

**Table**: `memberships`

Junction between `User` and `Organisation`.

| Column | Type | Description |
|--------|------|-------------|
| `userId` | String | FK → User |
| `orgId` | String | FK → Organisation |
| `role` | String | `MEMBER` \| `ADMIN` \| `OWNER` |

**Composite unique**: `(userId, orgId)` — one membership per user per org.

A user can belong to multiple organisations (future: org-switching UI).

---

### JobDescription

**Table**: `job_descriptions`

The central entity.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `orgId` | String | FK → Organisation |
| `ownerId` | String | FK → User (creator) |
| `status` | String | `DRAFT` \| `UNDER_REVISION` \| `APPROVED` \| `ARCHIVED` |
| `data` | Json | Map of fieldId → field value (string \| null) |
| `templateId` | String? | FK → Template |
| `duplicatedFromId` | String? | FK → JobDescription (lineage tracking) |

**Status transitions**:
```
DRAFT → UNDER_REVISION → APPROVED → ARCHIVED
DRAFT → APPROVED (fast-track)
APPROVED → UNDER_REVISION (reopen)
Any → ARCHIVED
```

**`data` field structure**: No schema enforcement at DB level. Structure is determined by the Template's field definitions. Example:
```json
{
  "jobTitle": "Senior HR Business Partner",
  "department": "Human Resources",
  "responsibilities": "...",
  "requirements": "...",
  "location": "Warsaw, PL"
}
```

---

### JDVersion

**Table**: `jd_versions`

Immutable audit trail. One row per change event.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `jdId` | String | FK → JobDescription |
| `userId` | String | FK → User (who made the change) |
| `changeType` | String | `FIELD_EDIT` \| `STATUS_CHANGE` \| `COMMENT` \| `IMPORT` \| `AI_ASSIST` \| `EVALUATION` \| `EXPORT` |
| `snapshot` | Json | Full `data` snapshot at this point in time |
| `diff` | Json? | Changed fields only |

**Note**: `changeType` is a plain String, not a Prisma enum — invalid values can be inserted.

---

### AxiomeraRun

**Table**: `axiomera_runs`

Full scoring result per JD evaluation.

| Column | Type | Notes |
|--------|------|-------|
| `jdId` | String | FK → JobDescription |
| `rPkt` | Int | 140–635 |
| `rZone` | Int | 1–9 |
| `rConfidence` | Float | 0.0–1.0 |
| `sPkt` | Int | 50–333 |
| `sLevel` | String | S1–S5 |
| `sSource` | String | `primary` \| `esco` \| `isco_median` |
| `ePkt` | Int | |
| `eScore` | Float | 0.0–1.0 |
| `cogScore` | Float | Cognitive effort 0.0–1.0 |
| `emoScore` | Float | Emotional effort 0.0–1.0 |
| `phyScore` | Float | Physical effort 0.0–1.0 |
| `eConfidence` | Float | 0.0–1.0 |
| `wcPkt` | Int | 50–350 |
| `wcLevel` | String | W1–W5 |
| `totalRSE` | Int | R+S+E composite |
| `grade` | Float | 0–20 (decimal for precision) |
| `band` | String | A1–E5 |
| `ciGlobal` | Float | 0.65×ci_R + 0.35×ci_E |
| `contradictionFlag` | Boolean | `\|ci_R - ci_E\| > 0.30` |
| `needsReview` | Boolean | `contradictionFlag OR ciGlobal < 0.6` |
| `rActiveKeys` | Json | Array of active R-hypothesis keys |
| `eActiveKeys` | Json | Array of active E-hypothesis keys |
| `rContradictions` | Json | Array of contradicting hypothesis pairs |

---

### PayGroup

**Table**: `pay_groups`

EUPTD Article 4 pay equity groups.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `orgId` | String | FK → Organisation |
| `name` | String | Display name |
| `color` | String? | Hex color for UI |
| `description` | String? | Rationale |
| `sortOrder` | Int | Display order |

**Relationships**:
- `PayGroupMember`: JD ↔ PayGroup junction (a JD belongs to exactly one group)
- `PayGroupAuditLog`: Every membership change creates a mandatory-comment log entry

**EUPTD Compliance**: Every move/add/remove of a JD between groups must have a comment. This comment is stored in `PayGroupAuditLog.comment`. This is a legal requirement under EU Pay Transparency Directive Article 4.

---

### AiUsageLog

**Table**: `ai_usage_logs`

Insert-only cost ledger. Never updated or deleted.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `createdAt` | DateTime | Call timestamp |
| `operation` | String | e.g. `jd.axiomera.extractR` |
| `promptVersion` | String | e.g. `v1.0.0` |
| `modelId` | String | Actual model used |
| `modelTier` | String | Tier name |
| `inputTokensEst` | Int | Pre-call estimate |
| `inputTokensActual` | Int? | From API response |
| `outputTokensActual` | Int? | From API response |
| `estimatedCostUsd` | Float | Computed at call time |
| `cacheStatus` | String | `hit` \| `miss` \| `n/a` \| `error` |
| `durationMs` | Int | End-to-end duration |
| `jdId` | String? | Associated JD (if applicable) |
| `programId` | String? | Associated sealed program |

**Known gaps**: No `orgId` field — cost cannot be attributed to tenant.

---

### SourceConnection

**Table**: `source_connections`

ATS / job board connector configuration per org.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `orgId` | String | FK → Organisation |
| `kind` | String | `GREENHOUSE_API` \| `ASHBY_POSTING_API` \| `LEVER_API` \| `SMARTRECRUITERS_API` \| `ADZUNA_API` \| `SCHEMA_ORG` \| `HTML` \| `MANUAL_URL` |
| `name` | String | User-given label |
| `config` | Json | Connector-specific auth config (API keys stored encrypted) |
| `lastSyncAt` | DateTime? | Last successful sync |

**Security**: `config` JSON contains API keys. Encrypted at rest by Neon/Postgres, transmitted over TLS. Never returned raw to client — only metadata is exposed.

---

### ImportedJobPosting

**Table**: `imported_job_postings`

Normalised job posting from any connector.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `sourceRunId` | String | FK → SourceRun |
| `externalId` | String? | ID from source system |
| `title` | String | Normalised job title |
| `department` | String? | |
| `jobFamily` | String? | Inferred |
| `salary` | Json? | `{ min, max, currency, period }` |
| `location` | String? | |
| `descriptionRaw` | String | Original HTML/text |
| `descriptionClean` | String? | Stripped plain text |
| `contentHash` | String? | SHA-256 for deduplication |
| `linkedJdId` | String? | FK → JobDescription (when saved) |

**Deduplication**: On ingestion, `contentHash` is compared against existing rows for the same org. Duplicate postings are skipped. Index on `contentHash` recommended (currently missing).

---

## Tenant Isolation Pattern

```typescript
// Pattern used in every protected API handler:
const session = await auth();
const orgId = (session as any).orgId as string;

// ALWAYS scope queries:
const jds = await db.jobDescription.findMany({
  where: { orgId },  // ← critical
});
```

**Risk**: If `orgId` is missing from session (e.g. user with no Membership), queries return empty results rather than throwing. New users without org membership cannot see any data — correct behavior, but error messaging could be clearer.

---

## Indexing Recommendations

Current schema has primary key indexes. Additional indexes needed:

| Table | Column | Reason |
|-------|--------|--------|
| `ImportedJobPosting` | `contentHash` | Deduplication lookup |
| `RateLimitBucket` | `key` (unique) | Race-condition prevention |
| `AiUsageLog` | `jdId` | Per-JD cost queries |
| `AiUsageLog` | `createdAt` | Time-range queries |
| `JDVersion` | `jdId` | Version history listing |
| `GuestToken` | `token` | Token lookup on review |
| `AuthToken` | `tokenHash` | Reset/magic-link verification |

---

## Legacy / Deprecated Tables

### Photo

A `Photo` model exists in the schema, inherited from a pre-Ultra prototype application. It is unrelated to JD Suite functionality and has no relations to any other entity.

**Status**: Preserved to prevent accidental DROP. Should be formally deprecated with a schema comment and eventually removed after confirming no live data exists.
