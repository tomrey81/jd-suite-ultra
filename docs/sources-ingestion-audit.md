# Sources Ingestion — Audit Report

> Completed: 2026-05-03

---

## Executive Summary

The Sources module had a functional but nascent (~40%) implementation built around two capabilities:
1. **Adzuna API** — REST API wrapper for job-board discovery
2. **Generic HTML scraper** — browser-like fetch + Claude AI extraction

This audit documents what existed, what was refactored, and what was added.

---

## What Existed (Before This Sprint)

### Pages
- `/sources` — two-tab UI: Adzuna search + career-page scraper

### API Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/jobs/search` | GET | Adzuna API wrapper |
| `/api/jobs/scrape` | POST | Career-page HTML → Claude job list |
| `/api/jobs/scrape-full` | POST | Single JD page → structured extraction → saved to JD Hub |

### Lib Files
- `lib/job-fetch.ts` — Browser-like HTTP fetcher with UA rotation, CAPTCHA detection
- No connector abstraction — each route had its own fetch logic

### Database
- No dedicated source models — scraped JDs went straight into `JobDescription` + `JDVersion`
- Source URL stored in `JDVersion.note` (e.g. "Scraped from ... on ...")

### Gaps Identified
| Gap | Risk | Impact |
|-----|------|--------|
| No URL deduplication | HIGH | Same JD imported multiple times |
| No connector abstraction | MEDIUM | Adding new sources required modifying routes |
| Adzuna = only "live" source | HIGH | Single point of failure for discovery |
| No schema.org / JSON-LD parser | MEDIUM | Missed high-quality structured data |
| No JD readiness scoring | HIGH | No way to assess evaluation suitability |
| No org structure inference | MEDIUM | No structured use of department/team data |
| Zero test coverage | HIGH | No regression safety net |
| No diagnostics taxonomy | MEDIUM | Unhelpful error messages |

---

## Adzuna Assessment

**Type**: Official REST API (not a scraper)
**Auth**: ADZUNA_APP_ID + ADZUNA_APP_KEY required
**Description quality**: Snippets only — Adzuna docs note descriptions may be truncated
**Usefulness**: Market discovery, salary signals, redirect URLs to employer sites
**Not suitable for**: Evaluation-grade JD extraction on its own

**Verdict**: Keep, but reframe as a *discovery + market context* tool. Route redirect URLs
to the direct-employer connector pipeline for full JD extraction.

---

## Security / Compliance Assessment

**What was safe:**
- Adzuna uses official API (no scraping)
- HTML scraper stops on 403/429/CAPTCHA
- No LinkedIn scraping attempted
- No candidate/profile data collected

**What needed fixing:**
- `lib/job-fetch.ts` used `Sec-Fetch-*` headers designed to appear browser-like.
  These headers were NOT used for evasion — they're standard browser headers
  that many CDNs check. Kept with an honest `User-Agent` string added to new connectors.
- No `robots.txt` check was implemented. New connectors (schema-org, generic-html)
  now include a diagnostic status for `ROBOTS_DISALLOWED`.

---

## What Was Added (This Sprint)

### Architecture
- `lib/sources/types.ts` — Full type system: SourceConnector interface, NormalizedJobPosting,
  JDEvaluationReadiness, OrgStructureSignal, SourceDiagnostics, ExtraContextItem
- `lib/sources/diagnostics.ts` — Diagnostic classification helpers
- `lib/sources/registry.ts` — Priority-ordered connector registry

### Connectors
| Connector | File | Priority | Auth |
|-----------|------|----------|------|
| Greenhouse Job Board API | `connectors/greenhouse.ts` | 1 (API) | None |
| Ashby Posting API | `connectors/ashby.ts` | 1 (API) | None |
| Adzuna API (refactored) | `connectors/adzuna.ts` | Aggregator | App ID + Key |
| schema.org JobPosting parser | `connectors/schema-org.ts` | 2 (structured) | None |
| Generic HTML (AI fallback) | `connectors/generic-html.ts` | 3 (fallback) | None |

### Intelligence Modules
- `lib/sources/jd-readiness.ts` — Claude-powered JD Evaluation Readiness scoring

### New API Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/sources/preflight` | GET | List available connectors |
| `/api/sources/preflight` | POST | Detect connector + run preflight checks |
| `/api/sources/discover` | POST | Discover postings via best connector |
| `/api/sources/analyse-readiness` | POST | Score JD against evaluation criteria |

---

## Compliance Boundaries

The following were intentionally NOT implemented:

| Feature | Reason |
|---------|--------|
| LinkedIn scraping | LinkedIn explicitly prohibits automation; status 999 is returned |
| CAPTCHA bypass | Illegal in many jurisdictions; ToS violation; not our architecture |
| Proxy rotation for evasion | Evasion of access controls is legally toxic |
| Fake accounts | Not implemented, never will be |
| Candidate/profile data | Not our data domain; privacy/GDPR risk |
| LinkedIn Premium visibility | Proprietary data; requires explicit permission |

---

## Known Limitations

1. **Prisma models not yet added** — Source connection tracking requires new DB tables
   (SourceConnection, SourceRun, ImportedJobPosting, JDEvaluationReadinessRecord).
   Schema additions are documented in `sources-ingestion-architecture.md`.

2. **Deduplication not enforced at DB level** — URL-hash dedup logic is in connectors;
   DB-level unique constraint needs migration.

3. **Org structure inference UI** — OrgStructureSignal extraction works in connectors;
   the graph visualisation and storage models are next-sprint scope.

4. **Rate limiting** — No per-user or per-source rate limits on scrape routes.

5. **Lever, Teamtailor, Workday, etc.** — Connector stubs planned; not yet implemented.
