/* ============================================
   ADMIN PANEL LITE — Express server
   ============================================ */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const express = require('express');
const fs = require('fs');
const compression = require('compression');
const morgan = require('morgan');
const {
  cspNonceMiddleware,
  helmetMiddleware,
  corsMiddleware,
  apiRateLimiter,
} = require('./middleware/security');
const adminRoutes = require('./routes/admin');
const submissionsRoutes = require('./routes/submissions');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '../../frontend');

// ── Trust proxy: only when actually behind one (Cloudflare/Railway/nginx) ──
const trustProxy = (() => {
  if (process.env.TRUST_PROXY !== undefined) {
    if (process.env.TRUST_PROXY === 'true')  return 1;
    if (process.env.TRUST_PROXY === 'false') return false;
    const n = parseInt(process.env.TRUST_PROXY, 10);
    if (!Number.isNaN(n)) return n;
    return process.env.TRUST_PROXY;
  }
  return process.env.NODE_ENV === 'production' ? 1 : false;
})();
app.set('trust proxy', trustProxy);

// ── Force HTTPS in production, redirect to canonical hostname ──
const PUBLIC_HOSTNAME = process.env.PUBLIC_HOSTNAME || null;
if (process.env.NODE_ENV === 'production') {
  if (!PUBLIC_HOSTNAME) {
    throw new Error('PUBLIC_HOSTNAME must be set in production (e.g. "example.com").');
  }
  app.use((req, res, next) => {
    if (req.secure && req.hostname === PUBLIC_HOSTNAME) return next();
    return res.redirect(301, 'https://' + PUBLIC_HOSTNAME + req.url);
  });
}

// ── Global middleware ──
app.use(compression());
app.use(cspNonceMiddleware);                 // must precede helmet
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(morgan('combined'));

// Admin gets a slightly larger body limit (settings + history payloads)
app.use('/api/admin', express.json({ limit: '50kb' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ── HTML responses get CSP nonce injected into every <script> ──
function serveHtmlWithNonce(htmlPath) {
  return (req, res) => {
    fs.readFile(htmlPath, 'utf8', (err, html) => {
      if (err) return res.status(404).send('Not found');
      const nonce = res.locals.cspNonce;
      const withNonce = html.replace(
        /<script(?![^>]*\bnonce=)([^>]*)>/gi,
        `<script nonce="${nonce}"$1>`
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(withNonce);
    });
  };
}

// Auto-register every *.html in frontend/
if (fs.existsSync(FRONTEND_DIR)) {
  fs.readdirSync(FRONTEND_DIR)
    .filter(f => f.endsWith('.html'))
    .forEach(file => {
      const full = path.join(FRONTEND_DIR, file);
      if (file === 'index.html') app.get('/', serveHtmlWithNonce(full));
      app.get('/' + file, serveHtmlWithNonce(full));
    });

  // Serve other static assets (js/, css/, assets/) — but never the .html
  // files (those go through the nonce injector above).
  app.use(express.static(FRONTEND_DIR, {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true,
    index: false,
    extensions: false,
  }));
}

// ── API routes ──
app.use('/api', apiRateLimiter);
app.use('/api/admin', adminRoutes);
app.use('/api/submissions', submissionsRoutes);

// Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'admin-panel-lite',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// SPA fallback
app.get('*', serveHtmlWithNonce(path.join(FRONTEND_DIR, 'index.html')));

// Error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  if (err.message === 'CORS: Origin not allowed') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Admin Panel Lite — listening on :${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app;
