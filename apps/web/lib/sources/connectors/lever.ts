/**
 * Lever Postings API connector.
 *
 * Uses Lever's *public* Posting API (no auth required):
 *   GET https://api.lever.co/v0/postings/{company}
 *   GET https://api.lever.co/v0/postings/{company}/{id}
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

const LEVER_BASE = 'https://api.lever.co/v0/postings';
const TIMEOUT_MS = 12_000;
const UA = 'JDSuite/1.0 (+https://jd-suite-ultra.vercel.app; research)';

interface LeverPosting {
  id: string;
  text: string;                       // title
  state: string;
  distributionChannels: string[];
  categories: {
    commitment?: string;
    department?: string;
    location?: string;
    team?: string;
    allLocations?: string[];
  };
  tags: string[];
  hostedUrl: string;
  applyUrl: string;
  createdAt: number;                  // unix ms
  descriptionPlain?: string;
  description?: string;              // HTML
  additional?: string;
  additionalPlain?: string;
  lists: Array<{ text: string; content: string }>;
  closing?: string;
  closingPlain?: string;
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
    interval?: string;
  };
}

function contentHash(p: NormalizedJobPosting): string {
  return createHash('sha256')
    .update(`${p.canonicalUrl}|${p.title}|${(p.descriptionRaw || '').slice(0, 500)}`)
    .digest('hex');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractSlug(input: string): string {
  const m = input.match(/lever\.co\/([^/?#]+)/i);
  if (m) return m[1];
  // treat bare word as slug
  if (!input.includes('/') && !input.includes('.')) return input;
  return '';
}

async function leverFetch<T>(url: string): Promise<{ data: T | null; status: number; error: string }> {
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

export class LeverConnector implements SourceConnector {
  id = 'lever';
  name = 'Lever Postings API';
  sourceKind: SourceKind = 'LEVER_POSTINGS_API';

  canHandle(input: string): boolean {
    return /lever\.co/i.test(input);
  }

  async preflight(input: string) {
    const slug = extractSlug(input);
    if (!slug) return blocked('UNSUPPORTED_ATS', 'Could not extract Lever company slug from input.');

    const { data, status, error } = await leverFetch<LeverPosting[]>(`${LEVER_BASE}/${slug}?mode=json`);
    if (!data) return classifyHttpError(status, error);

    return ok({
      apiAvailable: true,
      reason: `Lever public API accessible for "${slug}". ${Array.isArray(data) ? data.length : 0} published posting(s) found.`,
    });
  }

  async discover(input: string): Promise<DiscoverResult> {
    const slug = extractSlug(input);
    if (!slug) {
      return { postings: [], totalCount: null, hasMore: false, diagnostics: blocked('UNSUPPORTED_ATS', 'No Lever slug found.') };
    }

    const { data, status, error } = await leverFetch<LeverPosting[]>(`${LEVER_BASE}/${slug}?mode=json`);
    if (!data) {
      return { postings: [], totalCount: null, hasMore: false, diagnostics: classifyHttpError(status, error) };
    }

    const now = new Date().toISOString();
    const postings: RawPostingReference[] = data
      .filter((j) => j.state === 'published')
      .map((j) => ({
        externalId: j.id,
        title: j.text || '',
        url: j.hostedUrl || `https://jobs.lever.co/${slug}/${j.id}`,
        location: j.categories?.location || j.categories?.allLocations?.[0] || null,
        department: j.categories?.department || null,
        team: j.categories?.team || null,
        datePosted: j.createdAt ? new Date(j.createdAt).toISOString() : null,
        dateSeen: now,
        rawMetadata: { ...(j as unknown as Record<string, unknown>), _slug: slug },
      }));

    return {
      postings,
      totalCount: postings.length,
      hasMore: false,
      diagnostics: ok({ apiAvailable: true, reason: `Lever: ${postings.length} published posting(s) discovered.` }),
    };
  }

  async fetchPosting(ref: RawPostingReference): Promise<FetchResult> {
    const slug = (ref.rawMetadata._slug as string) || '';
    const id = ref.externalId;
    if (!id || !slug) return { html: null, json: ref.rawMetadata, diagnostics: ok() };

    const { data, status, error } = await leverFetch<LeverPosting>(`${LEVER_BASE}/${slug}/${id}`);
    if (!data) return { html: null, json: ref.rawMetadata, diagnostics: classifyHttpError(status, error) };

    return { html: data.description || null, json: data as unknown as Record<string, unknown>, diagnostics: ok() };
  }

  async normalize(ref: RawPostingReference, fetch: FetchResult): Promise<NormalizeResult> {
    const job = (fetch.json || ref.rawMetadata) as LeverPosting;
    const descParts = [
      job.descriptionPlain || (job.description ? stripHtml(job.description) : ''),
      ...(job.lists || []).map((l) => `${l.text}\n${l.content}`),
      job.closingPlain || (job.closing ? stripHtml(job.closing) : ''),
    ].filter(Boolean);
    const descRaw = descParts.join('\n\n').trim();

    const posting: NormalizedJobPosting = {
      externalId: job.id || ref.externalId,
      canonicalUrl: job.hostedUrl || ref.url,
      sourceUrl: ref.url,
      companyName: '',
      title: job.text || ref.title,
      normalizedTitle: null,
      department: job.categories?.department || ref.department,
      subDepartment: null,
      team: job.categories?.team || ref.team,
      jobFamily: null,
      jobLevel: null,
      employmentType: job.categories?.commitment || null,
      contractType: null,
      workingModel: null,
      location: job.categories?.location || ref.location,
      country: null,
      language: 'en',
      datePosted: job.createdAt ? new Date(job.createdAt).toISOString() : ref.datePosted,
      dateFirstSeen: ref.dateSeen,
      salaryMin: typeof job.salaryRange?.min === 'number' ? job.salaryRange.min : null,
      salaryMax: typeof job.salaryRange?.max === 'number' ? job.salaryRange.max : null,
      salaryCurrency: typeof job.salaryRange?.currency === 'string' ? job.salaryRange.currency : null,
      salaryPeriod: typeof job.salaryRange?.interval === 'string' ? job.salaryRange.interval : null,
      salarySource: job.salaryRange ? 'Lever (employer-stated)' : null,
      descriptionRaw: descRaw,
      descriptionClean: descRaw,
      applicationUrl: job.applyUrl || '',
      contentHash: '',
      sourceKind: this.sourceKind,
      confidenceScore: descRaw.length > 200 ? 88 : 55,
    };
    posting.contentHash = contentHash(posting);

    const orgSignals: OrgStructureSignal[] = [];
    if (job.categories?.department) {
      orgSignals.push({
        companyName: '',
        department: job.categories.department,
        subDepartment: null,
        team: job.categories.team || null,
        location: job.categories.location || null,
        jobFamily: null,
        title: job.text || '',
        seniority: null,
        possibleReportsTo: null,
        possibleManagerTitle: null,
        evidenceText: `Lever API: department="${job.categories.department}"`,
        evidenceUrl: ref.url,
        confidenceScore: 85,
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
        seniority: null,
        possibleReportsTo: null,
        possibleManagerTitle: null,
        evidenceText: `Lever posting: ${p.title}`,
        evidenceUrl: p.canonicalUrl || '',
        confidenceScore: 82,
      }));
  }
}
