/**
 * Realistic-browser HTTP fetch helper. Used when scraping career-site
 * HTML directly (no Adzuna). Rotates User-Agent strings; realistic
 * Accept / Accept-Language headers help bypass naive bot filters.
 *
 * Important: many sites (LinkedIn, anything fronted by Cloudflare's
 * advanced challenge, anything requiring JS) will still block us. The
 * caller should fall back to a "paste HTML" flow on persistent failure.
 */

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
];

export async function fetchAsBrowser(url: string, opts: { timeout?: number } = {}): Promise<{
  ok: boolean;
  status: number;
  html?: string;
  error?: string;
  finalUrl?: string;
}> {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout ?? 15_000);

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': ua,
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,pl;q=0.8,de;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'DNT': '1',
      },
    });

    if (!res.ok) {
      // Common bot-block signals
      let hint = '';
      if (res.status === 403) hint = ' — site blocking automated access (Cloudflare / WAF).';
      if (res.status === 429) hint = ' — rate-limited.';
      if (res.status === 999) hint = ' — LinkedIn anti-bot.';
      return { ok: false, status: res.status, error: `HTTP ${res.status}${hint}` };
    }

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('application/xhtml') && !ct.includes('text/plain')) {
      return { ok: false, status: res.status, error: `Unexpected content-type: ${ct}` };
    }
    const html = await res.text();

    // Some sites return 200 + a captcha / "are you human" page.
    const lower = html.toLowerCase();
    if (
      lower.includes('captcha') && (lower.includes('cf-challenge') || lower.includes('hcaptcha') || lower.includes('recaptcha'))
    ) {
      return { ok: false, status: 200, error: 'Site returned a CAPTCHA challenge page.', html };
    }
    if (lower.includes('please enable javascript') && html.length < 5000) {
      return { ok: false, status: 200, error: 'Site requires JavaScript to render listings (SPA).', html };
    }

    return { ok: true, status: res.status, html, finalUrl: res.url };
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.name === 'AbortError') return { ok: false, status: 0, error: 'Timeout' };
    return { ok: false, status: 0, error: e.message || 'Network error' };
  } finally {
    clearTimeout(t);
  }
}
