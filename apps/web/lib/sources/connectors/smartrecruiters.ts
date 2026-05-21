/**
 * SmartRecruiters Posting API connector.
 *
 * Uses SmartRecruiters' *public* Posting API (no auth required):
 *   GET https://api.smartrecruiters.com/v1/companies/{company}/postings
 *   GET https://api.smartrecruiters.com/v1/companies/{company}/postings/{id}
 *
 * Returns structured JSON with department, location, salary, job type.
 *
 * Compliance: Official public API. No scraping, no evasion.
 */

import { createHash } from 'node:crypto';
import type {
  SourceConnector,
  SourceKind,
  DiscoverResult,
  FetchResult,
  NormalizeResult,
  RawPostingReference,
  NormalizedJobPosting,
  OrgStructureSignal,
} from '../types';
import { ok, blocked, classifyHttpError } from '../diagnostics';

const SR_BASE = 'https://api.smartrecruiters.com/v1/companies';
const TIMEOUT_MS = 12_000;
const UA = 'JDSuite/1.0 (+https://jd-suite-ultra.vercel.app; research)';

interface SRJobSummary {
  id: string;
  name: string;           // title
  refNumber?: string;
  location: {
    city?: string;
    country?: string;
    remote?: boolean;
    address?: string;
    postalCode?: string;
    region?: string;
  };
  department?: { id: string; label: string };
  experienceLevel?: { id: string; label: string };
  typeOfEmployment?: { id: string; label: string };
  industry?: { id: string; label: string };
  function?: { id: string; label: string };
  postingDate?: string;
  applicationUrl?: string;
}

interface SRJobDetail extends SRJobSummary {
  jobAd?: {
    sections: {
      companyDescription?: { title?: string; text?: string };
      jobDescription?: { title?: string; text?: string };
      qualifications?: { title?: string; text?: string };
      additionalInformation?: { title?: string; text?: string };
    };
  };
  compensationEnabled?: boolean;
  compensation?: {
    min?: number;
    max?: number;
    currency?: string;
    interval?: string;
  };
}

