import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const stmts = [
  `CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS rate_limit_buckets_resetAt_idx ON rate_limit_buckets("resetAt")`,
];

for (const sql of stmts) {
  await client.query(sql);
  console.log('  ✓', sql.replace(/\s+/g, ' ').slice(0, 90));
}

// Garbage-collect stale buckets (older than 1 day)
const gc = await client.query(`DELETE FROM rate_limit_buckets WHERE "resetAt" < NOW() - INTERVAL '1 day' RETURNING key`);
console.log(`Cleaned ${gc.rowCount} stale buckets`);

await client.end();
console.log('Phase 3 migration complete.');
