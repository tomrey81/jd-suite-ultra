/* ============================================
   SECURITY MIDDLEWARE
   - Helmet (CSP w/ nonce, HSTS, frame-ancestors, etc.)
   - CORS
   - Rate limiters (contact form, login, general API)
   - Body sanitizer
   ============================================ */

const helmet = require('helmet');
const cors = require('cors');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// Per-request CSP nonce. Attach a fresh value before the helmet middleware
// so HTML responses can mark inline <script> tags as trusted.
function cspNonceMiddleware(req, res, next) {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
}

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrc:  [
        "'self'",
        (req, res) => `'nonce-${res.locals.cspNonce}'`,
      ],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc:  ["'none'"],
      baseUri:    ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// CORS: explicit allowlist, no wildcards
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',').map(o => o.trim()).filter(Boolean);

const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // server-to-server
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS: Origin not allowed'));
  },
  methods: ['GET', 'POST', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
  credentials: true,
  maxAge: 86400,
});

// Rate limiters
const contactRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 5,
  message: { error: 'Too many submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Coarse first-pass body sanitizer. Per-endpoint validators (express-validator,
// sanitize-html for content) are still required for real defense.
function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const [k, v] of Object.entries(req.body)) {
      if (typeof v === 'string') {
        req.body[k] = v.replace(/<[^>]*>/g, '').trim();
      }
    }
  }
  next();
}

module.exports = {
  cspNonceMiddleware,
  helmetMiddleware,
  corsMiddleware,
  contactRateLimiter,
  apiRateLimiter,
  loginRateLimiter,
  sanitizeInput,
};
