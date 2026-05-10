# JD Suite Ultra — Technical & Product Documentation

> Version: Ultra Phase 0 · Last updated: 2026-05-03
> Deployment: `jd-suite-ultra.vercel.app` · Repo: `github.com/tomrey81/jd-suite-ultra`

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Tech Stack](#4-tech-stack)
5. [Database Schema](#5-database-schema)
6. [Authentication & Security](#6-authentication--security)
7. [Pages & Routing](#7-pages--routing)
8. [API Reference](#8-api-reference)
9. [Key Libraries & Modules](#9-key-libraries--modules)
10. [Axiomera Engine](#10-axiomera-engine)
11. [Job Sources Intelligence](#11-job-sources-intelligence)
12. [PMOA Module](#12-pmoa-module)
13. [Audio / Sonification](#13-audio--sonification)
14. [Feature Flags](#14-feature-flags)
15. [Environment Variables](#15-environment-variables)
16. [Development Guide](#16-development-guide)
17. [Deployment](#17-deployment)

---

## 1. Product Overview

JD Suite Ultra is an AI-powered job description management platform for HR professionals. It covers the full lifecycle of a job description — from creation and quality review to legal compliance, pay equity, and organisational architecture.

### Core Domains

| Domain | Purpose |
|--------|---------|
| **JD Management** | Create, version, approve, export job descriptions |
| **Axiomera Engine** | Weighted job evaluation (R/S/E/WC) per analytical method |
| **Bias & Quality** | AI-powered bias scanning, linting, honest review |
| **Job Sources** | Import + normalise postings from ATS / job boards |
| **Pay Groups** | EUPTD Article 4 pay group management with audit trail |
| **Job Architecture** | Job family × level matrix (career framework) |
| **PMOA** | Process Mapping & Org Architecture (org chart + RASCI) |
| **Sonification** | FSK audio encoding for cross-device document transfer |
| **Admin** | Multi-org SaaS: user/org management, access codes, audit logs |

### Target Users

- **HR Analysts** — draft, evaluate, and manage JDs
- **Compensation Managers** — pay group assignment and EUPTD compliance
- **Org Design Consultants** — org chart extraction, RASCI mapping
- **Platform Admins** — user provisioning, tamper detection, audit trail

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Vercel Edge                          │
│   Next.js 15 App Router (SSR + API Routes + Middleware)     │
├───────────────────────┬─────────────────────────────────────┤
│   React 19 Frontend   │     Node.js API Routes              │
│   Radix UI + Tailwind │     NextAuth · Prisma · callAi()    │
│   Zustand · RQ v5     │     Zod validation · bcryptjs       │
├───────────────────────┴─────────────────────────────────────┤
│                @jd-suite/db (Prisma + Neon adapter)         │
├─────────────────────────────────────────────────────────────┤
│              Neon PostgreSQL (serverless, EU Central)       │
└─────────────────────────────────────────────────────────────┘
                          │
              ┌───────────┼──────────────┐
              ▼           ▼              ▼
        Anthropic    ATS connectors   Vercel Blob
        Claude API   (Greenhouse,     (file storage)
        (callAi)     Ashby, Lever…)
```

### Key Architectural Decisions

- **Serverless-first**: Neon `@prisma/adapter-neon` avoids persistent connections; every function is stateless.
- **Centralised AI wrapper** (`callAi()`): All Anthropic calls go through a single function that logs cost to `AiUsageLog` (insert-only) at call time with the pricing valid at that moment.
- **JWT sessions**: Stateless; `orgId` + `orgRole` baked into the token — no DB hit per request.
- **Rate limiting in DB**: `RateLimitBucket` table allows cross-instance rate limiting without Redis.
- **Tamper detection**: `JDCheckout` stores SHA-256 snapshots of JDs for compliance audit chains.
- **Feature flags at boot**: All new capabilities default OFF; visible via `feature-flags.ts` constants.

---

## 3. Monorepo Structure

```
jd-suite-ultra/
├── apps/
│   └── web/                    # Next.js 15 application
│       ├── app/                # App Router (pages + API routes)
│       │   ├── (dashboard)/    # Auth-protected layout
│       │   ├── (public)/       # Guest/public layout
│       │   ├── (print)/        # Print layout
│       │   └── api/            # API route handlers
│       ├── components/         # React components
│       ├── lib/                # Business logic, AI, engines
│       ├── middleware.ts        # Auth guard + route protection
│       ├── vitest.config.ts
│       └── package.json
├── packages/
│   ├── db/                     # @jd-suite/db
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Single source of truth for DB
│   │   └── src/index.ts        # Prisma client singleton
│   └── types/                  # @jd-suite/types
│       └── src/index.ts        # Zod schemas + shared constants
├── pnpm-workspace.yaml
└── package.json
```

---

## 4. Tech Stack

### Frontend

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.5 (App Router, Turbopack) |
| UI | React 19 + Radix UI primitives |
| Styling | Tailwind CSS 4.0 + PostCSS |
| Forms | react-hook-form 7.54 + Zod |
| Global state | Zustand 5.0 |
| Server state | TanStack Query 5.62 |
| Diagrams | ReactFlow 11.11 (org charts, process maps) |
| Exports | jspdf, docx, exceljs, html-to-image |
| i18n | next-intl 3.25 |

### Backend

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ (Vercel Functions) |
| Auth | NextAuth 5.0 beta (JWT, Credentials) |
| ORM | Prisma 6.2 + `@prisma/adapter-neon` |
| Database | PostgreSQL 15+ on Neon (EU Central) |
| AI | Anthropic Claude API (`@anthropic-ai/sdk` 0.39) |
| Validation | Zod 3.24 (all API inputs) |
| Password | bcryptjs 2.4 |
| Rate limiting | DB-backed (`RateLimitBucket`) |

### Testing

| Type | Tool |
|------|------|
| Unit / golden | Vitest 2.1 |
| E2E | Playwright 1.49 |
| DOM | jsdom 25 |

### Document Processing

| Format | Library |
|--------|---------|
| PDF generation | jspdf 2.5 |
| PDF viewing | pdfjs-dist 4.10 |
| PDF extraction | pdf-parse 2.4 |
| DOCX generation | docx 9.6 |
| DOCX parsing | mammoth 1.12 |
| Excel | exceljs 4.4 |
| HTML → image | html-to-image |

---

## 5. Database Schema

Schema lives in `packages/db/prisma/schema.prisma`. All types are generated via `pnpm db:generate`.

### Entity Groups

#### Users & Multi-tenancy

```
User ──< Membership >── Organisation
         (ADMIN | OWNER | MEMBER)
```

- `User`: email, passwordHash, lastLoginAt, isPlatformAdmin, preferences JSON
- `Organisation`: tenant workspace, plan, settings JSON
- `Membership`: role scoping per org
- `AccessCode`: rotatable invitation codes with maxUses, expiresAt
- `AuthToken`: magic-link + password-reset tokens (tokenHash, kind, expiresAt, usedAt)

#### Job Descriptions

```
JobDescription ──< JDVersion (audit trail)
               ──< JDComment (threaded)
               ──< GuestToken (share)
               ──< JDCheckout (tamper detection)
               ──< EvalResult
               ──< AxiomeraRun
```

- `JobDescription`: status (`DRAFT | UNDER_REVISION | APPROVED | ARCHIVED`), data JSON (fieldId → value), templateId, folderId
- `JDVersion`: immutable, changeType (`FIELD_EDIT | STATUS_CHANGE | COMMENT | IMPORT | AI_ASSIST | EVALUATION | EXPORT`)
- `JDCheckout`: SHA-256 snapshot, tamperFlag — for compliance audit chains
- `GuestToken`: external review (email, role `VIEWER | REVIEWER`, expiresAt)

#### Axiomera Engine

```
JobDescription ──< AxiomeraRun ──< AxiomeraCriterionScore
                              ──< AxiomeraValidationGate
                              ──< RHypothesisRecord
                              ──< EHypothesisRecord
```

| Column | Type | Notes |
|--------|------|-------|
| `rPkt` | Int | Responsibility points (140–635) |
| `rZone` | Int | Zone 1–9 |
| `sPkt` | Int | Skills points (50–333) |
| `sLevel` | String | S1–S5 |
| `ePkt` | Int | Effort points |
| `eScore` | Float | 0.0–1.0 |
| `wcPkt` | Int | Working Conditions (50–350) |
| `wcLevel` | String | W1–W5 |
| `totalRSE` | Int | Composite (R+S+E) |
| `grade` | Float | 0–20 |
| `band` | String | A1–E5 |
| `ciGlobal` | Float | Global confidence 0–1 |
| `contradictionFlag` | Bool | Auto-flagged for review |

#### Pay Groups (EUPTD Art. 4)

```
PayGroup ──< PayGroupMember >── JobDescription
         ──< PayGroupAuditLog   (mandatory-comment trail)
```

Every membership change generates a `PayGroupAuditLog` with a mandatory comment — EUPTD compliance requirement.

#### PMOA

```
PmoaDocument ──> PmoaDepartment ──< PmoaPosition ──< PmoaAssignment
PmoaProcess ──< PmoaProcessStep ──< PmoaRasciCell
PmoaIssue
```

- `PmoaDocument`: uploaded file, validityFlag (`recent | stale`), ocrConfidence
- `PmoaDepartment`: parsed hierarchy with parentId
- `PmoaPosition`: role/job, reportsToId, spanOfControl, linkedJdId
- `PmoaProcess`: BPMN-compatible, ownerPositionId, validityFlag

#### AI Cost Tracking

```
AiUsageLog (insert-only)
  operation, modelId, modelTier,
  inputTokensActual, outputTokensActual,
  estimatedCostUsd, cacheStatus, durationMs
```

Pricing is baked in at call time (not recomputed retroactively).

#### Job Sources Intelligence

```
SourceConnection ──< SourceRun ──< ImportedJobPosting
                                ──< RawSourceSnapshot
OrgInferenceRun ──< OrgNode, OrgEdge
ExtraContextItem
```

---

## 6. Authentication & Security

### Auth Flow

1. User submits email + password → `POST /api/auth/[...nextauth]`
2. `checkRateLimit()` — 10 attempts / 15 min / IP (DB-backed, cross-instance)
3. `db.user.findUnique` + `bcryptjs.compare`
4. On success: JWT minted with `{ id, orgId, orgRole }`, 7-day expiry
5. Subsequent requests: middleware reads cookie, validates JWT, injects session

### Additional Flows

| Flow | Endpoint | Mechanism |
|------|---------|-----------|
| Registration | `POST /api/auth/register` | Creates User + Membership |
| Magic link issue | `POST /api/auth/magic-link` | Stores tokenHash in AuthToken |
| Magic link verify | `POST /api/auth/magic-link/verify` | Marks usedAt, returns session |
| Password reset | `POST /api/auth/forgot-password` | Sends reset email |
| Reset confirm | `POST /api/auth/reset-password` | Updates passwordHash |

### Middleware (`middleware.ts`)

Public routes (no auth): `/welcome`, `/login`, `/register`, `/legal/*`, `/api/auth/*`, `/api/guest/*`, `/sonification/receiver`

All other routes: JWT cookie required → missing → `401` (API) or redirect `/login` (pages).

### Security Notes

- Passwords hashed with bcryptjs (cost factor 10)
- Auth tokens (magic link, reset) stored as SHA-256 hashes, single-use
- XSS protection: `sanitize-html` on all HTML inputs
- Rate limiting stored in DB (not memory) — survives function restarts
- Invite codes: rotatable, configurable maxUses + expiresAt
- Tamper detection: SHA-256 snapshots per JDCheckout (admin visibility)

---

## 7. Pages & Routing

### Public Routes

| Path | Purpose |
|------|---------|
| `/welcome` | Splash / onboarding |
| `/login` | Email + password sign-in |
| `/register` | Account creation |
| `/forgot-password` | Request password reset |
| `/reset-password` | Confirm reset |
| `/legal/terms` | Terms of service |
| `/legal/privacy` | Privacy policy |
| `/forbidden` | 403 page |
| `/(public)/review/[token]` | Guest review (time-limited) |
| `/sonification/receiver` | Cross-device audio receiver |

### Dashboard Routes (auth required)

#### JD Lifecycle

| Path | Purpose |
|------|---------|
| `/jd` | JD Hub — list, search, filter |
| `/jd/new` | Create new JD |
| `/jd/[id]` | View / edit JD |
| `/jd/[id]/studio` | Advanced editor (versioning, audit) |
| `/jd/[id]/audit-report` | AI-generated audit report |
| `/jd/input` | Single-JD import wizard |
| `/jd/bulk-import` | Batch CSV/XLSX import |

#### Analysis & Quality

| Path | Purpose |
|------|---------|
| `/analyse` | AI analysis view |
| `/analyser` | Advanced governance analysis |
| `/compare` | Side-by-side JD comparison |
| `/compare/text` | Raw text comparison |
| `/rubric` | Evaluation criteria reference |

#### Org & Architecture

| Path | Purpose |
|------|---------|
| `/architecture` | Job family × level matrix |
| `/pmoa` | PMOA hub |
| `/pmoa/org` | Org chart visualisation |
| `/pmoa/processes` | Process list |
| `/pmoa/processes/[id]` | Process detail + RASCI |
| `/rasci` | RASCI matrix builder |

#### Pay & Compliance

| Path | Purpose |
|------|---------|
| `/pay-groups` | EUPTD pay group configurator |
| `/euptd-readiness` | Self-assessment checklist |
| `/euptd-readiness/report` | Readiness report |

#### Studio & Audio

| Path | Purpose |
|------|---------|
| `/studio` | Audio synthesis main |
| `/studio/ensemble` | Multi-sample playback |
| `/studio/library` | Sound library |

#### Sources

| Path | Purpose |
|------|---------|
| `/sources` | ATS / job board connectors |

#### Settings & Admin

| Path | Purpose |
|------|---------|
| `/settings` | User preferences |
| `/company` | Org profile |
| `/templates` | JD template library |
| `/templates/[id]` | Edit template |
| `/audit` | User-visible audit log |
| `/command-center` | Admin console |

### Admin Routes (`/admin/*`)

| Path | Purpose |
|------|---------|
| `/admin` | Admin dashboard |
| `/admin/users` | User management |
| `/admin/orgs` | Organisation management |
| `/admin/jds` | Global JD registry |
| `/admin/jds/[id]` | JD detail + tamper check |
| `/admin/jds/[id]/comparison` | Version diff |
| `/admin/access-codes` | Invite code management |
| `/admin/audit` | Admin action audit log |

---

## 8. API Reference

### Authentication (`/api/auth/`)

| Method | Path | Purpose |
|--------|------|---------|
| ANY | `/api/auth/[...nextauth]` | NextAuth handler |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/forgot-password` | Request reset |
| POST | `/api/auth/reset-password` | Confirm reset |
| POST | `/api/auth/magic-link` | Issue magic link |
| POST | `/api/auth/magic-link/verify` | Verify magic link |

### JD Management (`/api/jd/`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/jd` | List JDs (org-scoped) |
| POST | `/api/jd` | Create JD |
| GET | `/api/jd/[id]` | Get JD |
| PUT | `/api/jd/[id]` | Update JD + create JDVersion |
| DELETE | `/api/jd/[id]` | Archive/delete |
| POST | `/api/jd/[id]/export` | Export (PDF/DOCX/JSON/TXT/MD) |
| GET | `/api/jd/[id]/history` | Version list |
| POST | `/api/jd/[id]/restore` | Restore to version |
| POST | `/api/jd/[id]/comment` | Add comment |
| POST | `/api/jd/[id]/share` | Generate guest token |
| POST | `/api/jd/[id]/eval` | Run evaluation |
| POST | `/api/jd/[id]/axiomera` | Axiomera R/S/E/WC scoring |
| POST | `/api/jd/[id]/audit-report` | Generate audit report |
| POST | `/api/jd/bulk-import` | Batch import |

### AI Features (`/api/ai/`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/ai/analyse` | Full JD analysis |
| POST | `/api/ai/evaluate` | Single-criterion evaluation |
| POST | `/api/ai/generate-field` | AI field suggestion |
| POST | `/api/ai/honest-review` | Candid critique |
| POST | `/api/ai/sonic-review` | Audio transcript analysis |
| POST | `/api/ai/test-hypotheses` | R/E hypothesis validation |
| POST | `/api/ai/pay-groups` | AI pay group suggestion |
| POST | `/api/ai/end-session` | Session summary |
| POST | `/api/ai/companion` | AI companion chat |

### Job Sources (`/api/sources/`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/sources/discover` | Find postings from URL/ATS |
| POST | `/api/sources/preflight` | Connector auth test |
| POST | `/api/sources/analyse-readiness` | JD readiness vs posting |
| POST | `/api/sources/org-inference` | Org extraction from postings |
| POST | `/api/sources/extra-context` | Company research |
| POST | `/api/sources/ats-keywords` | ATS keyword extraction |

### Process & Org (`/api/process/`, `/api/org-structure/`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/process/extract` | Extract RASCI from JD |
| POST | `/api/process/save` | Save process steps |
| POST | `/api/org-structure/extract` | Parse org chart from doc |

### PMOA (`/api/pmoa/`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/pmoa/documents` | Upload document |
| GET | `/api/pmoa/documents/[id]` | Get document |
| DELETE | `/api/pmoa/documents/[id]` | Delete document |
| POST | `/api/pmoa/build-org` | Extract org from documents |
| POST | `/api/pmoa/build-processes` | Extract processes |
| POST | `/api/pmoa/org-graph` | Build org graph |
| POST | `/api/pmoa/clear-org` | Reset org data |
| POST | `/api/pmoa/fetch-web-intel` | Company web research |
| POST | `/api/pmoa/save-web-docs` | Store research docs |
| GET/POST/DELETE | `/api/pmoa/processes/[id]` | Process CRUD |

### Pay Groups (`/api/pay-groups/`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/pay-groups` | List groups |
| POST | `/api/pay-groups` | Create group |
| GET/PUT/DELETE | `/api/pay-groups/[id]` | Manage group |
| POST | `/api/pay-groups/[id]/members` | Add JD to group |
| POST | `/api/pay-groups/move` | Move JD between groups |

### Job Architecture (`/api/architecture/`)

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/architecture/families` | Job family management |
| GET/POST | `/api/architecture/slots` | Matrix slot management |
| GET/PUT/DELETE | `/api/architecture/slots/[id]` | Slot detail |

### Admin (`/api/admin/`)

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/admin/users` | User list/create |
| GET/PUT/DELETE | `/api/admin/users/[id]` | User detail |
| GET/POST | `/api/admin/orgs` | Org list/create |
| GET/PUT/DELETE | `/api/admin/orgs/[id]` | Org detail |
| GET/POST | `/api/admin/access-codes` | Invite codes |
| DELETE | `/api/admin/access-codes/[id]` | Revoke code |
| GET | `/api/admin/jds` | Global JD registry |
| POST | `/api/admin/jds/[id]/checkout` | Create snapshot |
| POST | `/api/admin/jds/[id]/checkin` | Verify against snapshot |

### Utilities

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/lint` | JD quality linting |
| POST | `/api/rewrite` | Content rewrite |
| POST | `/api/euptd-readiness` | Submit self-assessment |
| POST | `/api/euptd-readiness/export` | Export readiness report |
| GET/POST | `/api/templates` | Template library |
| POST | `/api/templates/[id]/duplicate` | Clone template |
| GET/POST | `/api/jobs/search` | Job board search |
| POST | `/api/jobs/scrape` | Job board scraper |
| POST | `/api/companion/requests` | Save companion interactions |
| POST | `/api/v5/bias-check` | Bias scan (v5 engine) |
| GET | `/api/v5/policy-packs` | Policy pack listing |

---

## 9. Key Libraries & Modules

### `lib/ai/call-ai.ts` — Central AI Wrapper

Every LLM call goes through `callAi()`. It:
1. Resolves `modelTier` → `modelId` from `MODEL_REGISTRY`
2. Estimates input tokens (4 chars/token heuristic)
3. Calls Anthropic Claude API
4. On response: inserts to `AiUsageLog` with actual token counts + cost
5. Returns `{ text, inputTokens, outputTokens, estimatedCostUsd, durationMs, cacheStatus }`

### `lib/ai/model-registry.ts` — Model & Pricing Registry

Maps tiers (`haiku`, `sonnet`, `opus`, `embedding`, `deterministic`) to model IDs and per-token pricing. Pricing baked in at call time.

### `lib/bias/` — Bias Detection Engine

- `engine.ts`: Scans JD text for bias signals (gender-coded language, age proxies, nationality markers)
- `engine-with-packs.ts`: Applies configurable policy packs
- `policy-packs.ts`: Policy rule definitions (regulatory frameworks)
- `lexicon/`: Bias term dictionaries

### `lib/sources/` — ATS & Job Board Connectors

Connector registry pattern:
- `registry.ts` detects URL/type → routes to the right connector
- Connectors: `greenhouse.ts`, `ashby.ts`, `lever.ts`, `smartrecruiters.ts`, `adzuna.ts`, `schema-org.ts`, `generic-html.ts`
- All output normalised `ImportedJobPosting` shape
- `jd-readiness.ts`: Scores imported posting vs JD quality gates

### `lib/export/` — Export Formats

- `formats.ts`: PDF, DOCX, TXT, Markdown
- `canvas-export.ts`: HTML → PNG/JPG (html-to-image)
- `data-export.ts`: CSV/JSON
- `page-format.ts`: Print layout specs

### `lib/lint/` — JD Linting

Rule-based quality checking — flags missing fields, thin descriptions, passive voice, vague language.

### `lib/admin/rate-limit.ts` — Rate Limiting

Cross-instance (DB-backed). Key format: `login:{ip}`. Returns `{ ok, remaining, resetAt }`.

### `lib/feature-flags.ts` — Feature Toggles

Boolean constants. All new features default `false` — safe to ship without activating.

---

## 10. Axiomera Engine

The Axiomera Engine is the core analytical job evaluation framework. It operates on three primary factors and one supplemental factor.

### Weights

| Factor | Weight | Range |
|--------|--------|-------|
| R — Responsibility | 47.2% | 140–635 pts |
| S — Skills | 33.3% | 50–333 pts |
| E — Effort | 19.5% | variable |
| WC — Working Conditions | supplemental | 50–350 pts |

### Factor Definitions

**R — Responsibility**
- Evaluated across 9 zones of increasing impact
- Evidence-based: every zone assignment includes quoted text and confidence score
- Key hypothesis set: `H-R-*` (accountability breadth, resource scope, strategic influence)

**S — Skills**
- Levels S1–S5 (anchored to ISCO-08 major group 2)
- Inputs: formal education, occupational experience, ESCO competences, ISCO code
- S1 baseline = sPkt / 333

**E — Effort**
- Three sub-scores: cognitive, emotional, physical
- Each scored 0.0–1.0 then combined into `eScore`
- Covers: problem complexity, decision autonomy, interpersonal load, physical demands

**WC — Working Conditions**
- Levels W1–W5
- Not part of RSE composite; feeds separate compensation factor

### Outputs

```typescript
{
  totalRSE: number,   // R + S + E composite
  grade: number,      // 0–20 scale
  band: string,       // "A1" | "A2" | ... | "E5"
  ciGlobal: number,   // 0.0–1.0 confidence
  contradictionFlag: boolean,
  needsReview: boolean,
}
```

### Validation Gates

- `H1`: Consistency of R zone vs stated responsibility level
- `H2`: S level vs formal qualification evidence
- `H3`: E cognitive vs decision autonomy consistency
- `H4`: Overall internal contradiction check

### Hypothesis Records

Every `AxiomeraRun` stores `RHypothesisRecord[]` and `EHypothesisRecord[]` — the exact hypotheses tested, their verdicts, evidence quotes, and confidence values. This enables full explainability (no black box).

### Quality Gate: JDQ Layer

Lightweight pre-evaluation quality assessment:
- `structureCoverage`: Required fields present
- `languageScore`: Clarity, active voice, specificity
- `factorsScore`: R/S/E factors sufficiently described
- `decisionScore`: Decision authority unambiguous
- `composite`: Overall JDQ score → traffic-light indicator

### Running Axiomera

```
POST /api/jd/[id]/axiomera
Response: AxiomeraRun (full breakdown)
```

Feature flag: `ENABLE_AXIOMERA_ENGINE` (default OFF — shadow mode).

---

## 11. Job Sources Intelligence

### Connector Types

| Connector | Auth Method | Data Source |
|-----------|------------|-------------|
| Greenhouse | API key | Official API |
| Ashby | Posting API | Official API |
| Lever | API key | Official API |
| SmartRecruiters | API | Official API |
| Adzuna | App ID + key | Search API |
| Schema.org | — | JSON-LD parsing |
| Generic HTML | — | HTML scraping |

### Import Pipeline

```
URL / API config
    ↓
preflight() — auth test
    ↓
discover() — find postings
    ↓
normalise() — → ImportedJobPosting
    ↓
dedup (content hash)
    ↓
store → SourceRun + ImportedJobPosting
    ↓
analyse-readiness → JDEvaluationReadinessRecord
```

### Org Inference

`/api/sources/org-inference` — passes normalised postings to Claude, returns `OrgNode[]` + `OrgEdge[]` representing inferred org structure (departments, teams, reporting lines).

### Extra Context

`/api/sources/extra-context` — fetches and scores company context (IR pages, news, annual reports) with `relevanceToJd` + `riskLevel` ratings.

---

## 12. PMOA Module

Process Mapping & Org Architecture — lets users upload documents and extract structured org/process data.

### Document Ingestion

1. Upload file (PDF/DOCX/image) → `PmoaDocument`
2. Parse: OCR confidence scored, `parseStatus` tracked
3. Validity flagged: `recent | stale` based on embedded date

### Org Extraction

```
PmoaDocument(s)
    ↓ POST /api/pmoa/build-org (Claude Vision)
    ↓
PmoaDepartment[] (hierarchy)
PmoaPosition[] (roles, reportsToId, spanOfControl)
PmoaAssignment[] (person ↔ position, splitAllocations)
```

### Process Extraction

```
PmoaDocument(s) + org context
    ↓ POST /api/pmoa/build-processes
    ↓
PmoaProcess[] (BPMN-compatible)
PmoaProcessStep[] (actor, SLA, outgoing edges)
PmoaRasciCell[] (step × position/role RASCI assignments)
```

### Governance Issues

`PmoaIssue`: auto-detected or manually raised governance findings (severity, kind, status, assignee).

### Org-Structure Extractor Tests

Unit test suite in `lib/org-structure/extract.test.ts` against PGE ground truth:
- Recall ≥ 95%, Precision ≥ 95%, Parent Accuracy ≥ 90%
- Polish character preservation
- Exact abbreviation code matching
- Hierarchy nesting validation

---

## 13. Audio / Sonification

### Purpose

Cross-device document transfer via FSK (Frequency-Shift Keying) audio encoding. Useful in environments where copy-paste or QR scanning is not viable.

### Components

| File | Purpose |
|------|---------|
| `lib/studio/engine.ts` | Audio synthesis engine |
| `lib/studio/fsk.ts` | FSK modulation/demodulation |
| `lib/studio/themes.ts` | Audio theme configs |
| `/studio` | Main studio interface |
| `/studio/ensemble` | Multi-sample playback |
| `/studio/library` | Sound library |
| `/sonification/receiver` | Cross-device receiver (no auth) |

### Sonic Review

`/api/ai/sonic-review` — accepts audio transcript, analyses content quality via Claude, returns structured review. Useful for voice-dictated JD content.

---

## 14. Feature Flags

All flags live in `apps/web/lib/feature-flags.ts`. All default `false`.

### Phase 1 — Axiomera

| Flag | Default | Purpose |
|------|---------|---------|
| `ENABLE_AXIOMERA_ENGINE` | false | Enable R/S/E/WC scoring |
| `ENABLE_AXIOMERA_SHADOW_MODE` | true (when engine ON) | Hide from non-admins |
| `ENABLE_JDQ_LAYER` | false | Quality pre-check |
| `ENABLE_R_E_HYPOTHESES_PANEL` | false | Hypothesis drill-down UI |

### Phase 2 — Governance

| Flag | Default | Purpose |
|------|---------|---------|
| `ENABLE_SEALED_PROGRAMS` | false | Sealed evaluation programs |
| `ENABLE_APPROVAL_WORKFLOW` | false | Multi-stage approval |
| `ENABLE_KRYSTYNA_RENAME` | false | Krystyna audio assistant |

### Phase 3 — Readiness

| Flag | Default | Purpose |
|------|---------|---------|
| `ENABLE_PPTX_EXPORT` | false | PowerPoint export |
| `ENABLE_INTAKE_CHECKLIST` | false | Onboarding checklist |
| `ENABLE_JD_PROJECT_READINESS` | false | Readiness self-assessment |

### Phase 4+ — Future

| Flag | Purpose |
|------|---------|
| `ENABLE_METHOD_MATRIX` | Job evaluation method matrix |
| `ENABLE_SPEC_DASHBOARD` | Specification dashboard |
| `ENABLE_FAMILY_DIAGNOSTICS` | Family-level diagnostics |
| `ENABLE_INTERNAL_REGULATIONS` | EU regulation tracking |
| `ENABLE_COST_DASHBOARD` | Cost analysis dashboard |
| `ENABLE_AI_RESPONSE_CACHE` | AI response caching |

---

## 15. Environment Variables

### Required (Production + Preview)

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | NextAuth JWT signing secret (32+ random bytes) |
| `DATABASE_URL` | PostgreSQL connection string (Neon pooled) |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |

### Optional

| Variable | Purpose |
|----------|---------|
| `AUTH_URL` | Override canonical URL (useful for preview→prod OAuth redirect) |
| `NEXTAUTH_URL` | Legacy (Auth.js v5 uses `AUTH_URL`) |
| `DIRECT_URL` | Non-pooled connection (Prisma migrations) |
| `RESEND_API_KEY` | Transactional email (magic link, reset) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (file storage) |
| `UPSTASH_REDIS_REST_URL` | Redis (optional alternative rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth |

### ATS Connectors (optional, per-org stored in DB)

Connector credentials (`GREENHOUSE_API_KEY`, `ASHBY_API_KEY`, etc.) are stored per `SourceConnection` row — not global env vars.

---

## 16. Development Guide

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL (or Neon account)

### Setup

```bash
git clone https://github.com/tomrey81/jd-suite-ultra.git
cd jd-suite-ultra
pnpm install

# Copy env template
cp .env.example .env.local
# Fill in: DATABASE_URL, AUTH_SECRET, ANTHROPIC_API_KEY

# Push schema + seed
pnpm db:push
pnpm db:seed

# Start dev server
pnpm dev
```

### Dev Commands

```bash
pnpm dev              # Start Next.js (Turbopack) on :3000
pnpm build            # Production build
pnpm test             # Vitest unit tests
pnpm test:golden      # Golden tests (Axiomera)
pnpm test:e2e         # Playwright E2E
pnpm typecheck        # tsc --noEmit
pnpm lint             # ESLint
pnpm db:studio        # Prisma Studio (DB GUI)
pnpm db:migrate:dev   # Create migration
pnpm db:generate      # Regenerate Prisma client
```

### Workspace Scripts (root)

```bash
pnpm --filter web dev
pnpm --filter @jd-suite/db generate
```

### Adding a Feature Flag

1. Add constant to `apps/web/lib/feature-flags.ts`
2. Default to `false`
3. Guard behind `if (ENABLE_MY_FEATURE)` at the call site
4. Document in this file under Feature Flags

### Adding an AI Operation

1. Create route in `app/api/ai/my-op/route.ts`
2. Parse + validate input with Zod
3. Call `callAi({ operation: 'my-op', modelTier: 'sonnet', ... })`
4. Add operation string to `lib/ai/prompt-versions.ts`
5. AiUsageLog entry is automatic

---

## 17. Deployment

### Production

```bash
vercel deploy --prod
```

Deploys to `jd-suite-ultra.vercel.app` (project `prj_YCP0jUZqt8WESwnwneogRgcjA5sq`).

### Preview

```bash
vercel deploy
```

Each preview gets a unique URL. Required env vars must be scoped to `preview` in Vercel Dashboard.

### Vercel Environment Variables

Go to: `vercel.com → tomrey81s-projects → jd-suite-ultra → Settings → Environment Variables`

Ensure `AUTH_SECRET`, `DATABASE_URL`, `ANTHROPIC_API_KEY` are checked for **both Production and Preview**.

### HOME-Link Trap Warning

Vercel CLI reads `~/.vercel/project.json` if present — this can hijack deploys from any directory. Before deploying:

```bash
cat .vercel/project.json          # Must show jd-suite-ultra
cat ~/.vercel/project.json        # If exists, DELETE it before deploying
rm ~/.vercel/project.json         # Safe to remove — re-linked on next vercel link
vercel deploy --prod
```

Always verify the returned production URL matches `jd-suite-ultra.vercel.app`.

### Database Migrations

```bash
# Development
pnpm db:migrate:dev --name descriptive-name

# Production (runs in CI or manually)
pnpm db:migrate:deploy
```

Never run `db:push` in production — use migrations.

---

## 18. Additional Documents

| Document | Location | Purpose |
|----------|----------|---------|
| Technical Audit | [docs/AUDIT.md](docs/AUDIT.md) | Gap analysis, bottlenecks, bugs, fix recommendations |
| Known Issues | [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) | Prioritised bug & tech debt tracker |
| Security Model | [docs/SECURITY.md](docs/SECURITY.md) | Auth flows, middleware limitations, GDPR |
| Operations Runbook | [docs/RUNBOOK.md](docs/RUNBOOK.md) | Deploy, rollback, DB migrations, incident response |
| AI Cost Model | [docs/AI_COST_MODEL.md](docs/AI_COST_MODEL.md) | Model registry, cost per operation, AiUsageLog queries |
| Data Model | [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Entity relationships, indexing, tenant isolation |
| Connector Guide | [docs/CONNECTOR_GUIDE.md](docs/CONNECTOR_GUIDE.md) | How to add new ATS connectors |
| API Error Reference | [docs/API_ERRORS.md](docs/API_ERRORS.md) | HTTP status codes, error shapes, error codes |

---

## 19. Known Issues Summary

See [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) for the full tracker. Critical items:

| Issue | Severity | Fix |
|-------|----------|-----|
| Embedding tiers reference OpenAI models — no OpenAI provider exists | CRITICAL | Remove or implement |
| Admin routes not enforced at middleware level | CRITICAL | Add isPlatformAdmin JWT claim check |
| AiUsageLog missing orgId — no per-tenant cost attribution | HIGH | Schema migration |
| Axiomera maxTokens=3000 may truncate 45-hypothesis JSON | HIGH | Set maxTokens=12000 for extractE |
| No retry on transient Anthropic HTTP errors (429/529) | HIGH | Add exponential backoff |
| No per-call timeout on Axiomera — Vercel 60s limit risk | HIGH | Add AbortController with 50s guard |
| RateLimitBucket.key lacks unique constraint | HIGH | Schema migration |
| No rate limit on /api/auth/forgot-password | HIGH | Add checkRateLimit call |

---

*Last updated: 2026-05-10. For questions, see `apps/web/lib/` source or raise a GitHub issue.*
