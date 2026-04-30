/* ============================================
   SUBMISSIONS ROUTES — /api/submissions
   - POST /          public form submission
   - GET  /list      admin-key-protected
   - GET  /:id       admin-key-protected
   ============================================ */

const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const { contactRateLimiter, sanitizeInput } = require('../middleware/security');

let pool = null;
try { pool = require('../config/database').pool; } catch { /* no DB */ }

if (!process.env.ADMIN_API_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('ADMIN_API_KEY must be set in production.');
}

function isValidAdminKey(provided) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || !provided) return false;
  try {
    if (Buffer.byteLength(provided) !== Buffer.byteLength(expected)) return false;
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch { return false; }
}

const router = express.Router();
const FALLBACK_FILE = path.join(__dirname, '../../.submissions.json');

function appendFallback(s) {
  let arr = [];
  try { arr = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf8')); } catch {}
  arr.unshift({ ...s, id: crypto.randomUUID(), created_at: new Date().toISOString() });
  fs.writeFileSync(FALLBACK_FILE, JSON.stringify(arr.slice(0, 500), null, 2));
  return arr[0];
}

/**
 * POST /api/submissions — public form
 */
router.post('/',
  contactRateLimiter,
  sanitizeInput,
  [
    body('name').isLength({ min: 1, max: 255 }).withMessage('Name required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('subject').optional().isLength({ max: 255 }),
    body('message').optional().isLength({ max: 4000 }),
  ],
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errs.array() });
    }
    const { name, email, subject, message } = req.body;

    let saved;
    if (pool && process.env.DATABASE_URL) {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS submissions (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name        VARCHAR(255) NOT NULL,
            email       VARCHAR(255) NOT NULL,
            subject     VARCHAR(255),
            message     TEXT,
            status      VARCHAR(50) DEFAULT 'new',
            ip_address  INET,
            user_agent  TEXT,
            created_at  TIMESTAMPTZ DEFAULT NOW()
          );
        `);
        const r = await pool.query(
          `INSERT INTO submissions (name, email, subject, message, ip_address, user_agent)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [name, email, subject || null, message || null, req.ip, req.get('user-agent') || null]
        );
        saved = { id: r.rows[0].id };
      } catch (e) {
        console.error('DB insert failed; falling back to file:', e.message);
        saved = appendFallback({ name, email, subject, message });
      }
    } else {
      saved = appendFallback({ name, email, subject, message });
    }

    // Optional email notification
    try {
      const { sendSubmissionNotification } = require('../config/email');
      sendSubmissionNotification({ name, email, subject, message }).catch(() => {});
    } catch { /* email module unconfigured */ }

    res.json({ success: true, id: saved.id });
  }
);

/**
 * GET /api/submissions/list — server-to-server, ADMIN_API_KEY required
 */
router.get('/list', async (req, res) => {
  if (!isValidAdminKey(req.get('x-api-key'))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const limit  = Math.min(Math.max(parseInt(req.query.limit, 10)  || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  if (pool && process.env.DATABASE_URL) {
    try {
      const r = await pool.query(
        `SELECT id, name, email, subject, status, created_at FROM submissions
         ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]
      );
      const c = await pool.query('SELECT COUNT(*) AS count FROM submissions');
      return res.json({ items: r.rows, pagination: { limit, offset, total: parseInt(c.rows[0].count) } });
    } catch (e) {
      return res.status(500).json({ error: 'DB error' });
    }
  }
  let arr = [];
  try { arr = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf8')); } catch {}
  res.json({ items: arr.slice(offset, offset + limit), pagination: { limit, offset, total: arr.length } });
});

/** GET /api/submissions/:id */
router.get('/:id', async (req, res) => {
  if (!isValidAdminKey(req.get('x-api-key'))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const id = req.params.id;
  if (pool && process.env.DATABASE_URL) {
    try {
      const r = await pool.query('SELECT * FROM submissions WHERE id = $1', [id]);
      if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
      return res.json(r.rows[0]);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid id' });
    }
  }
  let arr = [];
  try { arr = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf8')); } catch {}
  const found = arr.find(s => s.id === id);
  if (!found) return res.status(404).json({ error: 'Not found' });
  res.json(found);
});

module.exports = router;
