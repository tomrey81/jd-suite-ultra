/* ============================================
   ADMIN ROUTES — /api/admin
   - Login / change-password / token revocation
   - Generic key-value settings editor (with sanitize-html)
   - Action history (audit log)
   ============================================ */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const sanitizeHtml = require('sanitize-html');
const { loginRateLimiter } = require('../middleware/security');
const {
  loadCredentials,
  saveCredentials,
  bumpTokenVersion,
  consumePendingChange,
  hashPassword,
  verifyPassword,
} = require('../config/credentialStore');

const router = express.Router();

const HISTORY_FILE  = path.join(__dirname, '../../.admin-history.json');
const SETTINGS_FILE = path.join(__dirname, '../../.settings-data.json');

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production.');
}
if (!process.env.JWT_SECRET) {
  console.warn('[admin] JWT_SECRET not set — using ephemeral random secret.');
}
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRY = '8h';

// ── Sanitizer for stored content (rendered with innerHTML on the public site) ──
const CONTENT_SANITIZE_OPTS = {
  allowedTags: ['b', 'i', 'em', 'strong', 'u', 'small', 'br', 'span', 'a', 'p'],
  allowedAttributes: {
    a:    ['href', 'target', 'rel'],
    span: ['class'],
    p:    ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
  },
  disallowedTagsMode: 'discard',
};

// Strip invisible/control characters before HTML parsing — defeats Unicode-
// based scheme bypasses like `java<ZWJ>script:`.
const INVISIBLE_RE = new RegExp(
  '[\\u0000-\\u001F\\u007F-\\u009F\\u00AD\\u200B-\\u200F\\u2028-\\u202F\\u2060-\\u206F\\uFEFF]',
  'g'
);
function sanitizeContentValue(s) {
  if (typeof s !== 'string') return '';
  return sanitizeHtml(s.replace(INVISIBLE_RE, ''), CONTENT_SANITIZE_OPTS);
}

// ── JSON file helpers ──
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function logHistory(actor, action, detail) {
  const history = readJSON(HISTORY_FILE, []);
  history.unshift({
    timestamp: new Date().toISOString(),
    actor: actor || { role: 'unknown', ip: null },
    action,
    detail: detail || null,
  });
  writeJSON(HISTORY_FILE, history.slice(0, 200));
}
function actorOf(req) {
  return {
    role: (req.adminUser && req.adminUser.role) || 'unknown',
    ip: req.ip || null,
  };
}

// ── Auth middleware ──
async function requireAuth(req, res, next) {
  const header = (req.headers.authorization || '').replace('Bearer ', '');
  if (!header) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(header, JWT_SECRET);
    const creds = await loadCredentials();
    if ((payload.v || 0) !== (creds.tokenVersion || 1)) {
      return res.status(401).json({ error: 'Token revoked. Please log in again.' });
    }
    req.adminUser = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// ════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════

/** POST /api/admin/login */
router.post('/login', loginRateLimiter, async (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password required' });
  }
  let creds;
  try { creds = await loadCredentials(); }
  catch { return res.status(500).json({ error: 'Credential store unavailable' }); }

  if (!creds.passwordHash) {
    return res.status(403).json({ error: 'No admin password configured. Set ADMIN_DEFAULT_PASSWORD and restart.' });
  }
  if (!verifyPassword(password, creds.passwordHash)) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = jwt.sign(
    { role: 'admin', v: creds.tokenVersion || 1 },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
  res.json({ token, mustChangePassword: !!creds.mustChangePassword });
});

/** POST /api/admin/logout */
router.post('/logout', (req, res) => res.json({ ok: true }));

/** POST /api/admin/change-password */
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both passwords required' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  const creds = await loadCredentials();
  if (!verifyPassword(currentPassword, creds.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  creds.pendingChange = {
    newPasswordHash: hashPassword(newPassword),
    token,
    expires: Date.now() + 30 * 60 * 1000,
  };
  await saveCredentials(creds);

  try {
    const { sendPasswordChangeConfirmation } = require('../config/email');
    // Hardcoded canonical hostname — never use req.get('host') here.
    const baseUrl = process.env.PUBLIC_HOSTNAME
      ? `https://${process.env.PUBLIC_HOSTNAME}`
      : `${req.protocol}://${req.get('host')}`; // dev only
    await sendPasswordChangeConfirmation(token, baseUrl);
    logHistory(actorOf(req), 'password_change_requested');
    res.json({ ok: true, message: 'Confirmation email sent.' });
  } catch (err) {
    creds.pendingChange = null;
    await saveCredentials(creds);
    res.status(500).json({ error: 'Could not send confirmation email. Password was NOT changed.' });
  }
});

/** GET /api/admin/confirm-password?token=... */
router.get('/confirm-password', async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') return res.status(400).send('Missing token');

  const result = await consumePendingChange(token);
  if (result.applied) {
    return res.send('<html><body style="font-family:Inter,sans-serif;text-align:center;padding:80px"><h2 style="color:#1e7f3c">Password changed.</h2><p>Please log in again.</p><p><a href="/admin.html">→ Admin panel</a></p></body></html>');
  }
  if (result.reason === 'expired') {
    return res.status(400).send('<html><body style="font-family:Inter,sans-serif;text-align:center;padding:80px"><h2>Link expired.</h2><p><a href="/admin.html">Back to panel</a></p></body></html>');
  }
  return res.status(400).send('<html><body style="font-family:Inter,sans-serif;text-align:center;padding:80px"><h2>Invalid or used link.</h2><p><a href="/admin.html">Back to panel</a></p></body></html>');
});

/** POST /api/admin/revoke-tokens — emergency "log everyone out" */
router.post('/revoke-tokens', requireAuth, async (req, res) => {
  try {
    const v = await bumpTokenVersion();
    logHistory(actorOf(req), 'tokens_revoked');
    res.json({ ok: true, tokenVersion: v });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════
// SETTINGS — generic key/value editor
// ════════════════════════════════════════════════════════════

/** GET /api/admin/settings */
router.get('/settings', requireAuth, (req, res) => {
  res.json({ settings: readJSON(SETTINGS_FILE, {}) });
});

/** POST /api/admin/settings — body: { settings: { key: "html-string", ... } } */
router.post('/settings', requireAuth, (req, res) => {
  const incoming = req.body && req.body.settings;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const has = Object.prototype.hasOwnProperty;
  const sanitized = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (typeof k !== 'string' || k.length > 200) continue;
    if (k.startsWith('__') || k === 'constructor' || k === 'prototype') continue; // belt-and-suspenders
    if (!has.call(incoming, k)) continue;
    sanitized[k] = sanitizeContentValue(String(v));
  }
  writeJSON(SETTINGS_FILE, sanitized);
  logHistory(actorOf(req), 'settings_updated', { keys: Object.keys(sanitized).length });
  res.json({ ok: true, keys: Object.keys(sanitized).length });
});

/** Public read-only endpoint so the front of your site can fetch published values */
router.get('/public-settings', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json(readJSON(SETTINGS_FILE, {}));
});

// ════════════════════════════════════════════════════════════
// HISTORY (audit log)
// ════════════════════════════════════════════════════════════

/** GET /api/admin/history?limit=50 */
router.get('/history', requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  res.json({ history: readJSON(HISTORY_FILE, []).slice(0, limit) });
});

module.exports = router;
