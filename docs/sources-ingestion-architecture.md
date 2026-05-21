# Sources Ingestion — Architecture

> Version: 1.0 · 2026-05-03

---

## Core Principle

**This is a Source Intelligence Engine, not a scraper.**

Scrapers break. Evidence pipelines compound value.

- Official APIs first (Greenhouse, Ashby, Lever, Teamtailor…)
- Structured data second (schema.org JobPosting JSON-LD)
- HTML extraction only as a last resort, with honest diagnostics
- Never bypass access restrictions — classify them and recommend alternatives

---

## Layer Architecture

```
Input (URL / company name / search params)
         │
         ▼
   SourceConnector registry (detects best connector)
         │
         ▼
   Preflight (robots check, API availability, auth check)
         │
         ▼
   Discovery (list postings → RawPostingReference[])
         │
         ▼
   Fetch (get full content per posting → FetchResult)
         │
         ▼
   Normalize (structure → NormalizedJobPosting)
         │
         ▼
   Deduplication (hash check against existing imports)
         │
         ▼
   JD Evaluation Readiness (Claude scoring)
         │
         ▼
   Org Structure Signal extraction
         │
         ▼
   Persist (ImportedJobPosting + JDEvaluationReadiness + OrgSignals)
         │
         ▼
   Human review queue → approve → export / send to evaluation
```

---

## Connector Priority

| Priority | Type | Examples |
|----------|------|---------|
| 1 | Official API | Greenhouse, Ashby, Lever, Smartrecruiters |
| 2 | Structured data | schema.org JobPosting JSON-LD |
| 3 | HTML fallback | Public pages, user-pasted HTML |
| 4 | Aggregator | Adzuna (discovery + signals only) |
| 5 | User upload | CSV, PDF, DOCX, manual URL list |

---

## Connector Interface

```typescript
interface SourceConnector {
  id: string;
  name: string;
  sourceKind: SourceKind;

  canHandle(input: string): boolean;
  preflight(input: string): Promise<SourceDiagnostics>;
  discover(input: string, options?): Promise<DiscoverResult>;
  fetchPosting(ref: RawPostingReference): Promise<FetchResult>;
  normalize(ref, fetchResult): Promise<NormalizeResult>;
  extractOrgSignals(postings: NormalizedJobPosting[]): OrgStructureSignal[];
}
```

---

## Connector Registry

`lib/sources/registry.ts` — priority-ordered list:

```
Connectors (priority order):
  1. GreenhouseConnector    — boards-api.greenhouse.io/v1/boards/{token}
  2. AshbyConnector         — api.ashbyhq.com/posting-api/job-board
  3. AdzunaConnector        — api.adzuna.com/v1/api/jobs (aggregator)
  4. SchemaOrgConnector     — any public page with JSON-LD
  5. GenericHtmlConnector   — any public HTML (AI fallback)
```

Detection logic: `detectConnector(input)` → first matching `canHandle()` in priority order.
Override via `connectorId` parameter in API calls.

---

## Diagnostic Status Taxonomy

| Status | Meaning | User Action |
|--------|---------|------------|
| `OK` | Source accessible | Proceed |
| `LOGIN_REQUIRED` | Auth wall | Use API or upload export |
| `CAPTCHA_OR_BOT_CHALLENGE` | Bot challenge detected | Paste HTML manually or use API |
| `ROBOTS_DISALLOWED` | robots.txt blocks path | Use API or upload |
| `RATE_LIMITED` | 429 received | Wait; use official API |
| `API_KEY_REQUIRED` | Credentials missing | Configure in Settings |
| `UNSUPPORTED_ATS` | No connector matched | Use manual URL or upload |
| `JS_RENDER_REQUIRED` | SPA needs JavaScript | Paste HTML or use ATS API |
| `NETWORK_ERROR` | DNS/timeout | Check URL; retry |
| `PARSER_FAILED` | Extraction error | Try different URL or paste HTML |
| `NO_JOBS_FOUND` | Empty board | Verify URL; may be correct |
| `PARTIAL_EXTRACTION` | Snippets only (Adzuna) | Route to direct-employer URL |
| `LOW_CONFIDENCE_EXTRACTION` | Weak signals | HR validation recommended |

---

## JD Evaluation Readiness

Six minimum gradeability elements:

| Element | Good evidence looks like |
|---------|------------------------|
| Role purpose | "This role exists to..." or a clear mission statement |
| Top responsibilities | Numbered/bulleted accountabilities, not vague tasks |
| Decision rights | Budget authority, headcount approval, strategy sign-off |
| Scope of impact | FTEs managed, budget size, geography, customer impact |
| Reporting relationships | Explicit manager title and direct report count |
| Critical requirements | MUST-HAVE vs nice-to-have clearly separated |

Scoring: `evaluationReadinessScore` 0–100.
- >70: Evaluation-ready
- 40–70: Partial — HR clarification needed
- <40: Recruitment copy only — request structured JD template from HR

---

## Org Structure Inference

**Rule**: Never present inferred org structure as fact.
Label always: _"Draft org structure inferred from public job-source evidence."_

