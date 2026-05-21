/**
 * schema.org/JobPosting JSON-LD parser.
 *
 * Extracts structured job data from pages that include standard
 * schema.org/JobPosting markup (JSON-LD, Microdata, or embedded payloads).
 *
 * Google's JobPosting spec confirms: datePosted, validThrough,
 * jobLocation, baseSalary, employmentType, hiringOrganization,
 * description, title, identifier, url are common fields.
 *
 * Compliance: Reads publicly available structured metadata the page
 * author explicitly placed there for machine consumption.
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

const TIMEOUT_MS = 15_000;

interface SchemaJobPosting {
  '@type'?: string;
  title?: string;
  name?: string;
  description?: string;
  datePosted?: string;
  validThrough?: string;
  url?: string;
  identifier?: { value?: string } | string;
  employmentType?: string | string[];
  workHours?: string;
  jobLocation?: {
    '@type'?: string;
    address?: {
      '@type'?: string;
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: string;
      streetAddress?: string;
    };
    name?: string;
  } | Array<{
    name?: string;
    address?: { addressLocality?: string; addressCountry?: string };
  }>;
  applicantLocationRequirements?: { name?: string } | Array<{ name?: string }>;
  jobLocationType?: string;        // "TELECOMMUTE" → remote
  hiringOrganization?: {
    '@type'?: string;
    name?: string;
    url?: string;
    sameAs?: string;
  };
  baseSalary?: {
    '@type'?: string;
    currency?: string;
    value?: {
      '@type'?: string;
      minValue?: number;
      maxValue?: number;
      value?: number;
      unitText?: string;
    } | number;
  };
  occupationalCategory?: string;
  responsibilities?: string;
  qualifications?: string;
  skills?: string;
  experienceRequirements?: string;
  educationRequirements?: string | { credentialCategory?: string };
}

// ── JSON-LD extraction ───────────────────────────────────────────────────────

function extractJsonLd(html: string): SchemaJobPosting[] {
  const results: SchemaJobPosting[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1]) as SchemaJobPosting | { '@graph'?: SchemaJobPosting[] } | SchemaJobPosting[];
      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (item['@type'] === 'JobPosting') results.push(item);
        }
      } else if ('@graph' in obj && Array.isArray((obj as { '@graph'?: SchemaJobPosting[] })['@graph'])) {
        for (const item of (obj as { '@graph': SchemaJobPosting[] })['@graph']) {
          if (item['@type'] === 'JobPosting') results.push(item);
        }
      } else if ((obj as SchemaJobPosting)['@type'] === 'JobPosting') {
        results.push(obj as SchemaJobPosting);
      }
    } catch {
      // malformed JSON-LD — skip
    }
  }
  return results;
}

// ── Field normalisation ──────────────────────────────────────────────────────

function resolveLocation(job: SchemaJobPosting): string | null {
  const loc = job.jobLocation;
  if (!loc) return null;
  if (Array.isArray(loc)) {
    const first = loc[0];
    return first?.name || first?.address?.addressLocality || null;
  }
  if (typeof loc === 'object') {
    return (
      loc.name ||
      [
        loc.address?.addressLocality,
        loc.address?.addressRegion,
        loc.address?.addressCountry,
      ]
        .filter(Boolean)
        .join(', ') || null
    );
  }
  return null;
}

function resolveCountry(job: SchemaJobPosting): string | null {
  const loc = job.jobLocation;
  if (!loc || Array.isArray(loc)) return null;
  return (loc as { address?: { addressCountry?: string } }).address?.addressCountry || null;
}

function resolveEmploymentType(job: SchemaJobPosting): string | null {
  const t = job.employmentType;
  if (!t) return null;
  return Array.isArray(t) ? t.join(', ') : t;
}

function resolveWorkingModel(job: SchemaJobPosting): string | null {
  if (job.jobLocationType === 'TELECOMMUTE') return 'Remote';
  if (job.applicantLocationRequirements) return 'Remote';
  return null;
}

function resolveSalary(job: SchemaJobPosting): {
  min: number | null; max: number | null; currency: string | null; period: string | null;
} {
  const bs = job.baseSalary;
  if (!bs) return { min: null, max: null, currency: null, period: null };
  const currency = bs.currency || null;
  const val = bs.value;
  if (typeof val === 'number') {
    return { min: val, max: val, currency, period: null };
  }
  if (val && typeof val === 'object') {
    return {
      min: (val.minValue ?? val.value) || null,
      max: val.maxValue ?? null,
      currency,
      period: val.unitText || null,
    };
  }
  return { min: null, max: null, currency, period: null };
}

function resolveId(job: SchemaJobPosting): string | null {
  const id = job.identifier;
  if (!id) return null;
  if (typeof id === 'string') return id;
  return id.value || null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}

function contentHash(posting: NormalizedJobPosting): string {
  return createHash('sha256')
    .update(`${posting.canonicalUrl}|${posting.title}|${posting.descriptionRaw.slice(0, 500)}`)
    .digest('hex');
}

function toPosting(
  job: SchemaJobPosting,
  pageUrl: string,
  dateSeen: string,
): NormalizedJobPosting {
  const salary = resolveSalary(job);
  const descRaw = job.description ? stripHtml(job.description) : '';
  const posting: NormalizedJobPosting = {
    externalId: resolveId(job),
    canonicalUrl: job.url || pageUrl,
    sourceUrl: pageUrl,
    companyName: job.hiringOrganization?.name || '',
    title: job.title || job.name || '',
    normalizedTitle: null,
    department: null,
    subDepartment: null,
    team: null,
    jobFamily: job.occupationalCategory || null,
    jobLevel: null,
    employmentType: resolveEmploymentType(job),
    contractType: null,
    workingModel: resolveWorkingModel(job),
    location: resolveLocation(job),
    country: resolveCountry(job),
    language: null,
    datePosted: job.datePosted || null,
    dateFirstSeen: dateSeen,
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: salary.currency,
    salaryPeriod: salary.period,
    salarySource: salary.min ? 'schema.org baseSalary' : null,
    descriptionRaw: descRaw,
    descriptionClean: descRaw,
    applicationUrl: job.url || pageUrl,
    contentHash: '',
    sourceKind: 'GENERIC_SCHEMA_ORG',
    confidenceScore: descRaw.length > 300 ? 85 : 55,
  };
  posting.contentHash = contentHash(posting);
  return posting;
}

// ── Connector ────────────────────────────────────────────────────────────────

export class SchemaOrgConnector implements SourceConnector {
  readonly id = 'schema-org';
  readonly name = 'schema.org JobPosting Parser';
  readonly sourceKind: SourceKind = 'GENERIC_SCHEMA_ORG';

  canHandle(input: string): boolean {
    return /^https?:\/\//i.test(input);
  }

  async preflight(input: string): Promise<SourceDiagnostics> {
    return this._fetch(input).then(({ diag }) => diag);
  }

  private async _fetch(url: string): Promise<{ html: string; diag: SourceDiagnostics }> {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
          'User-Agent': 'JDSuite/1.0 (+https://jd-suite-ultra.vercel.app; research)',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return { html: '', diag: classifyHttpError(res.status) };
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('html')) return { html: '', diag: blocked('PARSER_FAILED', 'Not an HTML page') };
      const html = await res.text();
      const lower = html.toLowerCase();
      if (
        lower.includes('captcha') &&
        (lower.includes('hcaptcha') || lower.includes('recaptcha') || lower.includes('cf-challenge'))
      ) {
        return { html, diag: blocked('CAPTCHA_OR_BOT_CHALLENGE', 'CAPTCHA detected.', { captchaDetected: true }) };
      }
      if (lower.includes('please enable javascript') && html.length < 5000) {
        return { html, diag: requiresJavaScript() };
      }
      return { html, diag: ok() };
    } catch (err) {
      return { html: '', diag: classifyHttpError(0, (err as Error).message) };
    }
  }

  async discover(input: string): Promise<DiscoverResult> {
    const { html, diag } = await this._fetch(input);
    if (diag.status !== 'OK' || !html) {
      return { postings: [], totalCount: null, hasMore: false, diagnostics: diag };
    }

    const jobs = extractJsonLd(html);
    const now = new Date().toISOString();

    if (jobs.length === 0) {
      return {
        postings: [],
        totalCount: 0,
        hasMore: false,
        diagnostics: {
          ...diag,
          status: 'NO_JOBS_FOUND',
          reason: 'No schema.org/JobPosting JSON-LD found on this page.',
          userActionNeeded: 'Try the generic HTML scraper or connect via official ATS API.',
        },
      };
    }

    const postings: RawPostingReference[] = jobs.map((j) => ({
      externalId: resolveId(j),
      title: j.title || j.name || '',
      url: j.url || input,
      location: resolveLocation(j),
      department: null,
      team: null,
      datePosted: j.datePosted || null,
      dateSeen: now,
      rawMetadata: { ...j, _pageUrl: input } as unknown as Record<string, unknown>,
    }));

    return { postings, totalCount: jobs.length, hasMore: false, diagnostics: diag };
  }

  async fetchPosting(ref: RawPostingReference): Promise<FetchResult> {
    // Data already in rawMetadata from discovery
    return { html: null, json: ref.rawMetadata, diagnostics: ok() };
  }

  async normalize(ref: RawPostingReference, _fetch: FetchResult): Promise<NormalizeResult> {
    const job = ref.rawMetadata as SchemaJobPosting;
    const posting = toPosting(job, (ref.rawMetadata._pageUrl as string) || ref.url, ref.dateSeen);
    return { posting, diagnostics: ok() };
  }

  extractOrgSignals(postings: NormalizedJobPosting[]): OrgStructureSignal[] {
    return postings
      .filter((p) => p.companyName)
      .map((p) => ({
        companyName: p.companyName,
        department: p.department,
        subDepartment: null,
        team: null,
        location: p.location,
        jobFamily: p.jobFamily,
        title: p.title,
        seniority: null,
        possibleReportsTo: null,
        possibleManagerTitle: null,
        evidenceText: `schema.org JobPosting: "${p.title}" at "${p.companyName}"`,
        evidenceUrl: p.canonicalUrl,
        confidenceScore: 70,
      }));
  }
}

// ── Standalone parser (for use without full connector flow) ──────────────────

export function parseSchemaOrgJobPostings(
  html: string,
  pageUrl: string,
): NormalizedJobPosting[] {
  const jobs = extractJsonLd(html);
  const now = new Date().toISOString();
  return jobs.map((j) => toPosting(j, pageUrl, now));
}