interface SRListResponse {
  totalFound: number;
  offset: number;
  limit: number;
  content: SRJobSummary[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function contentHash(p: NormalizedJobPosting): string {
  return createHash('sha256')
    .update(`${p.canonicalUrl}|${p.title}|${(p.descriptionRaw || '').slice(0, 500)}`)
    .digest('hex');
}

function extractCompanyId(input: string): string {
  // https://jobs.smartrecruiters.com/AcmeCorp or smartrecruiters.com/AcmeCorp
  const m = input.match(/smartrecruiters\.com\/([^/?#]+)/i);
  if (m) return m[1];
  // bare word
  if (!input.includes('/') && !input.includes('.')) return input;
  return '';
}

async function srFetch<T>(url: string): Promise<{ data: T | null; status: number; error: string }> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { data: null, status: res.status, error: res.statusText };
    return { data: (await res.json()) as T, status: res.status, error: '' };
  } catch (err) {
    return { data: null, status: 0, error: (err as Error).message };
  }
}

export class SmartRecruitersConnector implements SourceConnector {
  id = 'smartrecruiters';
  name = 'SmartRecruiters Posting API';
  sourceKind: SourceKind = 'SMARTRECRUITERS_POSTING_API';

  canHandle(input: string): boolean {
    return /smartrecruiters\.com/i.test(input);
  }

  async preflight(input: string) {
    const companyId = extractCompanyId(input);
    if (!companyId) return blocked('UNSUPPORTED_ATS', 'Could not extract SmartRecruiters company ID from input.');

    const { data, status, error } = await srFetch<SRListResponse>(`${SR_BASE}/${companyId}/postings?limit=1`);
    if (!data) return classifyHttpError(status, error);

    return ok({
      apiAvailable: true,
      reason: `SmartRecruiters API accessible for "${companyId}". ${data.totalFound} total posting(s) found.`,
    });
  }

  async discover(input: string): Promise<DiscoverResult> {
    const companyId = extractCompanyId(input);
    if (!companyId) {
      return { postings: [], totalCount: null, hasMore: false, diagnostics: blocked('UNSUPPORTED_ATS', 'No SmartRecruiters company ID found.') };
    }

    const { data, status, error } = await srFetch<SRListResponse>(
      `${SR_BASE}/${companyId}/postings?limit=100&offset=0`
    );
    if (!data) {
      return { postings: [], totalCount: null, hasMore: false, diagnostics: classifyHttpError(status, error) };
    }

    const now = new Date().toISOString();
    const postings: RawPostingReference[] = (data.content || []).map((j) => ({
      externalId: j.id,
      title: j.name || '',
      url: j.applicationUrl || `https://jobs.smartrecruiters.com/${companyId}/${j.id}`,
      location: [j.location?.city, j.location?.country].filter(Boolean).join(', ') || null,
      department: j.department?.label || null,
      team: j.function?.label || null,
      datePosted: j.postingDate || null,
      dateSeen: now,
      rawMetadata: { ...(j as unknown as Record<string, unknown>), _companyId: companyId },
    }));

    return {
      postings,
      totalCount: data.totalFound,
      hasMore: data.totalFound > 100,
      diagnostics: ok({
        apiAvailable: true,
        reason: `SmartRecruiters: ${postings.length} posting(s) discovered (${data.totalFound} total).`,
      }),
    };
  }

  async fetchPosting(ref: RawPostingReference): Promise<FetchResult> {
    const companyId = (ref.rawMetadata._companyId as string) || '';
    const id = ref.externalId;
    if (!id || !companyId) return { html: null, json: ref.rawMetadata, diagnostics: ok() };

    const { data, status, error } = await srFetch<SRJobDetail>(`${SR_BASE}/${companyId}/postings/${id}`);
    if (!data) return { html: null, json: ref.rawMetadata, diagnostics: classifyHttpError(status, error) };

    return { html: null, json: data as unknown as Record<string, unknown>, diagnostics: ok() };
  }

  async normalize(ref: RawPostingReference, fetch: FetchResult): Promise<NormalizeResult> {
    const job = (fetch.json || ref.rawMetadata) as SRJobDetail;
    const sections = job.jobAd?.sections || {};
    const descParts = [
      sections.jobDescription?.text ? stripHtml(sections.jobDescription.text) : '',
      sections.qualifications?.text ? `Qualifications:\n${stripHtml(sections.qualifications.text)}` : '',
      sections.additionalInformation?.text ? stripHtml(sections.additionalInformation.text) : '',
    ].filter(Boolean);
    const descRaw = descParts.join('\n\n').trim();

    const workingModel = job.location?.remote ? 'Remote' : null;
    const location = [job.location?.city, job.location?.region, job.location?.country].filter(Boolean).join(', ') || ref.location;

    const posting: NormalizedJobPosting = {
      externalId: job.id || ref.externalId,
      canonicalUrl: job.applicationUrl || ref.url,
      sourceUrl: ref.url,
      companyName: '',
      title: job.name || ref.title,
      normalizedTitle: null,
      department: job.department?.label || ref.department,
      subDepartment: null,
      team: job.function?.label || ref.team,
      jobFamily: job.function?.label || null,
      jobLevel: job.experienceLevel?.label || null,
      employmentType: job.typeOfEmployment?.label || null,
      contractType: null,
      workingModel,
      location,
      country: job.location?.country || null,
      language: 'en',
      datePosted: job.postingDate || ref.datePosted,
      dateFirstSeen: ref.dateSeen,
      salaryMin: typeof job.compensation?.min === 'number' ? job.compensation.min : null,
      salaryMax: typeof job.compensation?.max === 'number' ? job.compensation.max : null,
      salaryCurrency: typeof job.compensation?.currency === 'string' ? job.compensation.currency : null,
      salaryPeriod: typeof job.compensation?.interval === 'string' ? job.compensation.interval : null,
      salarySource: job.compensation ? 'SmartRecruiters (employer-stated)' : null,
      descriptionRaw: descRaw,
      descriptionClean: descRaw,
      applicationUrl: job.applicationUrl || ref.url,
      contentHash: '',
      sourceKind: this.sourceKind,
      confidenceScore: descRaw.length > 200 ? 87 : 55,
    };
    posting.contentHash = contentHash(posting);

    const orgSignals: OrgStructureSignal[] = [];
    if (job.department?.label) {
      orgSignals.push({
        companyName: '',
        department: job.department.label,
        subDepartment: null,
        team: job.function?.label || null,
        location,
        jobFamily: null,
        title: job.name || '',
        seniority: job.experienceLevel?.label || null,
        possibleReportsTo: null,
        possibleManagerTitle: null,
        evidenceText: `SmartRecruiters API: department="${job.department.label}"`,
        evidenceUrl: ref.url,
        confidenceScore: 87,
      });
    }

    return { posting, diagnostics: ok() };
  }

  extractOrgSignals(postings: NormalizedJobPosting[]): OrgStructureSignal[] {
    return postings
      .filter((p) => p.department)
      .map((p) => ({
        companyName: p.companyName || '',
        department: p.department!,
        subDepartment: null,
        team: p.team || null,
        location: p.location || null,
        jobFamily: null,
        title: p.title,
        seniority: p.jobLevel || null,
        possibleReportsTo: null,
        possibleManagerTitle: null,
        evidenceText: `SmartRecruiters posting: ${p.title}`,
        evidenceUrl: p.canonicalUrl || '',
        confidenceScore: 85,
      }));
  }
}
