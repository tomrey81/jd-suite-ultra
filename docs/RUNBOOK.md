# JD Suite Ultra — Operations Runbook

> Last updated: 2026-05-10
> Production: `jd-suite-ultra.vercel.app` · Project ID: `prj_YCP0jUZqt8WESwnwneogRgcjA5sq`

---

## 1. Deployment

### Production Deploy

```bash
cd jd-suite-ultra

# Safety check — confirm correct project
cat .vercel/project.json
# Must show: "projectName": "jd-suite-ultra"

# Remove any global .vercel override that hijacks projects
rm -f ~/.vercel/project.json

# Build locally first (optional sanity check)
pnpm build

# Deploy to production
vercel deploy --prod --yes
```

**Expected output**: `✓ Production: https://jd-suite-ultra.vercel.app [XX s]`

### Preview Deploy

```bash
vercel deploy --yes
```

Preview URL format: `jd-suite-ultra-<hash>-tomrey81s-projects.vercel.app`

### HOME-LINK TRAP — Critical Warning

Vercel CLI reads `~/.vercel/project.json` before `.vercel/project.json`. If the global file exists (from running `vercel` in another project), it will deploy to the WRONG project.

**Before every deploy, run:**
```bash
cat ~/.vercel/project.json 2>/dev/null && echo "WARNING: global override present" || echo "OK"
```

If the global file exists, delete it: `rm ~/.vercel/project.json`

---

## 2. Environment Variables

### View Current Variables

```bash
vercel env ls --cwd /path/to/jd-suite-ultra
```

### Add Variable to Preview (API method — CLI has branch-selection bug in v52)

```bash
TOKEN=$(python3 -c "import json; d=json.load(open('$HOME/Library/Application Support/com.vercel.cli/auth.json')); print(d['token'])")

curl -s -X POST "https://api.vercel.com/v10/projects/prj_YCP0jUZqt8WESwnwneogRgcjA5sq/env?teamId=team_bl9ezJJLd0ey6JZhOOIaPBJg" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"MY_VAR","value":"my-value","type":"encrypted","target":["preview"]}'
```

### Add Variable to Production

```bash
vercel env add MY_VAR production --value 'my-value' --yes
```

### Required Variables Per Environment

| Variable | Production | Preview | Development |
|----------|-----------|---------|-------------|
| `AUTH_SECRET` | ✅ | ✅ | ✅ (any string) |
| `DATABASE_URL` | ✅ | ✅ | ✅ |
| `ANTHROPIC_API_KEY` | ✅ | ✅ (or use mock) | ✅ |
| `NEXTAUTH_URL` | ✅ | ❌ (auto) | ✅ = http://localhost:3000 |

---

## 3. Database Migrations

### Development Migration

```bash
# Create a new migration (interactive, shows diff)
pnpm db:migrate:dev --name descriptive-name-here

# Examples:
pnpm db:migrate:dev --name add-orgid-to-ai-usage-log
pnpm db:migrate:dev --name add-unique-rate-limit-bucket-key
```

### Production Migration

```bash
# Run pending migrations against production DB
# DATABASE_URL must point to production Neon
pnpm db:migrate:deploy
```

**Never use `db:push` in production** — it bypasses migration history.

### Rollback a Migration

Prisma does not have built-in rollback. Options:
1. Write a manual `DOWN` migration SQL and apply via `prisma db execute`
2. Restore from Neon point-in-time recovery (see Section 7)

### Schema Change Checklist

- [ ] Write migration in `packages/db/prisma/migrations/`
- [ ] Test locally with `pnpm db:migrate:dev`
- [ ] Update `packages/db/prisma/schema.prisma`
- [ ] Run `pnpm db:generate` to refresh Prisma client types
- [ ] Run `pnpm typecheck` — fix any type errors
- [ ] Deploy schema change BEFORE deploying code that depends on it
- [ ] After deploy, verify with `pnpm db:studio` or a Prisma query

---

## 4. Feature Flags

Feature flags are env-var-based and evaluated at module load. Changing them requires a redeploy.

### Enable a Flag

```bash
vercel env add ENABLE_AXIOMERA_ENGINE production --value 'true' --yes
vercel deploy --prod --yes
```

### Disable a Flag

```bash
vercel env rm ENABLE_AXIOMERA_ENGINE production --yes
vercel deploy --prod --yes
```

### Flag Dependencies

| Flag | Depends On | Side Effect |
|------|-----------|-------------|
| `ENABLE_AXIOMERA_ENGINE` | — | Enables Axiomera API route |
| `ENABLE_AXIOMERA_SHADOW_MODE` | `AXIOMERA_ENGINE=true` | Hides results from non-admins |
| `ENABLE_JDQ_LAYER` | `AXIOMERA_ENGINE=true` | Adds JDQ pre-check step |
| `ENABLE_APPROVAL_WORKFLOW` | — | Activates ApprovalRecord state machine |
| `ENABLE_COST_DASHBOARD` | — | Requires `orgId` on AiUsageLog (pending fix) |

---

## 5. Monitoring & Observability

