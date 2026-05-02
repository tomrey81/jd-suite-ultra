# 04 — Sonification Non-Interference Contract

Pro's Sonification engine MUST continue to work unchanged in Ultra. This document defines the input contract and the rules under which approval workflow, JDQ, and Axiomera engines may interact with Sonification.

---

## Pro Sonification architecture (current state)

### Routes
| Route | File | Auth |
|-------|------|------|
| `/studio` | `apps/web/app/(dashboard)/studio/page.tsx` | Required |
| `/jd/[id]/studio` | `apps/web/app/(dashboard)/jd/[id]/studio/page.tsx` | Required |
| `/sonification/receiver` | `apps/web/app/sonification/receiver/page.tsx` | **PUBLIC** (no auth) |

### Engine
| File | Purpose |
|------|---------|
| `apps/web/lib/jd-sonic.ts` | Fingerprint computation, similarity scoring, sonic issue detection — **pure functions, deterministic, text-only** |
| `apps/web/lib/audio-constants.ts` | SCALES (major/minor/pentatonic/blues/chromatic), ROOTS (C–B Hz), instrument labels |
| `apps/web/lib/studio/engine.ts` | Orchestration |
| `apps/web/lib/studio/fsk.ts` | FSK token encoder + `createFskDecoder()` for receiver |

### JD input contract
```typescript
// From apps/web/lib/jd-sonic.ts
export function computeJdFingerprint(
  text: string,                // ENTIRE JD text body
  scaleKey: string = 'major',  // major | minor | pentatonic | blues | chromatic
  rootNote: string = 'C',      // C | D | E | F | G | A | B
): JdFingerprint
```

**Critical: Sonification reads `text: string` only.** It does NOT depend on:
- `JobDescription.status` (DRAFT / UNDER_REVISION / APPROVED / ARCHIVED)
- `EvalResult` records
- `JDVersion` history
- Approval state
- Pay group membership
- Architecture placement
- AI scores (DQS, ERS, 16-criterion, Axiomera)

### FSK broadcast format
- Token payload: `jd:<uuid>` or `/jd/<uuid>` (URL path) or arbitrary string
- Receiver decodes token from microphone audio (no auth required)
- Receiver resolves token: if `jd:<uuid>` -> redirects to `/jd/<uuid>` (which will require auth)

### What Sonification "broadcast" means today
1. User opens `/studio` or `/jd/[id]/studio`.
2. UI generates FSK audio token containing `jd:<uuid>`.
3. User clicks "Broadcast" — speakers emit the token.
4. Other devices running `/sonification/receiver` decode it.
5. Receiver shows the link; clicking opens `/jd/<uuid>` (auth-gated).

There is **no "publish" model** today — broadcasting is just emitting a token. Anyone in the room can decode the link.

---

## Non-interference rules

### Rule SC-1 — Schema additions must not change `JobDescription.data` shape
Phase 1 adds new Prisma models (`AxiomeraRun`, `JdqRun`, etc.) but **does not modify** the existing `JobDescription.data: Json` field. Sonification reads from this field; changing the field shape would break it. Acceptance test: after Phase 1, `computeJdFingerprint(jd.data.bodyText, 'major', 'C')` must return identical output to baseline.

### Rule SC-2 — JDStatus enum must not have values removed
Existing enum: `DRAFT | UNDER_REVISION | APPROVED | ARCHIVED`. Phase 2 may **add** a `PUBLISHED` value, but **must not remove** any of the existing four. Sonification's broadcast UI may opt into gating on `APPROVED` or `PUBLISHED` only — but this is gated by `ENABLE_APPROVAL_WORKFLOW`.

### Rule SC-3 — Receiver page stays public
`/sonification/receiver` MUST stay public. It uses Web Audio + Web Speech APIs that work without server state. No auth wall.

### Rule SC-4 — Broadcaster gating (Phase 2 only, flag-controlled)
When `ENABLE_APPROVAL_WORKFLOW=true`:
- The broadcaster UI on `/studio` and `/jd/[id]/studio` MUST show a confirmation dialog if `JobDescription.status` is `DRAFT` or `UNDER_REVISION`.
- The dialog text: "This JD is in {status}. Broadcast may share unapproved content. Continue?"
- Default action: cancel. User must explicitly confirm "Test broadcast (draft)" or wait for approval.
- This is a **UI-level safety net**, not a server-side block. The receiver can still resolve the token if a determined user broadcasts.

When `ENABLE_APPROVAL_WORKFLOW=false`:
- No gating. Existing behavior preserved.

### Rule SC-5 — Outdated content warning
When `ENABLE_APPROVAL_WORKFLOW=true` AND a JD's content has changed after a publish:
- The receiver page shows a small badge: "Note: this JD was updated since publish. Latest version may differ."
- Implementation: client-side fetch to a public `GET /api/jd/[id]/publish-status` endpoint that returns `{ lastPublishedAt, lastEditedAt }`. No JD content exposed.
- Fail-open: if the endpoint is unreachable, no badge; the link still resolves.

### Rule SC-6 — Sonic fingerprint engine version is stable
Pro Max's `lib/sonic/diff.ts` (Whisper + Claude diff) is **NOT** to be migrated into Ultra. Ultra keeps Pro's existing `lib/jd-sonic.ts` engine. If a future enhancement is desired, it goes into a separate file with a different version number, controlled by a new flag. Existing Pro receiver/broadcaster UI must not change.

### Rule SC-7 — JDQ/Axiomera engines must not write into `JobDescription.data`
JDQ runs and Axiomera runs persist to **new** Prisma models (`JdqRun`, `AxiomeraRun`, etc.). They MUST NOT update `JobDescription.data`. Sonification reads `data`; mutating it from a scoring engine could subtly change a fingerprint between two consecutive runs and confuse users.

---

## Acceptance tests

| Test | Method | Expected |
|------|--------|----------|
| SC-T1 | Run `computeJdFingerprint` on a sample JD before any Phase 1 migration. Save fingerprint. Run again after migration. | Fingerprints byte-identical. |
| SC-T2 | Open `/studio` in Ultra with all flags OFF. | Identical UI, identical broadcast, identical receiver decode. |
| SC-T3 | Open `/sonification/receiver` in incognito (no auth). | Decoder works; token resolves; click goes to login redirect for `/jd/<uuid>`. |
| SC-T4 | Set `ENABLE_APPROVAL_WORKFLOW=true`. Open `/studio` for a DRAFT JD. Click broadcast. | Confirmation dialog shown. |
| SC-T5 | Same setup, click broadcast for APPROVED JD. | No dialog; broadcast proceeds. |
| SC-T6 | Persist Axiomera run for a JD. Re-run `computeJdFingerprint` on same `data`. | Same fingerprint. |

---

## What Pro Max is NOT bringing to Ultra

For clarity:
- **Pro Max `lib/sonic/whisper.ts`** (OpenAI Whisper transcription) — NOT migrated. Ultra has the more advanced Pro engine.
- **Pro Max `lib/sonic/diff.ts`** (Claude spoken-vs-written diff) — NOT migrated.
- **Pro Max `/sonic` page** (audio recording UI) — NOT migrated.
- **Pro Max `/studio` and `/studio/library`** — NOT migrated. Pro has its own `/studio` already.

If, in a future phase, the "spoken diff" feature is desired, it would be added as `/api/ai/sonic-diff` with its own flag (`ENABLE_SONIC_DIFF`) and would not interact with Pro's existing FSK Sonification.
