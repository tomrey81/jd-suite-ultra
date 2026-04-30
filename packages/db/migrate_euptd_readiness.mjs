// EUPTD Readiness self-assessment storage. One row per (org, item) — answers
// keyed by stable item ID so the checklist library can evolve without breaking
// stored data. Notes are free text.
import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const stmts = [
  `CREATE TABLE IF NOT EXISTS euptd_readiness_responses (
    id TEXT PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    answer TEXT NOT NULL,                       -- 'yes' | 'partial' | 'no' | 'na'
    note TEXT,
    "answeredById" TEXT,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT euptd_orgId_fkey FOREIGN KEY ("orgId") REFERENCES organisations(id) ON DELETE CASCADE,
    CONSTRAINT euptd_answeredBy_fkey FOREIGN KEY ("answeredById") REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS euptd_org_item_idx ON euptd_readiness_responses("orgId", "itemId")`,
  `CREATE INDEX IF NOT EXISTS euptd_org_idx ON euptd_readiness_responses("orgId")`,
];

for (const sql of stmts) {
  await c.query(sql);
  console.log('  ✓', sql.replace(/\s+/g, ' ').slice(0, 80) + '…');
}
await c.end();
console.log('Done.');
