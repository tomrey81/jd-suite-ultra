# Current Technical State — JD Suite Ultra

**Date:** 2026-05-02
**Branch:** claude/angry-matsumoto
**Auditor:** Claude Code (automated + manual review)
**Readiness score:** 7/10

---

## Architecture Overview

pnpm monorepo with three packages and one Next.js 15 app.

```
/
├── apps/web/           Next.js 15.5 (main product — all routes, all UI)
├── packages/db/        @jd-suite/db — Prisma 6.2 + Neon PostgreSQL
├── packages/types/     @jd-suite/types — shared TypeScript types
└── package.json        Root workspace (scripts route to apps/web)
```

**Key stack:**
- Next.js 15.5 App Router + Turbopack
- TypeScript strict mode
- Tailwind CSS 4 + PostCSS
- NextAuth v4 (Credentials provider + magic links)
- Prisma 6.2 (Neon serverless PostgreSQL)
- next-intl 3.25 (i18n, 9 locales)
- Claude API via custom `callAi()` wrapper

---

## Existing Modules

| Module | Files | Status |
|--------|-------|--------|
| Authentication | `lib/auth.ts`, `middleware.ts`, `api/auth/*` | WORKING |
| Dashboard / JD Hub | `app/(dashboard)/`, `components/workspace/` | WORKING |
| JD editor | `app/(dashboard)/jd/[id]/studio/` | WORKING |
| Krystyna AI companion | `components/ai/ai-companion.tsx`, `api/ai/companion/` | WORKING |
| Voice input | `components/voice/voice-input.tsx` | WORKING (mic blocked by header) |
| Axiomera engine | `lib/axiomera/` | WORKING |
| JDQ engine | `lib/jdq/` | WORKING |
| Org / PMOA | `app/(dashboard)/pmoa/`, `api/pmoa/` | WORKING |
| Pay groups | `app/(dashboard)/pay-groups/`, `api/pay-groups/` | WORKING |
| EUPTD readiness | `app/(dashboard)/euptd-readiness/` | WORKING |
| Job architecture | `app/(dashboard)/architecture/` | WORKING |
| Sonification studio | `app/(dashboard)/studio/`, `lib/studio/` | PARTIAL (no audio gen) |
| Notion integration | `lib/notion/sync.ts` | PARTIAL (credentials client-side) |
| Settings | `components/settings/settings-view.tsx` | PARTIAL (missing companion settings) |
| i18n | `i18n/request.ts`, `messages/*.json` | WORKING (not per-user persistent) |
| Golden fixtures | `lib/golden/` | PARTIAL (fixture file missing) |
| Admin panel | `app/admin/` | WORKING |

---

## Current Functionality

**Fully working:**
- 73 page routes, 63 API routes
- NextAuth credentials + magic link + password reset
- JD create / edit / version / export (PDF, DOCX, JSON)
- AI field generation, AI companion chat, AI evaluation
- Axiomera R/S/E/WC evaluation engine
- JDQ quality scoring
- Pay groups (EUPTD Art. 4)
- EUPTD readiness self-assessment
- PMOA org chart + process maps
- Job architecture matrix
- 9-language interface (next-intl cookie-based)
- Voice input (Web Speech API) — blocked by header, see bugs

**Partially working:**
- Sonification studio — routes exist, no Web Audio API calls found
- Notion sync — functional but stores credentials in localStorage (security risk)
- Golden test harness — infra complete, fixture file not present

---

## Missing Functionality

| Feature | Gap | Priority |
|---------|-----|----------|
| Microphone permission | `Permissions-Policy: microphone=()` blocks voice | P0 |
| Companion personalisation | Name and avatar hardcoded in component | P1 |
| User language persistence | Locale is cookie-only, not per-user in DB | P2 |
| Saved user requests | No schema or API for request history | P3 |
| Notion server-side storage | Token in localStorage, not DB | P3 |
| Playwright E2E config | `playwright.config.ts` missing | P3 |
| Audio generation | Sonification has no synthesis implementation | P4 |
| Golden fixture file | Expected at `~/Desktop/jd-suite-golden/golden-jd-fixtures.json` | P3 |

---

## Fragile / Unfinished Areas

1. **`app/(dashboard)/layout.tsx` line 6**: `const user = { id: 'bypass', … }` — hardcoded demo user. Header receives a static object; session is bypassed for display purposes only. API routes use real session from `getSession()`.

2. **`lib/get-session.ts`**: Explicitly marked `TEMPORARY BYPASS` — returns first DB user for all requests. Production auth is not wired.

3. **`lib/notion/sync.ts`**: Calls a user-supplied Cloudflare Worker URL with a Notion token. Both are stored in localStorage. Worker URL is not validated server-side — potential open redirect.

4. **`components/settings/settings-view.tsx` line 46**: `notionParentPageId` has a hardcoded default UUID `3378b054-c583-8157-826a-ce436e4194c7` belonging to a specific Notion workspace.

---

## Known Technical Risks

| Risk | Severity | File |
|------|----------|------|
| `microphone=()` Permissions-Policy blocks voice input | HIGH | `next.config.ts:21` |
| Notion token in localStorage | HIGH | `lib/notion/sync.ts`, `settings-view.tsx` |
| Hardcoded demo user in layout | MEDIUM | `app/(dashboard)/layout.tsx:6` |
| `getSession()` returns first DB user (bypass) | MEDIUM | `lib/get-session.ts` |
| Notion parent page ID hardcoded | MEDIUM | `settings-view.tsx:46` |
| Sonification advertised but not implemented | MEDIUM | `lib/studio/engine.ts` |
| Language preference not per-user in DB | LOW | `i18n/request.ts` |
| Companion name/avatar hardcoded | LOW | `components/ai/ai-companion.tsx` |

---

## Recommended Cleanup Areas

- Remove `TEMPORARY BYPASS` comment from `get-session.ts` once real auth is wired
- Remove hardcoded default Notion page ID
- Move Notion token to DB or encrypted server-side store
- Add `User.preferredLanguage` to Prisma schema for persistent locale
- Create `playwright.config.ts` for E2E test coverage
- Populate golden fixture file to enable G-7 test harness

---

## Files Reviewed

```
apps/web/next.config.ts
apps/web/tsconfig.json
apps/web/vitest.config.ts
apps/web/middleware.ts
apps/web/i18n/request.ts
apps/web/lib/auth.ts
apps/web/lib/get-session.ts
apps/web/lib/ai.ts
apps/web/lib/ai/call-ai.ts
apps/web/lib/notion/sync.ts
apps/web/lib/axiomera/ (all files)
apps/web/lib/golden/ (all files)
apps/web/app/(dashboard)/layout.tsx
apps/web/app/(dashboard)/page.tsx
apps/web/app/api/ai/companion/route.ts
apps/web/components/ai/ai-companion.tsx
apps/web/components/voice/voice-input.tsx
apps/web/components/settings/settings-view.tsx
apps/web/components/layout/hub-nav.tsx
apps/web/components/layout/sidebar.tsx
packages/db/prisma/schema.prisma (1096 lines)
```

---

## Readiness Score: 7/10

Strong foundation with comprehensive schema, working AI features, and solid security architecture. Primary gaps are a critical header bug blocking voice input, missing companion personalisation, and non-persistent language preference.
