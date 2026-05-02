# Phase 3 Scope Definition

**Date:** 2026-05-02
**Status:** Approved for implementation

---

## Workstream A — Audio / Voice Fix (CRITICAL)

**Problem:** `Permissions-Policy: microphone=()` in `next.config.ts` blocks the browser from ever requesting microphone permission. Voice input in both Krystyna and VoiceInput component is silently broken.

**Change:**
```ts
// next.config.ts — line 21
// Before:
{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
// After:
{ key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' }
```

**File:** `apps/web/next.config.ts`
**Impact:** Unblocks voice input on all routes for the page's own origin.

---

## Workstream B — Dashboard Layout Auth Fix

**Problem:** `app/(dashboard)/layout.tsx` passes a hardcoded `{ id: 'bypass', email: 'demo@quadrance.app', name: 'Demo User' }` to the Header. This is misleading — it always shows "Demo User" regardless of who is logged in.

**Change:** Make the layout async and call `getSession()` to get the real user. `getSession()` already exists and returns the first DB user (acceptable bypass for now).

**File:** `apps/web/app/(dashboard)/layout.tsx`

---

## Workstream C — AI Companion Personalisation

**Scope:**
1. Extend `GovSettings` with `companionName: string` (default: `'Krystyna'`) and `companionAvatar: string` (default: `'default'`)
2. Add "Companion" tab to Settings panel with:
   - Name input field
   - Avatar gallery (4 prebuilt options + custom upload)
3. Update `AICompanion` component to:
   - Read companion settings from localStorage on mount
   - Replace all hardcoded `"Krystyna"` strings with dynamic name
   - Render custom avatar (image) or prebuilt SVG based on setting

**Prebuilt avatar options:**
- `'default'` — Krystyna (existing SVG, unchanged)
- `'assistant'` — neutral robot face SVG
- `'advisor'` — owl/wise character SVG
- `'analyst'` — abstract data character SVG

**Custom upload:**
- Accept: `image/png`, `image/jpeg`, `image/webp`
- Max size: 512KB (validated before storing)
- Stored as base64 data URL in localStorage
- Displayed in circle crop (same size as Krystyna avatar)

**Files:**
- `apps/web/components/settings/settings-view.tsx`
- `apps/web/components/ai/ai-companion.tsx`

---

## Workstream D — Localization (No code needed)

next-intl is already configured. Language switcher works. Settings has a language tile grid. Krystyna receives locale in context.

**No code changes required for Phase 3.** Document that language switching works via Settings → General → Application language.

---

## Out of Scope for Phase 3

| Item | Reason | Next phase |
|------|---------|-----------|
| Notion credentials to DB | Requires Prisma migration + server-side encryption | Phase 4 |
| User.preferredLanguage schema field | Requires Prisma migration | Phase 4 |
| Saved user requests | Requires schema + API + UI | Phase 4 |
| Sonification audio generation | Large separate feature | Phase 5 |
| Playwright E2E config | Infrastructure-only, no user value | Phase 4 |
| Golden fixture data | Requires human review time | Phase 4 |
| Real NextAuth session | Requires auth provider setup | Phase 4 |

---

## Implementation Rules (Phase 3)

1. Inspect before editing — read every file before changing it
2. No new npm packages
3. No Prisma schema changes
4. Keep localStorage as storage for companion settings (consistent with existing pattern)
5. TypeScript must stay clean after changes
6. 44/44 vitest must still pass
7. No changes to Axiomera engine, JDQ, or API routes