Evidence per node:
- Department name (from API structured field)
- Team name (from API structured field)
- Job title patterns (e.g. "Head of Engineering" → Engineering branch)
- Location (from posting)
- Seniority signals (title keywords)

Confidence levels:
- **High (>75)**: Official API field (Greenhouse department, Ashby team)
- **Medium (40-75)**: schema.org occupationalCategory
- **Low (<40)**: Inferred from title/URL patterns

Never infer:
- Named reporting relationships ("reports to Jane Smith") without direct source
- Headcount without evidence
- Salary or grade without stated data

---

## Planned Database Schema

```sql
-- Source connections (one per configured source)
CREATE TABLE source_connections (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL,
  source_name     TEXT NOT NULL,
  source_kind     TEXT NOT NULL,  -- enum: GREENHOUSE_API, ASHBY_POSTING_API, etc.
  config          JSONB,          -- { boardToken, country, query, etc. }
  status          TEXT DEFAULT 'ACTIVE',
  permission_status TEXT DEFAULT 'UNKNOWN',
  last_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Ingestion runs
CREATE TABLE source_runs (
  id                  TEXT PRIMARY KEY,
  source_connection_id TEXT REFERENCES source_connections(id),
  status              TEXT DEFAULT 'running',
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  finished_at         TIMESTAMPTZ,
  jobs_discovered     INT DEFAULT 0,
  jobs_fetched        INT DEFAULT 0,
  jobs_imported       INT DEFAULT 0,
  jobs_failed         INT DEFAULT 0,
  diagnostics_json    JSONB
);

-- Imported job postings (de-linked from JobDescription)
CREATE TABLE imported_job_postings (
  id                  TEXT PRIMARY KEY,
  org_id              TEXT NOT NULL,
  source_connection_id TEXT,
  source_run_id       TEXT,
  external_id         TEXT,
  canonical_url       TEXT,
  source_url          TEXT,
  company_name        TEXT,
  title               TEXT NOT NULL,
  normalized_title    TEXT,
  department          TEXT,
  team                TEXT,
  job_family          TEXT,
  job_level           TEXT,
  location            TEXT,
  country             TEXT,
  employment_type     TEXT,
  salary_min          DECIMAL(12,2),
  salary_max          DECIMAL(12,2),
  salary_currency     TEXT,
  date_posted         DATE,
  date_first_seen     TIMESTAMPTZ DEFAULT NOW(),
  description_raw     TEXT,
  description_clean   TEXT,
  content_hash        TEXT,
  source_kind         TEXT,
  confidence_score    INT,
  linked_jd_id        TEXT,  -- set when user saves to JD Hub
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, content_hash)  -- prevents duplicate imports
);

-- JD Evaluation Readiness records
CREATE TABLE jd_evaluation_readiness (
  id                          TEXT PRIMARY KEY,
  imported_job_posting_id     TEXT REFERENCES imported_job_postings(id),
  role_purpose_json           JSONB,
  top_responsibilities_json   JSONB,
  decision_rights_json        JSONB,
  scope_of_impact_json        JSONB,
  reporting_relationships_json JSONB,
  critical_requirements_json  JSONB,
  skills_evidence_json        JSONB,
  missing_evidence_json       JSONB,
  ambiguity_flags_json        JSONB,
  recruitment_copy_warning    BOOLEAN DEFAULT FALSE,
  evaluation_readiness_score  INT,
  confidence_score            INT,
  recommended_questions_json  JSONB,
  recommended_improvements_json JSONB,
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);
```

Add to Prisma schema (`packages/db/prisma/schema.prisma`):
```prisma
model SourceConnection { ... }
model SourceRun { ... }
model ImportedJobPosting { ... }
model JDEvaluationReadinessRecord { ... }
```

> Migration: run after adding models: `prisma migrate dev --name sources-intelligence`

---

## Connectors To Build (Next Sprint)

| Connector | API | Auth | Notes |
|-----------|-----|------|-------|
| Lever | lever.co/api/postings/{company} | None | Public postings API |
| Smartrecruiters | api.smartrecruiters.com/v1/companies/{id}/postings | None | Full JSON |
| Teamtailor | teamtailor.com/jobs.json | None | RSS/JSON feed |
| Workday | company.myworkday.com/api/apply/... | None | Complex JSON, varies by tenant |
| Generic sitemap | /sitemap.xml + job URL pattern | None | Discover job URLs from sitemap |

---

## API Routes Summary

| Route | Method | Connector layer |
|-------|--------|----------------|
| `/api/sources/preflight` | GET | List connectors |
| `/api/sources/preflight` | POST | Detect + preflight |
| `/api/sources/discover` | POST | Discover postings |
| `/api/sources/analyse-readiness` | POST | JD readiness scoring |
| `/api/jobs/search` | GET | Adzuna (legacy, kept) |
| `/api/jobs/scrape` | POST | Generic HTML (legacy, kept) |
| `/api/jobs/scrape-full` | POST | Full JD extract → JD Hub (legacy, kept) |
