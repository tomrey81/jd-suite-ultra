/**
 * Ashby Public Posting API connector.
 *
 * Ashby's public API (no auth required):
 *   POST https://api.ashbyhq.com/posting-api/job-board
 *   Body: { organizationHostedJobsPageName: string }
 *   Returns: { results: AshbyJob[], moreDataAvailable: boolean }
 *
 * With compensation enabled (opt-in by employer):
 *   POST with { organizationHostedJobsPageName, includeCompensation: true }
 *
 * Also supports:
 *   POST /posting-api/job-board/job   — single posting
 *   POST /posting-api/job-board/departments — department list (org signals)
 *   POST /posting-api/job-board/job-locations — location list
 *
 * Compliance: Public API. No scraping.
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
import { ok, blocked, classifyHttpError } from '../diagnostics';

const ASHBY_BASE = 'https://api.ashbyhq.com/posting-api';
const TIMEOUT_MS = 15_000;

interface AshbyJob {
  id: string;
  title: string;
  teamName?: string;
  departmentName?: string;
  locationName?: string;
  locationNames?: string[];
  publishedAt?: string;
  isRemote?: boolean;
  isListed?: boolean;
  descriptionPlain?: string;
  descriptionHtml?: string;
  applyUrl?: string;
  jobUrl?: string;
  compensationTierSummary?: string;
  salary?: { min?: number; max?: number; currency?: string; interval?: string };
  employmentType?: string;
}

interface AshbyResponse {
  results?: AshbyJob[];
  job?: AshbyJob;
  moreDataAvailable?: boolean;
}

function extractOrgSlug(input: string): string {
  // https://jobs.ashbyhq.com/company → "company"
  const m = input.match(/ashbyhq\.com\/([^/?#]+)/i);
  if (m) return m[1];
  return input.replace(/^https?:\/\//i, '').split('/')[0];
}

async function ashbyPost<T>(path: string, body: Record<string, unknown>): Promise<{ data: T | null; status: number; error?: string }> {
  try {
    const res = await fetch(`${ASHBY_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { data: null, status: res.status, error: `HTTP ${res.status}` };
    const data = (await res.json()) as T;
    return { data, status: res.status };
  } catch (err) {
    return { data: null, status: 0, error: (err as Error).message || 'Network error' };
  }
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

export class AshbyConnector implements SourceConnector {
  readonly id = 'ashby';
  readonly name = 'Ashby Public Posting API';
  readonly sourceKind: SourceKind = 'ASHBY_POSTING_API';

  canHandle(input: string): boolean {
    return /ashbyhq\.com/i.test(input);
  }

  async preflight(input: string): Promise<SourceDiagnostics> {
    const slug = extractOrgSlug(input);
    const { status, error } = await ashbyPost<AshbyResponse>('/job-board', {
      organizationHostedJobsPageName: slug,
    });
    if (status === 200) return ok({ apiAvailable: true });
    if (status === 404) {
      return blocked('NO_JOBS_FOUND', `Ashby organisation "${slug}" not found.`, {
        userActionNeeded: 'Verify the Ashby organisation slug or URL.',
        errorCode: '404',
      });
    }
    return classifyHttpError(status, error);
  }

  async discover(input: string): Promise<DiscoverResult> {
    const slug = extractOrgSlug(input);
    const { data, status, error } = await ashbyPost<AshbyResponse>('/job-board', {
      organizationHostedJobsPageName: slug,
      includeCompensation: true,
    });

    if (!data || status !== 200) {
      return {
        postings: [],
        totalCount: null,
        hasMore: false,
        diagnostics: classifyHttpError(status, error),
      };
    }

    const now = new Date().toISOString();
    const postings: RawPostingReference[] = (data.results || [])
      .filter((j) => j.isListed !== false)
      .map((j) => ({
        externalId: j.id,
        title: j.title || '',
        url: j.jobUrl || j.applyUrl || '',
        location: j.locationName || (j.locationNames?.[0]) || (j.isRemote ? 'Remote' : null),
        department: j.departmentName || null,
        team: j.teamName || null,
        datePosted: j.publishedAt || null,
        dateSeen: now,
        rawMetadata: { ...j, _slug: slug } as unknown as Record<string, unknown>,
      }));

    return {
      postings,
      totalCount: postings.length,
      hasMore: !!data.moreDataAvailable,
      diagnostics: ok({ apiAvailable: true }),
    };
  }

  async fetchPosting(ref: RawPostingReference): Promise<FetchResult> {
    const slug = (ref.rawMetadata._slug as string) || '';
    const id = ref.externalId;
    if (!id || !slug) {
      return { html: null, json: ref.rawMetadata, diagnostics: ok() };
    }

    const { data, status, error } = await ashbyPost<AshbyResponse>('/job-board/job', {
      organizationHostedJobsPageName: slug,
      jobId: id,
      includeCompensation: true,
    });
    if (!data?.job) {
      return { html: null, json: ref.rawMetadata, diagnostics: classifyHttpError(status, error) };
    }
    return { html: data.job.descriptionHtml || null, json: data.job as unknown as Record<string, unknown>, diagnostics: ok() };
  }

  async normalize(ref: RawPostingReference, fetch: FetchResult): Promise<NormalizeResult> {
    const job = (fetch.json || ref.rawMetadata) as AshbyJob;

    const descRaw = job.descriptionPlain ||
      (job.descriptionHtml ? stripHtml(job.descriptionHtml) : '');

    const salaryMin = typeof job.salary?.min === 'number' ? job.salary.min : null;
    const salaryMax = typeof job.salary?.max === 'number' ? job.salary.max : null;
    const salaryCurrency = typeof job.salary?.currency === 'string' ? job.salary.currency : null;
    const salaryPeriod = typeof job.salary?.interval === 'string' ? job.salary.interval : null;

    const posting: NormalizedJobPosting = {
      externalId: ref.externalId,
      canonicalUrl: ref.url,
      sourceUrl: ref.url,
      companyName: '',
      title: ref.title,
      normalizedTitle: null,
      department: ref.department,
      subDepartment: null,
      team: ref.team,
      jobFamily: null,
      jobLevel: null,
      employmentType: job.employmentType || null,
      contractType: null,
      workingModel: job.isRemote ? 'Remote' : null,
      location: ref.location,
      country: null,
      language: 'en',
      datePosted: ref.datePosted,
      dateFirstSeen: ref.dateSeen,
      salaryMin,
      salaryMax,
      salaryCurrency,
      salaryPeriod,
      salarySource: salaryMin || salaryMax ? 'Ashby API (employer-provided)' : null,
      descriptionRaw: descRaw,
      descriptionClean: descRaw,
      applicationUrl: job.applyUrl || ref.url,
      contentHash: '',
      sourceKind: this.sourceKind,
      confidenceScore: descRaw.length > 200 ? 92 : 60,
    };
    posting.contentHash = contentHash(posting);
    return { posting, diagnostics: ok() };
  }

  extractOrgSignals(postings: NormalizedJobPosting[]): OrgStructureSignal[] {
    return postings.map((p) => ({
      companyName: p.companyName,
      department: p.department,
      subDepartment: null,
      team: p.team,
      location: p.location,
      jobFamily: null,
      title: p.title,
      seniority: inferSeniority(p.title),
      possibleReportsTo: null,
      possibleManagerTitle: null,
      evidenceText: [
        `"${p.title}"`,
        p.department && `department: "${p.department}"`,
        p.team && `team: "${p.team}"`,
      ].filter(Boolean).join(', '),
      evidenceUrl: p.canonicalUrl,
      confidenceScore: 80,
    }));
  }
}

function inferSeniority(title: string): string | null {
  const t = title.toLowerCase();
  if (/\b(chief|c[ets]o|vp|vice president)\b/.test(t)) return 'Executive';
  if (/\b(director|head of)\b/.test(t)) return 'Director';
  if (/\b(senior|sr\.?|lead|principal|staff)\b/.test(t)) return 'Senior';
  if (/\b(junior|jr\.?|entry|associate|graduate)\b/.test(t)) return 'Junior';
  if (/\b(manager|supervisor)\b/.test(t)) return 'Manager';
  return null;
}
