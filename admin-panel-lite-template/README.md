# JD Suite — Admin Panel

> The generic `admin-panel-lite` template was customized into a Next.js-native
> admin panel for **JD Suite**. This README documents the live panel. The
> original template files (`backend/`, `frontend/`) are preserved in this
> folder as reference material — they are NOT what runs in production.

The customized panel lives **inside the JD Suite app** (not as a standalone
Express service):

| Concern | Location |
|---|---|
| Pages | `apps/web/app/admin/` |
| API routes | `apps/web/app/api/admin/` |
| Helpers | `apps/web/lib/admin/` |
| Schema additions | `packages/db/prisma/schema.prisma` (`AccessCode`, `AccessCodeUse`, `JDCheckout`, `AdminAuditLog`, `User.isPlatformAdmin`) |
| Branding tokens | `apps/web/app/admin/admin.css` |

## Capabilities

The platform admin (any user with `users.isPlatformAdmin = true`) can:

1. **Dashboard** — cross-tenant counts (users, orgs, JDs by status, active access codes, open checkouts, archived JDs) + 8 most recent admin actions.
2. **Users** — list latest 100, change `isPlatformAdmin` flag, deactivate (clears passwordHash), reset password (≥12 chars). Self-demotion is blocked.
3. **Organisations** — list with member + JD counts, rename, hard-delete (cascades to memberships, JDs, audit history; double-confirmation by typing "DELETE <name>").
4. **Access codes** — create (auto-generated or custom), label, set max-uses + expiry, enable/disable, delete. Each registration consumes one and increments `usesCount`.
5. **JDs cross-tenant view** — every JD across orgs, filterable by org + status. Red dot on JDs with an open checkout; row click opens detail.
6. **JD detail page** — current SHA-256 hash, full checkout history, full audit timeline (every `JDVersion` row).
7. **Checkout / check-in (tamper detection)** — snapshot a JD's hash on checkout; on check-in, recompute and compare. Mismatch → `tamperFlag = true`, red banner, both hashes printed. Live drift is shown even before formal check-in.
8. **Admin log** — every panel-level write recorded with actor, action, JSON detail, IP. Latest 200.

## Security defaults (carried over from the template)

