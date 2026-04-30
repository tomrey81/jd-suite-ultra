// Phase 2 schema migration: JDCheckout + AdminAuditLog
// Direct SQL to preserve unrelated `photos` table.
import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const stmts = [
  // JDCheckoutStatus enum
  `DO $$ BEGIN
    CREATE TYPE "JDCheckoutStatus" AS ENUM ('CHECKED_OUT','CHECKED_IN','ABANDONED');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  // JDCheckout
  `CREATE TABLE IF NOT EXISTS jd_checkouts (
    id TEXT PRIMARY KEY,
    "jdId" TEXT NOT NULL,
    "actorId" TEXT,
    "hashAlgo" TEXT NOT NULL DEFAULT 'sha256',
    "checkoutHash" TEXT NOT NULL,
    "checkinHash" TEXT,
    snapshot JSONB NOT NULL,
    status "JDCheckoutStatus" NOT NULL DEFAULT 'CHECKED_OUT',
    "tamperFlag" BOOLEAN NOT NULL DEFAULT false,
    "checkedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInAt" TIMESTAMP(3),
    note TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS jd_checkouts_jdId_idx ON jd_checkouts("jdId")`,
  `CREATE INDEX IF NOT EXISTS jd_checkouts_status_idx ON jd_checkouts(status)`,

  // AdminAuditLog
  `CREATE TABLE IF NOT EXISTS admin_audit_log (
    id TEXT PRIMARY KEY,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL DEFAULT 'admin',
    action TEXT NOT NULL,
    detail JSONB,
    ip TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS admin_audit_log_createdAt_idx ON admin_audit_log("createdAt")`,
  `CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx ON admin_audit_log(action)`,
];

for (const sql of stmts) {
  await client.query(sql);
  console.log('  ✓', sql.replace(/\s+/g, ' ').slice(0, 90));
}

await client.end();
console.log('Phase 2 migration complete.');
