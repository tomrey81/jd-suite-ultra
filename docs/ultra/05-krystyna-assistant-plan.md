# 05 — Krystyna Assistant Plan

The AI Companion is being renamed Krystyna throughout Ultra. **The system prompt already names the assistant Krystyna** — the rename is primarily a UI/branding/i18n change.

---

## Current state in Pro

### File: `apps/web/app/api/ai/companion/route.ts`
System prompt (line 47):
> "You are Krystyna — the JD Suite AI Companion."

Persona block (lines 49–95):
- Calm, precise, slightly playful but professional
- Plain language, no markdown
- Replies short by default
- 7 operating principles (human decides, never invent, distinguish source vs inference, etc.)
- Scope locked to: JDs, org charts, families, reporting lines, workflows, review/approval, audit
- Job evaluation results come from Axiomera; Krystyna interprets, not assigns

Context received from UI:
```typescript
{
  pathname: string,
  module: string,
  locale: string,
  selectedJD: { id, jobTitle, status, dqsScore, ersScore },
  userRole: string
}
```

Output: plain text, max 1500 tokens, **no streaming**, **no function-calling**.

### Storage
None. Conversation history is passed in via `messages` array on each request and serialized into a single user message with history prefix.

### UI integration
Floating widget on `/admin/jds/[id]` and selected dashboard pages. Initialized with current page context per page load. Calls `/api/ai/companion`.

---

## What needs to change

### Phase 2 (controlled by `ENABLE_KRYSTYNA_RENAME`)

#### UI labels
| Surface | Before | After |
|---------|--------|-------|
| Floating widget header | "AI Companion" / "Companion" | "Krystyna" |
| Sidebar nav (if any) | "AI Companion" | "Krystyna" |
| Settings page section | "AI Companion settings" | "Krystyna settings" |
| Mobile drawer label | (whatever exists) | "Krystyna" |
| Tooltip on launcher button | "Open AI assistant" | "Talk to Krystyna" |

#### Translation keys
Add to all 9 locale files (`messages/{en,pl,de,fr,es,sk,cs,ro,sv}.json`):
```json
"krystyna": {
  "name": "Krystyna",
  "openLauncher": "Open Krystyna",
  "tagline": "Your JD work assistant",
  "thinking": "Krystyna is thinking…",
  "errorFallback": "Krystyna is unavailable right now."
}
```

For Polish specifically, the persona is feminine — UI text in Polish should use feminine grammatical forms (e.g., "Krystyna pracuje nad odpowiedzią" not "Asystent pracuje").

#### Avatar / brand asset
- Reuse the existing official avatar referenced in commit `d884931` ("official avatar")
- File path (to verify in code): likely `/public/krystyna-avatar.png` or similar — agent did not surface this in investigation. Phase 2 task: locate, version, optimize.

#### Existing `/api/ai/companion` endpoint
- **No prompt change needed.** Already says "You are Krystyna."
- Optionally clean up any UI-side strings inside JSON responses if any leak "Companion" wording.

### Phase 3+ (later capability expansion — NOT Phase 2)

Per the brief, Krystyna should eventually become a conversational navigation/work assistant across:
- JD Hub
- JD editor
- Org structure
- Processes
- Internal regulations
- Reports
- Approval workflow
- Sonification
- Exports
- Notes
- QR/link generation

#### Capability roadmap

| Capability | Phase | Notes |
|------------|-------|-------|
| UI rename only | 2 | Existing endpoint reused |
| Krystyna sees current JD context (already does) | 2 | Already implemented via `selectedJD` |
| Krystyna sees current org structure | 4 | Need to extend `/api/ai/companion` to optionally receive org graph summary |
| Krystyna sees current process map | 4 | Same — extend context |
| Krystyna sees Internal Regulations excerpts (RAG) | 5 | Requires Internal Regulations module ([06](06-internal-regulations-module-plan.md)) |
| Krystyna can generate notes (saves to a Note model) | 4 | Requires new `Note` Prisma model + endpoint |
| Krystyna can generate QR codes (already in Pro `components/qr/`) | 4 | Wire QR generator into Krystyna response cards |
| Krystyna can generate reports (PPTX) | 3 | After PPTX export ships |
| Krystyna explains job architecture (current band, reasoning) | 4 | Read-only; explain = retrieve + summarize |
| Krystyna can reference internal regulations | 5 | Phase 5 |
| Function calling (tool use) | 6 | Major change — adopt `@anthropic-ai/sdk` tool use; out of scope until later |
| Streaming responses | 4 | Migrate `/api/ai/companion` to streaming SSE; UI updates |

---

## Architecture sketch (forward-looking, not implemented in Phase 1/2)

```
[UI Krystyna widget]
   |  context: { pathname, jdId, orgId, locale, userRole }
   v
[/api/ai/companion]    <-- current, stateless
   |
   |--- gather context (Phase 4):
   |     - JobDescription (id, title, status, scores)
   |     - Org structure summary (PMOA)
   |     - Process map relevant to JD
   |     - Recent regulations (Phase 5)
   |
   |--- call Claude with persona + context
   |
   |--- (Phase 6) tool use:
   |       generateNote(jdId, content)
   |       generateQrCode(payload)
   |       linkToReport(reportId)
   |       referenceRegulation(regulationId)
   |
   v
[Response]: plain text + optional structured "actions" array (Phase 4+)
   |
   v
[UI renders message + action chips + saves to Note model if requested]
```

---

## Phase 2 deliverables (Krystyna rename only)

1. Audit all UI strings using `grep -r "Companion" apps/web/app apps/web/components` and `grep -r "AI Assistant"` etc.
2. Replace with `t('krystyna.*')` translation keys.
3. Add keys to all 9 locale JSONs (English source, machine-translate placeholders for others, mark for human review).
4. Update floating widget header.
5. Update settings page if applicable.
6. Wrap all changes behind `ENABLE_KRYSTYNA_RENAME` flag.
7. Add Playwright smoke test: launcher tooltip says "Krystyna" in EN.

## Acceptance tests

| Test | Pass criteria |
|------|---------------|
| KR-T1 | With `ENABLE_KRYSTYNA_RENAME=false`, all existing UI says "Companion" / "AI Assistant" as before. |
| KR-T2 | With `ENABLE_KRYSTYNA_RENAME=true`, widget header reads "Krystyna" in all 9 locales (placeholders OK). |
| KR-T3 | `/api/ai/companion` responses are unchanged in content; only UI labels differ. |
| KR-T4 | Polish locale uses feminine forms in Krystyna-related labels. |
| KR-T5 | Existing conversations continue to work; no schema migration needed (no Krystyna table yet). |

---

## What is NOT changing in Phase 2

- The `/api/ai/companion` route itself
- The system prompt (already names Krystyna)
- Persona, tone, scope rules
- Streaming behavior (still none)
- Function calling (still none)
- Storage (still stateless)

These are deferred to Phase 4–6 capability expansion, separate flags, separate review.
