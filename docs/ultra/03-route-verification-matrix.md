# 03 — Route Verification Matrix

Per-route runtime/code classification. Replaces optimistic "Complete" labels from earlier audit.

Classification:
- **WORKS** — real implementation, fetches data, has interactive logic
- **WORKS-WITH-ISSUES** — real but has known gaps
- **STUB** — renders heading + hardcoded reference data, no logic
- **MOCK** — renders fake/hardcoded JD-like data only
- **BROKEN** — imports missing, syntax errors, calls non-existent endpoint
- **PUBLIC** — no auth required
- **AUTH-REQ** — requires login
- **CANNOT-VERIFY** — needs runtime / data / env to confirm

---

## Pro routes (`/Users/tomaszrey/Desktop/Code/jd-suite-pro/apps/web/app`)

### Auth flow
| Route | File | Status | Notes |
|-------|------|--------|-------|
| `/login` | `(auth)/login/page.tsx` | WORKS | Credentials provider via NextAuth |
| `/register` | `(auth)/register/page.tsx` | WORKS | First user becomes OWNER of new Org |
| `/forgot-password` | `(auth)/forgot-password/page.tsx` | WORKS | Sends AuthToken (kind=reset) |
| `/reset-password` | `(auth)/reset-password/page.tsx` | WORKS | One-time token consumption |

### Dashboard / JD hub
| Route | File | Status |
|-------|------|--------|
| `/` | `(dashboard)/page.tsx` | WORKS |
| `/jd` | `(dashboard)/jd/page.tsx` | WORKS — grid of all JDs |
| `/jd/new` | `(dashboard)/jd/new/page.tsx` | WORKS |
| `/jd/input` | `(dashboard)/jd/input/page.tsx` | WORKS — paste/upload |
| `/jd/bulk-import` | `(dashboard)/jd/bulk-import/page.tsx` | WORKS |
| `/jd/[id]` | `(dashboard)/jd/[id]/page.tsx` | WORKS |
| `/jd/[id]/studio` | `(dashboard)/jd/[id]/studio/page.tsx` | WORKS — sonification |
| `/jd/[id]/audit-report` | `(dashboard)/jd/[id]/audit-report/page.tsx` | WORKS |
| `/jd-editor` | `(dashboard)/jd-editor/page.tsx` | WORKS |
| `/templates` | `(dashboard)/templates/page.tsx` | WORKS |
| `/rubric` | `(dashboard)/rubric/page.tsx` | CANNOT-VERIFY (not deeply read) |

### Org structure / PMOA
| Route | File | Status |
|-------|------|--------|
| `/company` | `(dashboard)/company/page.tsx` | WORKS — 6 tabs |
| `/pmoa` | `(dashboard)/pmoa/page.tsx` | WORKS |
| `/pmoa/org` | `(dashboard)/pmoa/org/page.tsx` | WORKS |
| `/pmoa/processes` | `(dashboard)/pmoa/processes/page.tsx` | WORKS |
| `/pmoa/processes/[id]` | `(dashboard)/pmoa/processes/[id]/page.tsx` | WORKS |
| `/architecture` | `(dashboard)/architecture/page.tsx` | WORKS — JobFamily × Slot matrix |

### Compliance / governance
| Route | File | Status |
|-------|------|--------|
| `/euptd-readiness` | `(dashboard)/euptd-readiness/page.tsx` | WORKS |
| `/euptd-readiness/report` | `(dashboard)/euptd-readiness/report/page.tsx` | WORKS |
| `/pay-groups` | `(dashboard)/pay-groups/page.tsx` | WORKS |
| `/command-center` | `(dashboard)/command-center/page.tsx` | WORKS |
| `/jd-versioning` | `(dashboard)/jd-versioning/page.tsx` | WORKS |
| `/audit` | `(dashboard)/audit/page.tsx` | WORKS |
| `/compare` | `(dashboard)/compare/page.tsx` | WORKS |
| `/compare/text` | `(dashboard)/compare/text/page.tsx` | WORKS |

### Sources / external
| Route | File | Status |
|-------|------|--------|
| `/sources` | `(dashboard)/sources/page.tsx` | CANNOT-VERIFY |

### Sonification
| Route | File | Status |
|-------|------|--------|
| `/studio` | `(dashboard)/studio/page.tsx` | WORKS — main sonification editor |
| `/sonification/receiver` | `sonification/receiver/page.tsx` | WORKS, PUBLIC — FSK + Web Speech |

### v5 (parallel module)
| Route | File | mtime | Status |
|-------|------|-------|--------|
| `/v5` | `v5/page.tsx` | 2026-04-30 | WORKS — portal |
| `/v5/bias-check` | `v5/bias-check/page.tsx` | 2026-04-30 | WORKS — 4-layer bias engine + 56-hyp panel |
| `/v5/library` | `v5/library/page.tsx` | 2026-04-30 | WORKS, force-dynamic |

