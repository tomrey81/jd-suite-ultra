import { db } from '@jd-suite/db';

/**
 * Postgres-backed rate limiter. Works across all Vercel serverless
 * instances (the in-memory version was per-instance, defeating the
 * point on production). Atomic upsert — race-safe.
 *
 * On DB error, fail OPEN (allow the request) — limiter unavailability
 * must not lock users out. Errors are logged for ops to notice.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const now = new Date();

  try {
    // Try to insert a fresh bucket. If a row exists, update only if its
    // window has expired (reset). One round-trip; serialised by Postgres.
    const result = await db.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      INSERT INTO rate_limit_buckets (key, count, "resetAt")
      VALUES (${key}, 1, ${new Date(now.getTime() + windowMs)})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limit_buckets."resetAt" <= ${now} THEN 1
          ELSE rate_limit_buckets.count + 1
        END,
        "resetAt" = CASE
          WHEN rate_limit_buckets."resetAt" <= ${now} THEN ${new Date(now.getTime() + windowMs)}
          ELSE rate_limit_buckets."resetAt"
        END
      RETURNING count, "resetAt"
    `;

    const row = result[0];
    if (!row) return { ok: true }; // shouldn't happen, but fail open

    if (row.count > max) {
      const retryAfter = Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000));
      return { ok: false, retryAfter };
    }
    return { ok: true };
  } catch (err) {
    // Fail open — better than locking everyone out if Postgres is briefly
    // unreachable. Visible in server logs for ops follow-up.
    // eslint-disable-next-line no-console
    console.error('[rate-limit] DB error, allowing through:', (err as Error).message);
    return { ok: true };
  }
}

/**
 * Best-effort GC. Call from a cron / on-demand to keep the table small.
 * Stale = resetAt older than 1 day.
 */
export async function gcRateLimits(): Promise<number> {
  try {
    const result = await db.$executeRaw`
      DELETE FROM rate_limit_buckets WHERE "resetAt" < NOW() - INTERVAL '1 day'
    `;
    return result;
  } catch {
    return 0;
  }
}
