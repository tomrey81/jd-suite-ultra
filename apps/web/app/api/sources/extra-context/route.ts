/**
 * POST /api/sources/extra-context
 *
 * Fetches a URL and classifies it as extra context for a job posting analysis.
 * Returns a structured ExtraContextItem with reliability score, risk level,
 * and recommendation for how to use this source.
 *
 * Lawful: only accesses publicly reachable pages. Stops on auth wall / robots block.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ── Source type detection ─────────────────────────────────────────────────────

const SOURCE_TYPE_RULES: Array<{
  type: string;
  patterns: RegExp[];
  reliability: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
}> = [
  {
    type: 'annual_report',
    patterns: [/annual.report/i, /investor.relations/i, /ir\./i, /\/ir\//i, /10-k/i, /annual-report/i],
    reliability: 90,
    risk: 'LOW',
  },
  {
    type: 'press_release',
    patterns: [/press.release/i, /newsroom/i, /news-release/i, /pr\.com/i, /prnewswire/i, /businesswire/i, /globenewswire/i],
    reliability: 75,
    risk: 'LOW',
  },
  {
    type: 'news',
    patterns: [/\.reuters\.com/i, /\.bloomberg\.com/i, /\.ft\.com/i, /\.wsj\.com/i, /\.economist\.com/i, /techcrunch/i, /\.forbes\.com/i, /\/news\//i],
    reliability: 70,
    risk: 'MEDIUM',
  },
  {
    type: 'ir',
    patterns: [/investors\./i, /investor\./i, /\.investor\./i, /sec\.gov/i, /edgar/i, /sedar/i],
    reliability: 88,
    risk: 'LOW',
  },
  {
    type: 'blog',
    patterns: [/\/blog\//i, /medium\.com/i, /substack\.com/i, /\/insights\//i, /\/thought-leadership\//i],
    reliability: 50,
    risk: 'MEDIUM',
  },
  {
    type: 'website',
    patterns: [/\/about/i, /\/company/i, /\/who-we-are/i, /\/our-story/i, /\/mission/i],
    reliability: 60,
    risk: 'LOW',
  },
];

function detectSourceType(url: string): { type: string; reliability: number; risk: 'LOW' | 'MEDIUM' | 'HIGH' } {
  for (const rule of SOURCE_TYPE_RULES) {
    if (rule.patterns.some((p) => p.test(url))) {
      return { type: rule.type, reliability: rule.reliability, risk: rule.risk };
    }
  }
  return { type: 'website', reliability: 55, risk: 'LOW' };
}

// ── Text helpers ──────────────────────────────────────────────────────────────

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  if (m) return m[1].replace(/\s+/g, ' ').trim();
  const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]{1,200})"/i);
  if (og) return og[1].trim();
  return '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractSummary(html: string, maxChars = 600): string {
  // Try og:description first
  const og = html.match(/<meta[^>]+(?:property="og:description"|name="description")[^>]+content="([^"]{20,500})"/i);
  if (og) return og[1].trim();
  // Fall back to first meaningful text block
  const text = stripHtml(html);
  return text.slice(0, maxChars).trim();
}

function extractPublishedAt(html: string): string | null {
  const datePatterns = [
    /<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i,
    /<time[^>]+datetime="([^"]+)"/i,
    /<meta[^>]+name="date"[^>]+content="([^"]+)"/i,
  ];
  for (const p of datePatterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return null;
}

function buildRelevanceNote(sourceType: string, title: string, context: string): string {
  const base = `${sourceType.replace('_', ' ')} source: "${title.slice(0, 80)}".`;
  if (!context) return base;
  return `${base} Fetched in context of: ${context.slice(0, 100)}.`;
}

function buildRecommendation(
  reliability: number,
  risk: 'LOW' | 'MEDIUM' | 'HIGH',
  sourceType: string,
): 'INCLUDE' | 'KEEP_AS_CONTEXT' | 'IGNORE' {
  if (risk === 'HIGH') return 'IGNORE';
  if (reliability >= 80 && risk === 'LOW') return 'INCLUDE';
  if (sourceType === 'news' || sourceType === 'blog') return 'KEEP_AS_CONTEXT';
  return 'KEEP_AS_CONTEXT';
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    url?: string;
    contextTitle?: string;
    contextCompany?: string;
  } | null;

  if (!body?.url?.trim()) return NextResponse.json({ error: 'url is required' }, { status: 400 });

  const rawUrl = body.url.trim();
  if (!/^https?:\/\//i.test(rawUrl)) {
    return NextResponse.json({ error: 'url must start with http(s)://' }, { status: 400 });
  }

  const { type, reliability, risk } = detectSourceType(rawUrl);

  // Fetch the page (3s timeout, user-agent neutral)
  let html = '';
  let fetchError: string | null = null;
  let publishedAt: string | null = null;
  let pageTitle = '';
  let summary = '';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(rawUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JDSuiteBot/1.0; research-only)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);

    if (res.status === 401 || res.status === 403) {
      fetchError = `Access restricted (HTTP ${res.status}) — authentication may be required.`;
    } else if (!res.ok) {
      fetchError = `HTTP ${res.status} — page not accessible.`;
    } else {
      html = await res.text();
      pageTitle = extractTitle(html);
      summary = extractSummary(html);
      publishedAt = extractPublishedAt(html);
    }
  } catch (err: unknown) {
    fetchError = err instanceof Error && err.name === 'AbortError'
      ? 'Request timed out after 8s — page may be slow or unreachable.'
      : `Network error: ${err instanceof Error ? err.message : String(err)}`;
  }

  const contextStr = [body.contextTitle, body.contextCompany].filter(Boolean).join(' @ ');
  const recommendation = buildRecommendation(reliability, risk, type);

  return NextResponse.json({
    ok: true,
    item: {
      sourceType: type,
      title: pageTitle || rawUrl,
      url: rawUrl,
      publishedAt: publishedAt ?? null,
      summary: fetchError ?? summary,
      relevanceToJd: buildRelevanceNote(type, pageTitle || rawUrl, contextStr),
      reliabilityScore: reliability,
      riskLevel: risk,
      recommendation,
      fetchError: fetchError ?? null,
    },
  });
}
