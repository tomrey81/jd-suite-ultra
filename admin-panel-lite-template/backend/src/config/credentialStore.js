/* ============================================
   ADMIN CREDENTIAL STORE
   Postgres-backed with JSON-file fallback.

   When DATABASE_URL is set, stores credentials in `admin_credentials`.
   When it isn't, falls back to .admin-credentials.json (single-instance only).

   Exposes:
     loadCredentials, saveCredentials
     bumpTokenVersion          — invalidates every JWT issued before now
     consumePendingChange      — atomic, race-free password-change confirm
     hashPassword, verifyPassword
   ============================================ */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CREDS_FILE = path.join(__dirname, '../../.admin-credentials.json');
const DEFAULT_PW = process.env.ADMIN_DEFAULT_PASSWORD || null;

let pool = null;
try { pool = require('./database').pool; } catch (_) { /* file mode */ }
const usingDb = () => !!(pool && process.env.DATABASE_URL);

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(pw, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  try {
    const check = crypto.scryptSync(pw, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(check));
  } catch (_) {
    return false;
  }
}

// ── DB-backed store ─────────────────────────────────────────
async function ensureDbSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_credentials (
      id              INTEGER PRIMARY KEY DEFAULT 1,
      password_hash   TEXT,
      must_change     BOOLEAN DEFAULT TRUE,
      pending_change  JSONB,
      token_version   INTEGER DEFAULT 1,
      updated_at      TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT one_row CHECK (id = 1)
    );
  `);
}

function rowToCreds(row) {
  if (!row) return null;
  return {
    passwordHash: row.password_hash || null,
    mustChangePassword: !!row.must_change,
    pendingChange: row.pending_change || null,
    tokenVersion: row.token_version || 1,
  };
}

async function loadFromDb() {
  await ensureDbSchema();
  const r = await pool.query('SELECT * FROM admin_credentials WHERE id = 1');
  if (r.rows[0]) return rowToCreds(r.rows[0]);

  const seeded = DEFAULT_PW
    ? { passwordHash: hashPassword(DEFAULT_PW), mustChangePassword: true, pendingChange: null, tokenVersion: 1 }
    : { passwordHash: null, mustChangePassword: true, pendingChange: null, tokenVersion: 1 };
  await saveToDb(seeded);
  return seeded;
}

async function saveToDb(creds) {
  await pool.query(`
    INSERT INTO admin_credentials (id, password_hash, must_change, pending_change, token_version, updated_at)
    VALUES (1, $1, $2, $3, $4, NOW())
    ON CONFLICT (id) DO UPDATE SET
      password_hash  = EXCLUDED.password_hash,
      must_change    = EXCLUDED.must_change,
      pending_change = EXCLUDED.pending_change,
      token_version  = EXCLUDED.token_version,
      updated_at     = NOW()
  `, [
    creds.passwordHash,
    !!creds.mustChangePassword,
    creds.pendingChange ? JSON.stringify(creds.pendingChange) : null,
    creds.tokenVersion || 1,
  ]);
}

// ── File-backed fallback ────────────────────────────────────
function loadFromFile() {
  try {
    if (fs.existsSync(CREDS_FILE)) {
      const c = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
      if (typeof c.tokenVersion !== 'number') c.tokenVersion = 1;
      return c;
    }
  } catch (_) { /* fall through */ }
  if (!DEFAULT_PW) {
    return { passwordHash: null, mustChangePassword: true, pendingChange: null, tokenVersion: 1 };
  }
  const seeded = { passwordHash: hashPassword(DEFAULT_PW), mustChangePassword: true, pendingChange: null, tokenVersion: 1 };
  saveToFile(seeded);
  return seeded;
}

function saveToFile(creds) {
  fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2), 'utf8');
}

// ── Public async API ────────────────────────────────────────
async function loadCredentials() {
  return usingDb() ? loadFromDb() : loadFromFile();
}

async function saveCredentials(creds) {
  if (usingDb()) await saveToDb(creds);
  else saveToFile(creds);
}

async function bumpTokenVersion() {
  const creds = await loadCredentials();
  creds.tokenVersion = (creds.tokenVersion || 1) + 1;
  await saveCredentials(creds);
  return creds.tokenVersion;
}

/**
 * Atomic password-change confirmation. In Postgres mode the UPDATE-with-
 * RETURNING ensures at most one parallel call wins. In file mode Node's
 * single event loop serializes naturally.
 */
async function consumePendingChange(token) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 256) {
    return { applied: false, reason: 'invalid' };
  }

  if (usingDb()) {
    const result = await pool.query(`
      WITH current AS (
        SELECT id, pending_change, token_version
        FROM admin_credentials WHERE id = 1 FOR UPDATE
      ),
      valid AS (
        SELECT id FROM current
        WHERE pending_change IS NOT NULL
          AND pending_change->>'token' = $1
          AND ((pending_change->>'expires')::bigint > $2)
      )
      UPDATE admin_credentials c SET
        password_hash  = current.pending_change->>'newPasswordHash',
        pending_change = NULL,
        must_change    = false,
        token_version  = current.token_version + 1,
        updated_at     = NOW()
      FROM current
      WHERE c.id = 1 AND c.id IN (SELECT id FROM valid)
      RETURNING c.token_version
    `, [token, Date.now()]);
    if (result.rowCount === 1) return { applied: true, tokenVersion: result.rows[0].token_version };
    const peek = await pool.query('SELECT pending_change FROM admin_credentials WHERE id = 1');
    const pc = peek.rows[0] && peek.rows[0].pending_change;
    if (pc && pc.token === token && Number(pc.expires) <= Date.now()) {
      await pool.query('UPDATE admin_credentials SET pending_change = NULL, updated_at = NOW() WHERE id = 1');
      return { applied: false, reason: 'expired' };
    }
    return { applied: false, reason: 'invalid' };
  }

  const creds = await loadCredentials();
  const pc = creds.pendingChange;
  if (!pc || typeof pc.token !== 'string' || pc.token.length !== token.length ||
      !crypto.timingSafeEqual(Buffer.from(pc.token), Buffer.from(token))) {
    return { applied: false, reason: 'invalid' };
  }
  if (Date.now() > pc.expires) {
    creds.pendingChange = null;
    await saveCredentials(creds);
    return { applied: false, reason: 'expired' };
  }
  creds.passwordHash = pc.newPasswordHash;
  creds.pendingChange = null;
  creds.mustChangePassword = false;
  creds.tokenVersion = (creds.tokenVersion || 1) + 1;
  await saveCredentials(creds);
  return { applied: true, tokenVersion: creds.tokenVersion };
}

module.exports = {
  loadCredentials,
  saveCredentials,
  bumpTokenVersion,
  consumePendingChange,
  hashPassword,
  verifyPassword,
};
