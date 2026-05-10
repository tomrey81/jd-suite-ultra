# JD Suite Ultra — Security Model

> Last updated: 2026-05-10

---

## Authentication Architecture

### Session Flow

```
Browser → POST /api/auth/[...nextauth] (credentials)
        → NextAuth: bcryptjs.compare(password, passwordHash)
        → Rate limit: 10 attempts / 15 min / IP (RateLimitBucket, DB-backed)
        → JWT minted: { sub: userId, orgId, orgRole, isPlatformAdmin }
        → HttpOnly cookie: next-auth.session-token (Secure in production)
        → 7-day expiry, not revocable server-side
```

### Cookie Names Checked by Middleware

| Environment | Cookie Name |
|-------------|-------------|
| HTTP (dev) | `next-auth.session-token`, `authjs.session-token` |
| HTTPS (prod) | `__Secure-next-auth.session-token`, `__Secure-authjs.session-token` |

### Known Limitation: Middleware Does Not Verify JWT Signature

`middleware.ts` runs on the Vercel Edge Runtime which does not have access to Node.js crypto primitives by default. The middleware only **checks for cookie presence**. It does not verify the JWT's HMAC signature.

**Consequence**: A cookie with an invalid JWT payload still passes middleware. The first genuine security check is inside individual route handlers that call `auth()` from NextAuth — which does verify the signature.

**Mitigation**: Every protected API route MUST call `auth()` or equivalent. Middleware is a UX guard (redirect to login), not a security boundary.

---

## Authorisation Model

### Roles

| Role | Scope | Capabilities |
|------|-------|-------------|
| `MEMBER` | Org | Read/write own JDs, view org JDs |
| `ADMIN` | Org | Manage users, org settings, all JDs in org |
| `OWNER` | Org | All ADMIN + billing, org deletion |
| `isPlatformAdmin` | Global | All orgs, admin panel, tamper detection |

### Route-Level Enforcement

Admin routes (`/api/admin/*`) check `isPlatformAdmin` at the route handler level:

```typescript
// Every admin route handler must do this:
const session = await auth();
if (!session?.user?.isPlatformAdmin) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Gap**: Middleware does not enforce `/admin/*` at the edge. A missing check in any admin handler = privilege escalation. Audit every `/app/api/admin/*/route.ts` to confirm the guard exists.

### Org Isolation

All DB queries for user-facing data are scoped by `orgId` from the JWT:

```typescript
const session = await auth();
const orgId = (session as any).orgId;
// All queries: where: { orgId }
```

Cross-org data access requires `isPlatformAdmin`.

---

## Credential Security

### Passwords

- Hashed with `bcryptjs` at cost factor 10 (default)
- `passwordHash` is never returned from any API
- Plain-text passwords are never logged

### Password Reset

1. User submits email → `POST /api/auth/forgot-password`
2. System generates `crypto.randomBytes(32)` → hex token
3. SHA-256 hash of token stored in `AuthToken` (kind='reset', expiresAt = 1 hour)
4. Raw token sent to user's email
5. User submits token → `POST /api/auth/reset-password`
6. Server re-hashes submitted token and compares with stored hash
7. On match: update `passwordHash`, mark `AuthToken.usedAt`

**Known Gap**: No rate limit on `POST /api/auth/forgot-password` issuance. An attacker can spam reset emails. Fix: add `checkRateLimit('reset:email:${email}', 3, 900_000)`.

### Magic Links

Same mechanism as password reset, kind='magic'. Expires in 15 minutes.

### Session Tokens (Guest Review)

`GuestToken` model stores guest share links. Properties:
- Random UUID-based token
- `expiresAt` enforced at application level (not DB)
- `role`: VIEWER (read-only) or REVIEWER (can comment)
- Scoped to a single JD

---

## Input Validation & XSS Prevention

- All API inputs validated with **Zod schemas** at route entry
- HTML content inputs (JD body, comments) sanitised with `sanitize-html@2.17` before storage
- `sanitize-html` configured to strip `<script>`, `on*` attributes, `javascript:` hrefs
- Content-Type: application/json enforced on all API routes (no multipart except PMOA upload)

---

## Rate Limiting

### Implementation

`RateLimitBucket` table in PostgreSQL (cross-instance, survives function restarts):

```typescript
async function checkRateLimit(key: string, max: number, windowMs: number): Promise<{ ok: boolean; remaining: number; resetAt: Date }>
```

### Applied Rate Limits

| Endpoint | Key Pattern | Limit | Window |
|----------|------------|-------|--------|
| Login | `login:{ip}` | 10 attempts | 15 min |
| Password reset (planned) | `reset:email:{email}` | 3 requests | 15 min |

**Known Gap**: `RateLimitBucket.key` may lack a `@@unique` constraint. Add it to prevent race-condition bypass.

---

## GDPR & Data Privacy

### Consent Fields on User

| Field | Purpose |
|-------|---------|
| `dataConsentAt` | GDPR data processing acceptance timestamp |
| `tosAcceptedAt` | Terms of service acceptance |
| `privacyAcceptedAt` | Privacy policy acceptance |
| `marketingOptIn` | Marketing email consent |
| `newsletterOptIn` | Newsletter consent |

These are set during registration and can be updated in `/settings`.

### Data Residency

All data stored on Neon PostgreSQL in **EU Central (Frankfurt)** region. Anthropic API calls send JD text content to Anthropic's US infrastructure. This must be disclosed in the Privacy Policy.

### Right to Erasure

No automated "delete my account" flow is implemented. Platform Admin must manually:
1. Delete `Membership` records
2. Delete or anonymise `User`
3. Reassign or archive `JobDescription` records owned by the user

This should be documented in `docs/GDPR_COMPLIANCE.md` and a self-service flow added.

---

## Infrastructure Security

### Environment Variables

Sensitive vars stored as Vercel Encrypted environment variables:
- `AUTH_SECRET` — 32+ random bytes, used for JWT signing
- `DATABASE_URL` — includes password, use connection string with SSL
- `ANTHROPIC_API_KEY`

Never commit these to git. `.env.local` is in `.gitignore`.

### Database Connection

- Neon uses SSL (sslmode=require enforced in DATABASE_URL)
- `channel_binding=require` set for extra security
- Connection pooling via Neon serverless adapter (avoids connection exhaustion)

### Vercel Preview Protection

Preview deployments are protected by Vercel's authentication wall. Users must be logged into Vercel to access preview URLs. This is separate from application auth.

---

## Security Checklist for New Routes

Before shipping any new API route:

- [ ] Call `auth()` and check session existence → 401 if missing
- [ ] Check `orgId` from session → scope all DB queries
- [ ] If admin route: check `isPlatformAdmin` → 403 if false
- [ ] Validate all inputs with Zod schema
- [ ] Sanitise any HTML inputs with `sanitize-html`
- [ ] Return consistent error shapes (no stack traces to client)
- [ ] No sensitive data in response (no passwordHash, no raw tokens)
