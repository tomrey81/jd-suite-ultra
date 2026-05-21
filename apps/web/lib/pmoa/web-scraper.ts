// Web intelligence scraper for PMOA.
// Fetches company website pages to find:
//   - Leadership / org structure hints
//   - Investor relations (public companies)
//   - Current news / press releases

const FETCH_TIMEOUT_MS = 12_000;
const MAX_PAGE_CHARS = 20_000;

// ── Path candidates ──────────────────────────────────────────────────────────

const ORG_PATHS = [
  '/about',
  '/about-us',
  '/about/leadership',
  '/about/team',
  '/about/management',
  '/about/executive-team',
  '/leadership',
  '/leadership-team',
  '/management',
  '/management-team',
  '/team',
  '/our-team',
  '/executives',
  '/board-of-directors',
  '/company',
  '/company/leadership',
];

const IR_PATHS = [
  '/investor-relations',
  '/investors',
  '/ir',
  '/investor-relations/corporate-governance',
  '/investor-relations/leadership',
  '/investor-relations/annual-report',
  '/annual-report',
  '/annual-reports',
  '/governance',
  '/corporate-governance',
];

const NEWS_PATHS = [
  '/news',
  '/newsroom',
  '/press',
  '/press-releases',
  '/media',
  '/media-centre',
  '/media-center',
  '/blog',
  '/updates',
  '/investor-relations/news',
  '/investor-relations/press-releases',
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScrapedPage {
  url: string;
  category: 'org' | 'ir' | 'news';
  title: string;
  text: string;
  fetchedAt: string;
}

export interface CompanyIntel {
  orgPages: ScrapedPage[];
  irPages: ScrapedPage[];
  newsPages: ScrapedPage[];
  scrapedAt: string;
  baseUrl: string;
}

// ── HTML → plain text ────────────────────────────────────────────────────────

function htmlToText(html: string): string {
  // Remove script / style blocks
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // Replace block elements with newlines
  t = t
    .replace(/<\/(p|div|section|article|header|footer|h[1-6]|li|tr|td|th|blockquote)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n');

  // Strip remaining tags
  t = t.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  t = t
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');

  // Collapse whitespace
  t = t
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n');

  return t.slice(0, MAX_PAGE_CHARS);
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 120) : '';
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<{ html: string; ok: boolean }> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OrgIntelBot/1.0; research purposes)',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { html: '', ok: false };
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('html')) return { html: '', ok: false };
    const html = await res.text();
    return { html, ok: true };
  } catch {
    return { html: '', ok: false };
  }
}

/** Try each candidate path; return first successful page (non-empty text). */
async function tryPaths(
  baseUrl: string,
  paths: string[],
  category: ScrapedPage['category'],
  limit: number,
): Promise<ScrapedPage[]> {
  const results: ScrapedPage[] = [];
  for (const path of paths) {
    if (results.length >= limit) break;
    const url = `${baseUrl}${path}`;
    const { html, ok } = await fetchPage(url);
    if (!ok) continue;
    const text = htmlToText(html);
    if (text.length < 100) continue; // skip empty / error pages
    const title = extractTitle(html);
    results.push({ url, category, title, text, fetchedAt: new Date().toISOString() });
  }
  return results;
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function scrapeCompanyIntel(opts: {
  baseUrl: string;
  companyName: string;
  isPublicCompany: boolean;
}): Promise<CompanyIntel> {
  const { baseUrl, isPublicCompany } = opts;

  const [orgPages, irPages, newsPages] = await Promise.all([
    tryPaths(baseUrl, ORG_PATHS, 'org', 3),
    isPublicCompany ? tryPaths(baseUrl, IR_PATHS, 'ir', 3) : Promise.resolve([]),
    tryPaths(baseUrl, NEWS_PATHS, 'news', 3),
  ]);

  return {
    orgPages,
    irPages,
    newsPages,
    scrapedAt: new Date().toISOString(),
    baseUrl,
  };
}
