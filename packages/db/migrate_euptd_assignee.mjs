// Add assignee + cadence fields to euptd_readiness_responses.
// Idempotent.
import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const stmts = [
  `ALTER TABLE euptd_readiness_responses ADD COLUMN IF NOT EXISTS "assignedToId" TEXT`,
  `ALTER TABLE euptd_readiness_responses ADD COLUMN IF NOT EXISTS "reviewBy" TIMESTAMP(3)`,
  // FK to users when nullable — set null on user delete
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'euptd_assignedTo_fkey'
     ) THEN
       ALTER TABLE euptd_readiness_responses
       ADD CONSTRAINT "euptd_assignedTo_fkey"
       FOREIGN KEY ("assignedToId") REFERENCES users(id) ON DELETE SET NULL;
     END IF;
   END $$`,
  `CREATE INDEX IF NOT EXISTS euptd_assignedTo_idx ON euptd_readiness_responses("assignedToId")`,
];
for (const sql of stmts) {
  await c.query(sql);
  console.log('  ✓', sql.replace(/\s+/g, ' ').slice(0, 80) + '…');
}
await c.end();
console.log('Done.');
