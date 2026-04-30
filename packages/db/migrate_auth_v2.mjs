// Auth v2: extra consents + auth_tokens table.
// Direct SQL — idempotent.
import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const stmts = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS "newsletterOptIn" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS "tosAcceptedAt" TIMESTAMP(3)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" TIMESTAMP(3)`,

  // Single auth_tokens table for both password-reset and magic-link.
  // kind = 'reset' | 'magic'
  `CREATE TABLE IF NOT EXISTS auth_tokens (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,                  -- reset | magic
    "tokenHash" TEXT NOT NULL UNIQUE,    -- SHA-256 of the raw token; raw never stored
    email TEXT NOT NULL,                  -- denormalised: works for magic-link before user exists
    "userId" TEXT,                        -- nullable for magic-link if user not found at issue
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "issuedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT auth_tokens_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS auth_tokens_kind_idx ON auth_tokens(kind)`,
  `CREATE INDEX IF NOT EXISTS auth_tokens_email_idx ON auth_tokens(email)`,
  `CREATE INDEX IF NOT EXISTS auth_tokens_expires_idx ON auth_tokens("expiresAt")`,
];

for (const sql of stmts) {
  await c.query(sql);
  console.log('  ✓', sql.replace(/\s+/g, ' ').slice(0, 80) + '…');
}

const gc = await c.query(`DELETE FROM auth_tokens WHERE "expiresAt" < NOW() - INTERVAL '1 day' RETURNING id`);
console.log(`Cleaned ${gc.rowCount} stale tokens`);

await c.end();
console.log('Auth v2 schema applied.');
