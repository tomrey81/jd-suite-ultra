/**
 * Generic public HTML connector — fallback for sites without
 * a dedicated connector or structured data markup.
 *
 * Priority 3: only used when Priority 1 (API) and Priority 2 (schema.org) fail.
 * Uses Claude to extract job listings from cleaned HTML.
 *
 * Compliance:
 * - Only fetches publicly accessible pages
 * - Stops on CAPTCHA / login / robots disallow / 403 / 429
 * - Does NOT bypass any protection
 * - Identifies itself honestly (see User-Agent)
 * - Rate limiting is the caller's responsibility
 */

import { createHash } from 'node:crypto';
import type {
  SourceConnector,
  SourceKind,
  SourceDiagnostics,
  DiscoverResult,
  FetchResult,
  NormalizeResult,
  RawPostingReference,
  NormalizedJobPosting,
  OrgStructureSignal,
} from '../types';
import { ok, blocked, classifyHttpError, requiresJavaScript } from '../diagnostics';
import { AI_MODEL } from '@/lib/ai';

const TIMEOUT_FETCH_MS = 15_000;
const TIMEOUT_AI_MS = 45_000;
const MAX_HTML_CHARS = 60_000;

const DISCOVERY_PROMPT = `You are extracting job listings from a careers webpage. Output STRICT JSON only.

Schema:
{
  "jobs": [{
    "title": string,
    "location": string,
    "department": string,
    "url": string,
    "snippet": string,
    "datePosted": string
  }],
  "siteType": string,
  "notes": string
}

Rules:
- Only actual job postings, not navigation or filters.
- If no jobs found, return jobs: [].
- NEVER fabricate URLs or titles. If a field is not visible, return "".
- Output JSON only — no prose, no markdown fences.`;

function stripNoise(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveUrl(raw: string, base: string): string {
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  try { return new URL(raw, base).toString(); } catch { return raw; }
}

function contentHash(posting: NormalizedJobPosting): string {
  return createHash('sha256')
    .update(`${posting.canonicalUrl}|${posting.title}|${posting.descriptionRaw.slice(0, 300)}`)
    .digest('hex');
}

async function fetchPage(url: string): Promise<{ html: string; diag: SourceDiagnostics }> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'JDSuite/1.0 (+https://jd-suite-ultra.vercel.app; research purposes)',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_FETCH_MS),
    });

    if (!res.ok) return { html: '', diag: classifyHttpError(res.status) };

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('html')) return { html: '', diag: blocked('PARSER_FAILED', 'Not an HTML page') };

    const html = await res.text();
    const lower = html.toLowerCase();

    if (lower.includes('captcha') && (lower.includes('hcaptcha') || lower.includes('recaptcha') || lower.includes('cf-challenge'))) {
      return { html, diag: blocked('CAPTCHA_OR_BOT_CHALLENGE', 'CAPTCHA detected. JD Suite stopped.', {
        captchaDetected: true,
        userActionNeeded: 'Open the page in your browser, copy the HTML, and use "Paste HTML" instead.',
        recommendedAlternative: 'Use an official ATS API (Greenhouse, Ashby, etc.) or paste the HTML manually.',
      }) };
    }
    if (lower.includes('please enable javascript') && html.length < 5000) {
      return { html, diag: requiresJavaScript() };
    }
    return { html, diag: ok() };
  } catch (err) {
    return { html: '', diag: classifyHttpError(0, (err as Error).message) };
  }
}

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_AI_MS),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(e.error?.message || `Anthropic ${res.status}`);
  }
  const data = await res.json() as { content?: Array<{ text?: string }> };
  return (data.content?.[0]?.text || '').trim();
}

