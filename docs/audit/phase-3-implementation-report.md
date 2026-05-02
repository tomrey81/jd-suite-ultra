# Phase 3 Implementation Report

**Date:** 2026-05-02
**Branch:** claude/angry-matsumoto
**Author:** Claude Code

---

## Changes Made

### 1. Fix microphone Permissions-Policy (CRITICAL BUG FIX)

**File:** `apps/web/next.config.ts`

**Why:** The HTTP response header `Permissions-Policy: microphone=()` was telling browsers to deny all microphone access for this origin — including self. This silently blocked `SpeechRecognition.start()` before the user was ever asked for permission. Voice input in Krystyna and in `VoiceInput` component was completely non-functional.

**Change:**
```diff
- value: 'camera=(), microphone=(), geolocation=()'
+ value: 'camera=(), microphone=(self), geolocation=()'
```

`microphone=(self)` allows the page's own origin to request microphone permission. The browser will now prompt the user normally. Camera and geolocation remain blocked.

---

### 2. Fix hardcoded demo user in dashboard layout

**File:** `apps/web/app/(dashboard)/layout.tsx`

**Why:** The layout hardcoded `{ id: 'bypass', email: 'demo@quadrance.app', name: 'Demo User' }`, causing the Header to always show "Demo User" regardless of which account was logged in. This is confusing and incorrect once real users are active.

**Change:** Made the layout `async` and calls `getSession()` (existing helper) to read the real session user. Falls back to `{ id: 'guest', email: '', name: 'Guest' }` if session is unavailable.

Note: `getSession()` is still a bypass (returns first DB user) — this is a known Phase 4 item. The improvement here is that the displayed name now reflects the actual DB user, not a hardcoded constant.

---

### 3. AI Companion personalisation — Settings

**File:** `apps/web/components/settings/settings-view.tsx`

**Why:** The companion name "Krystyna" and its avatar were hardcoded. Users who work with multiple companies or prefer different branding could not personalise the companion.

**Changes:**
- Extended `GovSettings` interface with `companionName: string` (default `'Krystyna'`) and `companionAvatar: string` (default `'default'`)
- Added these fields to `DEFAULTS` constant
- Added "Companion" tab (between General and Integrations)
- Added `handleAvatarUpload` function with validation:
  - Accepts PNG, JPEG, WebP only
  - Max 512 KB
  - Stored as base64 `data:` URL under `custom:<dataURL>` key
  - Input resets after selection to allow re-upload of same file
- Tab renders:
  - Name input (max 32 chars, falls back to 'Krystyna' if cleared)
  - 4 preset avatar tiles (Krystyna, Assistant, Advisor, Analyst)
  - Custom upload button with preview + remove option
  - Error message for invalid type/size

---

### 4. AI Companion — dynamic name and avatar

**File:** `apps/web/components/ai/ai-companion.tsx`

**Why:** The companion component had "Krystyna" hardcoded in 8 places and always rendered the Krystyna SVG. Settings changes had no effect on the companion panel.

**Changes:**
- Added `loadCompanionSettings()` utility (reads `jdgc_settings` key, same as Settings panel)
- Added `CompanionAvatar` component that renders:
  - `'default'` → existing `KrystynaAvatar` SVG (unchanged)
  - `'assistant'` → robot face SVG
  - `'advisor'` → owl face SVG
  - `'analyst'` → analyst character SVG
  - `'custom:<dataURL>'` → `<img>` in circle crop with error fallback
- Added `companionName` and `companionAvatar` state (loaded in mount `useEffect`)
- Replaced all 7 hardcoded "Krystyna" string references with `{companionName}`
- Replaced all `KrystynaAvatar` usages in the panel with `CompanionAvatar`
- Launcher button `aria-label` and `title` are now dynamic

---

## Files Modified

| File | Change |
|------|--------|
| `apps/web/next.config.ts` | Fix `Permissions-Policy` to allow `microphone=(self)` |
| `apps/web/app/(dashboard)/layout.tsx` | Use `getSession()` instead of hardcoded user |
| `apps/web/components/settings/settings-view.tsx` | Add `companionName`, `companionAvatar`, Companion tab |
| `apps/web/components/ai/ai-companion.tsx` | Dynamic name/avatar from settings |

## Files Created (Documentation)

| File | Purpose |
|------|---------|
| `docs/audit/current-technical-state.md` | Full repo technical audit |
| `docs/audit/phase-status-review.md` | Phase completion comparison |
| `docs/audit/pre-phase-3-risk-review.md` | Risk review before Phase 3 |
| `docs/audit/phase-3-scope.md` | Phase 3 scope definition |
| `docs/audit/phase-3-implementation-report.md` | This file |
| `docs/audit/phase-3-test-report.md` | Test results |

---

## New Environment Variables Required

None. All Phase 3 changes use existing infrastructure (localStorage, existing API routes).

---

## Known Limitations

1. **Companion settings are per-browser.** `companionName` and `companionAvatar` are stored in `localStorage`. If the user logs in from a different browser, settings reset. Persistent per-user storage requires a Prisma schema migration (Phase 4).

2. **getSession() is still a bypass.** Real NextAuth session wiring is Phase 4. The improvement is that the displayed name now comes from the DB user, not a hardcoded constant.

3. **Notion token remains in localStorage.** Moving it to the DB is Phase 4 (requires schema migration + server-side encryption).

4. **Sonification audio generation not implemented.** Routes exist; no Web Audio API calls found. Phase 5.

5. **Custom avatar base64 size.** A 512 KB image stored as base64 uses ~680 KB in localStorage. This is safe for most browsers (5–10 MB quota) but advising small images in the UI copy would help.

---

## Remaining Risks

| Risk | Severity | Phase |
|------|----------|-------|
| getSession() bypass returns first DB user | MEDIUM | Phase 4 |
| Notion token in localStorage | HIGH | Phase 4 |
| Language preference not persisted per user | LOW | Phase 4 |
| Sonification advertised but non-functional | MEDIUM | Phase 5 |

---

## Recommended Phase 4 Work

1. Wire real NextAuth session in `getSession()` (remove bypass)
2. Add `User.preferredLanguage` to Prisma schema + sync on Settings save
3. Move Notion token to Prisma `User.notionToken` (encrypted at rest)
4. Add `User.companionName` + `User.companionAvatar` fields to schema
5. Create `playwright.config.ts` for E2E tests
6. Populate golden fixture file for G-7 harness
7. Add M2.4 admin hypothesis consolidation view (PRO_V5_ITEM_MAP)