### Public
| Route | File | Status |
|-------|------|--------|
| `/welcome` | `welcome/page.tsx` | WORKS, PUBLIC |
| `/about` | `about/page.tsx` | WORKS, PUBLIC |
| `/guide` | `guide/page.tsx` | WORKS, PUBLIC |
| `/legal/privacy` | `legal/privacy/page.tsx` | WORKS, PUBLIC |
| `/legal/terms` | `legal/terms/page.tsx` | WORKS, PUBLIC |
| `/forbidden` | `forbidden/page.tsx` | WORKS — 403 handler |
| `/print/[id]` | `(print)/[id]/page.tsx` | WORKS, PUBLIC |
| `/review/[token]` | `(public)/review/[token]/page.tsx` | WORKS, PUBLIC — guest review |

### Admin
| Route | File | Status |
|-------|------|--------|
| `/admin` | `admin/page.tsx` | WORKS |
| `/admin/users` | `admin/users/page.tsx` | WORKS |
| `/admin/orgs` | `admin/orgs/page.tsx` | WORKS |
| `/admin/jds` | `admin/jds/page.tsx` | WORKS |
| `/admin/jds/[id]` | `admin/jds/[id]/page.tsx` | WORKS — main JD detail editor |
| `/admin/access-codes` | `admin/access-codes/page.tsx` | WORKS |
| `/admin/audit` | `admin/audit/page.tsx` | WORKS |

---

## Pro Max routes (`/Users/tomaszrey/Desktop/Code/jd-suite-pro-max/app`)

| Route | LOC | Status | Evidence |
|-------|-----|--------|----------|
| `/(app)/dashboard` | 116 | WORKS | Admin stats, recent reports |
| `/(app)/library` | — | WORKS | JD table |
| `/(app)/editor/new`, `/editor/[id]` | — | WORKS | Structural editor |
| `/(app)/studio` | 85 | WORKS | JD text input + preview |
| `/(app)/studio/library` | 142 | WORKS | 5 hardcoded sample JDs, links to /analyse |
| `/(app)/swp` | 93 | WORKS | Portfolio KPIs from real data |
| `/(app)/family` | 98 | WORKS | Async family diagnostics, R-zone distribution |
| `/(app)/architecture` + `client.tsx` | 62+189 | WORKS | 9-zone Axiomera grid |
| `/(app)/audit-trail` | 77 | WORKS | Real audit records |
| `/(app)/improve` | 129 | **BROKEN** | Calls `/api/improve` which **does not exist** in Pro Max |
| `/(app)/sonic` | 257 | WORKS | Whisper + Claude diff |
| `/(app)/generate` + `form.tsx` | 28+325 | WORKS | PPTX gen form |
| `/(app)/reports` | 67 | WORKS | Generated PPTX list |
| `/(app)/spec` | 45 | STUB | Renders 210 hardcoded rows from `spec-data.ts` |
| `/(app)/process` | 77 | STUB | Static RASCI matrix, hardcoded |
| `/(app)/methods` | 58 | STUB | Renders `method-matrix.ts` table |
| `/(app)/rubric` | 105 | STUB | Static 5 dimensions display |
| `/(app)/hypotheses` | 93 | STUB | Renders R+E hypothesis arrays |
| `/(app)/quality` | 58 | STUB | Explanation + link to /library |
| `/(app)/programs` | 90 | STUB | "Phase 1.1" admin UI promised, not built |
| `/(app)/intake` | 58 | STUB | All inputs disabled with "(wkrótce)" |
| `/(app)/readiness` | 85 | STUB | Read-only tables only |
| `/(app)/rasci` | 130 | HYBRID | Client-side state, NO DB persistence |
| `/(app)/jd/[id]` | 24 | WORKS (legacy) | Wraps `editor-client.tsx` |
| `/(app)/jd/new` | 30 | WORKS (legacy) | Creates doc, redirects |
| `/(app)/external` | 45 | MOCK | 6 hardcoded source cards |

### Pro Max API endpoints — verification
- `/api/jdq/run`, `/api/jdq/r`, `/api/jdq/e`, `/api/jdq/language` — exist; methodology engine real
- `/api/improve` — **DOES NOT EXIST** despite UI calling it
- `/api/sonic/transcribe`, `/api/sonic/diff`, `/api/sonic/diff/text` — exist
- `/api/programs`, `/api/programs/[id]/seal` — exist; admin UI to use them does not
- `/api/architecture` — exists; UI requires manual seeding
- `/api/reports/generate`, `/api/reports/[id]/download`, `/api/reports/export.csv` — exist

---

## Implications for Ultra Phase 1

| Implication | Action |
|-------------|--------|
| All Pro routes must continue to work in Ultra | Phase 1 acceptance test: smoke each Pro route in Ultra after migrations. |
| Pro Max methodology code (`lib/jdq/`, `lib/hypotheses/`) is portable | Port carefully, translate Drizzle -> Prisma. |
| Pro Max stub UIs are NOT portable | Design fresh UI in Ultra using Shadcn components. Use Pro Max stubs only as content reference (e.g., what 14 readiness dimensions are). |
| Pro Max `/improve` UI calls non-existent endpoint | Phase 3: build new `/api/improve` in Ultra using Pro Max's `lib/improve/rewrite.ts` prompts. |
| `/v5/*` is shipped and active | Do not refactor or relocate. Add new admin Axiomera UI alongside, not on top of. |
