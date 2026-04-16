// ── Cloudflare Worker: Notion API CORS Proxy ───────────────────────────────
// Deploy: wrangler deploy worker.js --name jd-notion-proxy
// Accepts POST with { method, path, body, token }
// Forwards to https://api.notion.com/v1/{path}
// Rate-limits to 3 req/sec per IP (Notion's limit)

const NOTION_BASE = 'https://api.notion.com/v1/';
const NOTION_VERSION = '2022-06-28';
const RATE_LIMIT = 3; // requests per second per IP
const ipBuckets = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const bucket = ipBuckets.get(ip) || { count: 0, reset: now + 1000 };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + 1000;
  }
  bucket.count++;
  ipBuckets.set(ip, bucket);
  return bucket.count <= RATE_LIMIT;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded (3 req/sec)' }), {
        status: 429,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    try {
      const { method = 'GET', path, body, token } = await request.json();

      if (!path || !token) {
        return new Response(JSON.stringify({ error: 'path and token required' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      }

      const url = NOTION_BASE + path;
      const fetchOpts = {
        method: method.toUpperCase(),
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
      };

      if (body && method.toUpperCase() !== 'GET') {
        fetchOpts.body = JSON.stringify(body);
      }

      const res = await fetch(url, fetchOpts);
      const data = await res.text();

      return new Response(data, {
        status: res.status,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }
  },
};