### Vercel Dashboard

- Function logs: `vercel.com → Project → Logs`
- Deployment history: `vercel.com → Project → Deployments`

### AI Cost Monitoring

Query AiUsageLog for recent cost:

```sql
-- Total cost last 7 days
SELECT
  operation,
  "modelTier",
  COUNT(*) as calls,
  SUM("estimatedCostUsd") as total_usd,
  AVG("durationMs") as avg_ms
FROM "AiUsageLog"
WHERE "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY operation, "modelTier"
ORDER BY total_usd DESC;
```

**Note**: No orgId on AiUsageLog rows currently — per-org breakdown not possible until E3 fix is applied.

### Rate Limit Monitoring

```sql
-- Active rate limit buckets (near or over limit)
SELECT key, count, "resetAt"
FROM "RateLimitBucket"
WHERE count > 5 AND "resetAt" > NOW()
ORDER BY count DESC;
```

---

## 6. Incident Response

### Auth Broken (users can't log in)

1. Check `AUTH_SECRET` env var is set for the correct environment
2. Check `DATABASE_URL` is reachable: `psql $DATABASE_URL -c "SELECT 1;"`
3. Check Vercel function logs for NextAuth errors
4. Check `RateLimitBucket` for mass lockout: `SELECT * FROM "RateLimitBucket" WHERE "resetAt" > NOW() AND count >= 10;`
5. Emergency: clear all buckets: `DELETE FROM "RateLimitBucket";`

### AI Features Not Working

1. Verify `ANTHROPIC_API_KEY` is set in Vercel env
2. Check Anthropic status page
3. Query AiUsageLog for errors: `SELECT * FROM "AiUsageLog" WHERE "cacheStatus" = 'error' ORDER BY "createdAt" DESC LIMIT 20;`
4. Temporary: set `ENABLE_AXIOMERA_ENGINE=false` and redeploy to degrade gracefully

### Database Not Accessible

1. Check Neon dashboard: `console.neon.tech`
2. Verify `DATABASE_URL` hasn't expired (Neon free tier suspends after inactivity)
3. Resume the Neon compute endpoint from dashboard
4. Verify connection pool settings (Neon serverless adapter should handle reconnect)

### Vercel Deploy Failed

1. Check build logs in Vercel dashboard
2. Common causes:
   - TypeScript errors → run `pnpm typecheck` locally
   - Missing env vars → add them for the target environment
   - Prisma generate failed → run `pnpm db:generate`
3. Rollback to previous deployment:
   - Vercel dashboard → Deployments → select previous → Promote to Production

---

## 7. Database Backup & Recovery

### Neon Point-in-Time Recovery

Neon provides continuous WAL archiving. Restore steps:
1. Go to `console.neon.tech → Project → Branches`
2. Click "Restore" on `main` branch
3. Select point in time (up to 7 days on free plan, 30 days on paid)
4. Creates a new branch — test it, then swap `DATABASE_URL`

### Manual Backup

```bash
# Full dump (requires pg_dump on PATH)
pg_dump $DATABASE_URL --no-owner --no-acl > backup-$(date +%Y%m%d-%H%M).sql

# Restore
psql $DATABASE_URL < backup-YYYYMMDD-HHMM.sql
```

---

## 8. Maintenance Tasks

### Scheduled Cleanup (Recommended — not yet implemented)

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-tokens",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Route deletes:
- `GuestToken` where `expiresAt < NOW()`
- `AuthToken` where `expiresAt < NOW()`
- `RateLimitBucket` where `resetAt < NOW()`

### AiUsageLog Archiving (Recommended — not yet implemented)

When `AiUsageLog` exceeds 100K rows, consider:
1. Create a `AiUsageLogArchive` table with the same schema
2. Move rows older than 90 days: `INSERT INTO "AiUsageLogArchive" SELECT * FROM "AiUsageLog" WHERE "createdAt" < NOW() - INTERVAL '90 days';`
3. Delete moved rows
4. Or: enable Neon table partitioning (requires schema migration)

---

## 9. Local Development

### Setup

```bash
git clone https://github.com/tomrey81/jd-suite-ultra.git
cd jd-suite-ultra
pnpm install
cp .env.example .env.local
# Fill in: DATABASE_URL, AUTH_SECRET (any string locally), ANTHROPIC_API_KEY
pnpm db:push  # skip migrations in dev for speed
pnpm db:seed  # optional: create test data
pnpm dev
```

### Dev Commands

```bash
pnpm dev              # http://localhost:3000 (Turbopack)
pnpm build            # Production build check
pnpm typecheck        # TypeScript type check
pnpm lint             # ESLint
pnpm test             # Vitest unit tests
pnpm test:golden      # Axiomera golden tests
pnpm db:studio        # Prisma Studio GUI at http://localhost:5555
pnpm db:generate      # Regenerate Prisma types after schema change
```

### Connecting to Production DB Locally (read-only tasks)

```bash
# Pull production env to .env.local
vercel env pull .env.local --environment production
# Use with care — writes go to production DB
```