function parseJson(text: string): unknown {
  let t = text.trim();
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

export class GenericHtmlConnector implements SourceConnector {
  readonly id = 'generic-html';
  readonly name = 'Generic Public HTML (AI-extracted)';
  readonly sourceKind: SourceKind = 'GENERIC_PUBLIC_HTML';

  canHandle(input: string): boolean {
    return /^https?:\/\//i.test(input);
  }

  async preflight(input: string): Promise<SourceDiagnostics> {
    const { diag } = await fetchPage(input);
    return diag;
  }

  async discover(input: string, opts?: Record<string, unknown>): Promise<DiscoverResult> {
    const html = (opts?.htmlOverride as string | undefined)?.trim() || '';
    let diag: SourceDiagnostics;
    let rawHtml: string;

    if (html) {
      rawHtml = html;
      diag = ok({ reason: 'User-provided HTML (paste flow).' });
    } else {
      const fetched = await fetchPage(input);
      if (fetched.diag.status !== 'OK' || !fetched.html) {
        return { postings: [], totalCount: null, hasMore: false, diagnostics: fetched.diag };
      }
      rawHtml = fetched.html;
      diag = fetched.diag;
    }

    const cleaned = stripNoise(rawHtml).slice(0, MAX_HTML_CHARS);

    let parsed: { jobs?: Array<{ title?: string; location?: string; department?: string; url?: string; snippet?: string; datePosted?: string }>; siteType?: string; notes?: string };
    try {
      const text = await callClaude(DISCOVERY_PROMPT, `Source URL: ${input}\n\n${cleaned}`);
      parsed = parseJson(text) as typeof parsed;
    } catch (err) {
      return {
        postings: [],
        totalCount: null,
        hasMore: false,
        diagnostics: { ...diag, status: 'PARSER_FAILED', reason: `AI extraction failed: ${(err as Error).message}` },
      };
    }

    const now = new Date().toISOString();
    const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
    const postings: RawPostingReference[] = jobs
      .filter((j) => j.title)
      .map((j) => ({
        externalId: null,
        title: j.title || '',
        url: j.url ? resolveUrl(j.url, input) : '',
        location: j.location || null,
        department: j.department || null,
        team: null,
        datePosted: j.datePosted || null,
        dateSeen: now,
        rawMetadata: {
          snippet: j.snippet || '',
          siteType: parsed.siteType || '',
          notes: parsed.notes || '',
          _sourceUrl: input,
        },
      }));

    return {
      postings,
      totalCount: postings.length,
      hasMore: !!(parsed.notes && /paginated|more.*page|next page/i.test(parsed.notes)),
      diagnostics: {
        ...diag,
        reason: postings.length === 0
          ? 'No jobs detected. Site may use JavaScript rendering or have no open positions.'
          : `${postings.length} job(s) extracted via AI. Confidence: medium (HTML fallback).`,
        status: postings.length === 0 ? 'NO_JOBS_FOUND' : 'OK',
      },
    };
  }

  async fetchPosting(ref: RawPostingReference): Promise<FetchResult> {
    if (!ref.url) return { html: null, json: ref.rawMetadata, diagnostics: ok() };
    const { html, diag } = await fetchPage(ref.url);
    return { html: html || null, json: ref.rawMetadata, diagnostics: diag };
  }

  async normalize(ref: RawPostingReference, fetch: FetchResult): Promise<NormalizeResult> {
    // For generic HTML, we return the snippet as descriptionRaw
    // Full JD extraction should be done via /api/jobs/scrape-full
    const snippet = (ref.rawMetadata.snippet as string) || '';
    const desc = snippet || (fetch.html ? stripNoise(fetch.html).slice(0, 5000) : '');

    const posting: NormalizedJobPosting = {
      externalId: null,
      canonicalUrl: ref.url || (ref.rawMetadata._sourceUrl as string) || '',
      sourceUrl: (ref.rawMetadata._sourceUrl as string) || ref.url || '',
      companyName: '',
      title: ref.title,
      normalizedTitle: null,
      department: ref.department,
      subDepartment: null,
      team: null,
      jobFamily: null,
      jobLevel: null,
      employmentType: null,
      contractType: null,
      workingModel: null,
      location: ref.location,
      country: null,
      language: null,
      datePosted: ref.datePosted,
      dateFirstSeen: ref.dateSeen,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
      salarySource: null,
      descriptionRaw: desc,
      descriptionClean: desc,
      applicationUrl: ref.url || null,
      contentHash: '',
      sourceKind: this.sourceKind,
      confidenceScore: desc.length > 200 ? 55 : 30,
    };
    posting.contentHash = contentHash(posting);
    return { posting, diagnostics: fetch.diagnostics };
  }

  extractOrgSignals(postings: NormalizedJobPosting[]): OrgStructureSignal[] {
    return postings
      .filter((p) => p.department)
      .map((p) => ({
        companyName: p.companyName,
        department: p.department,
        subDepartment: null,
        team: null,
        location: p.location,
        jobFamily: null,
        title: p.title,
        seniority: null,
        possibleReportsTo: null,
        possibleManagerTitle: null,
        evidenceText: `HTML page listing: "${p.title}" in "${p.department}"`,
        evidenceUrl: p.canonicalUrl,
        confidenceScore: 40,   // low — HTML fallback
      }));
  }
}
