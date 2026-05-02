# Pre-Phase 3 Risk Review

**Date:** 2026-05-02

---

## 1. Architecture

| Check | Status | Notes |
|-------|--------|-------|
| AI features isolated from core app logic | ✅ | `lib/ai/`, `lib/axiomera/`, `lib/jdq/` are separate from UI |
| Dashboard components reusable | ✅ | `WorkspaceView` is a standalone component |
| Settings centralised | ✅ | `components/settings/settings-view.tsx` + localStorage |
| Clear place for integrations | ✅ | `lib/notion/`, `lib/ai/` — pattern established |
| Modules cleanly separated | ✅ | No circular imports found |

**Risk:** LOW

---

## 2. Data Model

| Check | Status | Risk |
|-------|--------|------|
| Users can save requests | ❌ No schema field | MEDIUM |
| JDs can be linked and retrieved | ✅ Via `jdId` on AiUsageLog + AxiomeraRun | LOW |
| User preferences structure | ⚠️ `Organisation.settings` JSON blob only | MEDIUM |
| AI companion name | ❌ No DB field (localStorage approach acceptable for Phase 3) | LOW |
| AI companion avatar | ❌ No DB field (localStorage approach acceptable for Phase 3) | LOW |
| Language preference | ⚠️ Cookie only — no `User.preferredLanguage` | MEDIUM |
| Notion connection metadata | ❌ localStorage only — HIGH security risk in long term | HIGH |

**Decision for Phase 3:** Use localStorage for companion settings (name, avatar). This matches the existing settings pattern and avoids a Prisma migration. Document DB migration as Phase 4.

---

## 3. Krystyna AI Companion

| Check | Status |
|-------|--------|
| Chat flow works | ✅ Verified live |
| Context preserved within session | ✅ sessionStorage (last 20 messages) |
| Can link to existing JDs | ⚠️ Receives `selectedJD` context but doesn't generate href links |
| Can use internal JD data | ✅ Via `selectedJD` context object in API call |
| Can use golden dataset logic | ❌ Golden fixture data not in Krystyna prompt |
| Voice input works | ❌ Blocked by `Permissions-Policy: microphone=()` header |
| Microphone permissions handled | ❌ Header-level block — browser never requests permission |
| Errors visible to user | ✅ Error state with code shown in panel |

---

## 4. Audio Recording — Detailed Verification

### Web Speech API (used in Krystyna + VoiceInput)
**Implementation:** `SpeechRecognition` / `webkitSpeechRecognition`
**This is NOT MediaRecorder** — it uses browser's built-in speech-to-text. No audio blob is created. The browser converts speech to text internally.

### Critical Bug Found
**File:** `apps/web/next.config.ts`, line 21
```ts
{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
```

This HTTP response header tells the browser:
- `camera=()` — deny camera to all origins including self
- `microphone=()` — **deny microphone to all origins including self**
- `geolocation=()` — deny geolocation to all origins including self

**Effect:** When `SpeechRecognition.start()` is called, the browser checks the Permissions Policy before requesting user permission. Because `microphone=()` is set, the browser **silently fails or throws a `not-allowed` error** without ever prompting the user.

**Fix:** Change to `microphone=(self)` to allow the page's own origin to request microphone access.

### Recording State Machine (VoiceInput component)
```
idle → [click Start] → permission request → recording → [click Stop] → transcript
                     → error (not-allowed / aborted / network)
```
**States covered:** idle, recording, error — all handled in `voice-input.tsx`
**Missing:** No explicit "requesting permission" state (user sees nothing between click and recording)

### Browser Compatibility
- Chrome/Edge: ✅ Full SpeechRecognition support
- Firefox: ⚠️ `webkitSpeechRecognition` not supported — falls back to text input
- Safari 15+: ✅ `webkitSpeechRecognition` supported
- Mobile Chrome: ✅ Supported
- Mobile Safari: ✅ Supported (iOS 14.5+)

### Privacy Note
- Current: "Audio is processed by your browser. Only the transcript is stored after you confirm." ✅ Present in VoiceInput
- Krystyna panel: No privacy note for voice button — should add one

### Error Handling
- `not-allowed` error: Shown as `"Voice recognition error: not-allowed"` — user-visible ✅
- Unsupported browser: `"Voice input is not supported in this browser"` ✅
- Network error: `"Voice error: network"` ✅

---

## 5. Notion Integration

| Check | Status | Risk |
|-------|--------|------|
| Notion API client | ✅ `lib/notion/sync.ts` | — |
| OAuth or token handling | ⚠️ Manual token paste in settings | HIGH |
| Environment variables | ❌ Not used — all from localStorage | HIGH |
| DB schema for token | ❌ Not in Prisma schema | HIGH |
| Search function | ❌ Only create/update, no search | MEDIUM |
| Save function | ✅ Creates/updates records + versions DB | — |
| Error handling | ✅ Worker error captured, shown to user | — |
| Permission handling | ⚠️ Only checked at connection test time | MEDIUM |
| Server-side proxy | ✅ Via user-supplied Cloudflare Worker | — |

**Phase 3 Decision:** Do not add server-side Notion storage in Phase 3 (requires schema migration + backend work). Keep current localStorage approach. Document and warn users. Phase 4 will move token to DB.

**Phase 3 minimum:** Improve the Notion settings UI with clearer security warning + connection status.

---

## 6. Localization

| Check | Status |
|-------|--------|
| i18n framework exists | ✅ next-intl 3.25 |
| 9 locale files | ✅ `messages/{en,pl,de,fr,es,sk,cs,ro,sv}.json` |
| Language switcher component | ✅ `components/layout/language-switcher.tsx` |
| UI strings hardcoded in workspace-view.tsx | ⚠️ Partially — most critical strings not translated |
| Krystyna responds in selected language | ✅ `locale` passed in context to companion API |
| Language preference stored per user in DB | ❌ Cookie only |
| Language switchable from Settings | ✅ Interface Language tile grid in Settings |
| Language switchable via Krystyna | ⚠️ Not prompted — user must go to Settings |

**Phase 3 action:** Language switching already works via Settings. No new work needed for core functionality. Krystyna could be prompted to say "Go to Settings to change language" when asked.

---

## 7. Bot Identity Customisation

| Check | Status |
|-------|--------|
| AI companion name hardcoded | ✅ "Krystyna" in 8+ places in `ai-companion.tsx` |
| Bot avatar hardcoded | ✅ Fixed SVG in `KrystynaAvatar` component |
| Settings supports AI companion personalisation | ❌ No Companion tab |
| Avatar storage available | ⚠️ localStorage only (suitable for Phase 3) |
| Default bot avatar gallery | ❌ Not implemented |
| Custom avatar upload | ❌ Not implemented |

**Phase 3 scope:**
- Add `companionName` + `companionAvatar` to `GovSettings`
- Add "Companion" tab to settings panel
- 4 prebuilt avatar options + custom image upload (base64 in localStorage)
- Dynamic name + avatar in `AICompanion` component
