// Direct SQL migration to add new fields and tables.
// Bypasses prisma db push to preserve unrelated `photos` table.
// Idempotent: safe to re-run.
import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const stmts = [
  // Extend users
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS "firstName" TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastName" TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS "country" TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS "jobFunction" TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS "dataConsentAt" TIMESTAMP(3)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS "marketingOptIn" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false`,

  // AccessCode table
  `CREATE TABLE IF NOT EXISTS access_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    label TEXT,
    "maxUses" INTEGER,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    active BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS access_codes_code_idx ON access_codes(code)`,

  // AccessCodeUse table
  `CREATE TABLE IF NOT EXISTS access_code_uses (
    id TEXT PRIMARY KEY,
    "accessCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT access_code_uses_accessCodeId_fkey FOREIGN KEY ("accessCodeId") REFERENCES access_codes(id) ON DELETE CASCADE,
    CONSTRAINT access_code_uses_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT access_code_uses_accessCodeId_userId_key UNIQUE ("accessCodeId", "userId")
  )`,
];

for (const sql of stmts) {
  await client.query(sql);
  const preview = sql.replace(/\s+/g, ' ').slice(0, 80);
  console.log('  ✓', preview + (sql.length > 80 ? '...' : ''));
}

// Promote tomek to platform admin (use the email from env or first user)
const tomek = await client.query(`UPDATE users SET "isPlatformAdmin" = true WHERE email ILIKE 'demo@quadrance.app' OR email ILIKE 'tomek%' OR email ILIKE 'tomasz%' RETURNING email`);
console.log(`Platform admins now: ${tomek.rows.map(r => r.email).join(', ') || '(none — set manually)'}`);

// Seed an initial access code for testing
await client.query(`
  INSERT INTO access_codes (id, code, label, "maxUses", active)
  VALUES (gen_random_uuid()::text, 'JDSUITE-EARLY', 'Initial early-access wave', NULL, true)
  ON CONFLICT (code) DO NOTHING
`);
console.log("Seeded access code: JDSUITE-EARLY");

await client.end();
console.log('Migration complete.');