| Defence | How it lives in the Next.js port |
|---|---|
| **Auth** | NextAuth (credentials) + bcrypt password hashing (was scrypt+JWT in template) |
| **Server-side guard on every admin action** | `requireAdmin()` on pages, `requireAdminApi()` on API routes — both check `isPlatformAdmin` |
| **CSRF** | Built into NextAuth's session-token + cookie flow |
| **Login rate limit** | 10 attempts / 15 min / IP via `lib/admin/rate-limit.ts` (template's `loginRateLimiter` equivalent — max value never raised, can be lowered) |
| **Sanitisation of stored content** | `sanitizeText` / `sanitizeContentValue` in `lib/admin/sanitize.ts` — same `sanitize-html` allow-list and same `INVISIBLE_RE` zero-width strip regex (load-bearing — do not modify) |
| **Audit log on every write** | `logAdminAction(actorId, action, detail)` writes to `AdminAuditLog` from every PATCH/POST/DELETE route |
| **API endpoints return 401 not redirect** | Handled in `middleware.ts` — `/api/*` paths get JSON `401`, page routes get `307 → /login` |
| **Forged JWT (`alg: none`) rejected** | NextAuth core verifies signature; rejected at session lookup |
| **XSS via stored content** | All admin-stored text goes through `sanitizeText` → renders as React text (escaped). HTML-bearing fields use `sanitizeContentValue` (same allow-list as template) |
| **Atomic operations** | Prisma `$transaction` for compound writes (registration consumes code + creates user/org/membership/use atomically) |
| **Self-demotion guard** | API refuses to set your own `isPlatformAdmin = false` |

## What's different from the original `admin-panel-lite` template

The template was a vanilla Express + JSON-file backend. JD Suite is Next.js
on Vercel with Postgres. Verbatim merge was impossible (Vercel serverless
can't run a long-lived Express server). The architectural translation:

| Template | Customized panel |
|---|---|
| Express server (`server.js`) | Next.js App Router route handlers |
| JSON file storage (`.admin-history.json`, `.settings-data.json`) | Postgres tables (`AdminAuditLog`, `JDCheckout`, etc.) via Prisma |
| scrypt + JWT with `tokenVersion` | NextAuth + bcrypt (single sign-in across app + admin, simpler UX) |
| Helmet/CSP nonce middleware | Vercel edge + Next.js default headers |
| `email.js` SMTP (Gmail) | Phase 3 — password reset email confirmation flow not yet wired (admin password reset is direct, not 2-step) |
| `submissions` route (public form) | Replaced with cross-tenant JDs + audit timeline |
| `settings` (key/value editor) | N/A — JD Suite has typed settings per-org already |

The **security disciplines** (sanitisation, audit, rate limit, server-side
guards, atomic writes) all carried over. The **transport mechanics** were
adapted to match the platform.

## Tamper-detection workflow (the JD checkout/check-in feature)

Hash algorithm: **SHA-256** over a deterministic JSON canonicalisation of
{ jobTitle, jobCode, orgUnit, status, data } — keys are recursively sorted
so hash is stable regardless of object key order. Implementation in
`apps/web/lib/admin/hash.ts`.

Workflow:
1. Admin opens a JD in `/admin/jds/[id]`.
2. **Current hash** is shown top-right on every page load.
3. Click "**Checkout (snapshot hash)**" with optional note. Creates a
   `JDCheckout` row with the hash + full data snapshot at that moment.
4. JD can be edited/exported/sent off elsewhere.
5. When admin returns: if the live JD hash differs from the checkout hash,
   the panel shows "⚠ Live content has drifted" before check-in even runs.
6. Click "**Check-in & verify hash**" to formally close the checkout.
   Server recomputes hash, compares with checkout hash:
   - Match → `tamperFlag = false`, green banner, MATCH pill in history.
   - Mismatch → `tamperFlag = true`, red banner with both hashes printed,
     ⚠ TAMPERED pill in history, audit log records `jd_checkin_tamper_detected`.
7. Or "**Abandon checkout**" to close without comparing.

The hash is computed at checkout, server-side, from the DB state — there
is no client-side path to bypass tamper detection.

## How to run (development)

```bash
# From repo root
pnpm install
DATABASE_URL=postgresql://... NEXTAUTH_SECRET=... pnpm --filter web dev
# → http://localhost:3700/admin (must be signed in as a platform admin)
```

To grant yourself platform-admin status (one-time):

```bash
psql "$DATABASE_URL" -c "UPDATE users SET \"isPlatformAdmin\" = true WHERE email = 'you@example.com';"
```

To create the first access code so people can register:

```bash
psql "$DATABASE_URL" -c "INSERT INTO access_codes (id, code, label, active) VALUES (gen_random_uuid()::text, 'YOUR-CODE', 'Wave 1', true);"
```

After that, the `/admin/access-codes` UI handles the rest.

## How to run (production)

The panel deploys with the rest of JD Suite via Vercel.

```bash
vercel deploy --prod
```

Live: https://jd-suite-pro.vercel.app/admin

Required env vars (Production scope on Vercel):
- `DATABASE_URL` — Postgres (Neon)
- `NEXTAUTH_SECRET` — 64+ char random string
- `ANTHROPIC_API_KEY` — existing JD Suite dependency

## Files added / modified in this customization

```
apps/web/
├── app/
│   ├── admin/
│   │   ├── admin.css                       (new — design tokens)
│   │   ├── layout.tsx                      (new — sidebar shell)
│   │   ├── page.tsx                        (new — dashboard)
│   │   ├── _components/sign-out.tsx        (new)
│   │   ├── users/page.tsx + users-table.tsx (new)
│   │   ├── orgs/page.tsx + orgs-table.tsx  (new)
│   │   ├── access-codes/page.tsx + codes-view.tsx (new)
│   │   ├── jds/page.tsx                    (new — cross-tenant list)
│   │   ├── jds/[id]/page.tsx + checkout-panel.tsx (new — detail + tamper)
│   │   └── audit/page.tsx                  (new — admin log)
│   ├── api/admin/
│   │   ├── users/route.ts + [id]/route.ts
│   │   ├── orgs/route.ts + [id]/route.ts
│   │   ├── access-codes/route.ts + [id]/route.ts
│   │   ├── jds/route.ts
│   │   └── jds/[id]/checkout/route.ts + checkin/route.ts
│   ├── forbidden/page.tsx                  (new — 403 page)
│   └── api/auth/register/route.ts          (modified — access-code gate)
├── lib/admin/
│   ├── auth.ts                             (new — requireAdmin + requireAdminApi)
│   ├── audit.ts                            (new — logAdminAction)
│   ├── sanitize.ts                         (new — INVISIBLE_RE + sanitize-html)
│   ├── hash.ts                             (new — SHA-256 JD hashing)
│   └── rate-limit.ts                       (new — in-memory bucket)
├── lib/auth.ts                             (modified — added rate limit to authorize)
└── middleware.ts                           (modified — admin route guard, /api/* → 401)

packages/db/prisma/schema.prisma            (modified — 4 new models, 7 new User fields)
```

## What's still on the roadmap (Phase 3)

- Password-change email confirmation flow (template had this; needs SMTP env vars)
- Multi-entity org chart with JD placement
- Forum / internal competition
- Per-tenant scoped audit views (currently admin sees everything)
- Exhaustive integration tests (the template's "no tests for completeness" rule still stands — only add when needed)

## Anti-goals (still in force)

- **No frontend framework introduced** — admin pages are vanilla React Server Components + small Client Components, no Tailwind, no UI library.
- **No new auth providers** — single NextAuth credentials provider only.
- **No `console.log` of secrets, tokens, hashes, or PII** — sanity-checked.
- **No client-side storage of admin tokens** — NextAuth httpOnly cookies only.
- **No expanding into a CMS** — kept specifically what JD Suite needs.
