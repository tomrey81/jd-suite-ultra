/**
 * Greenhouse Job Board API connector.
 *
 * Uses Greenhouse's *public* Job Board API (no auth required):
 *   https://developers.greenhouse.io/job-board.html
 *
 * GET /v1/boards/{boardToken}/jobs          — list all departments + jobs
 * GET /v1/boards/{boardToken}/jobs/{id}     — full job content + questions
 * GET /v1/boards/{boardToken}/departments   — department list (org signals)
 * GET /v1/boards/{boardToken}/offices       — office list (org signals)
 *
 * This is the gold standard for evaluation-grade ingestion: structured JSON,
 * real department/team data, location, ID, and full content.
 *
 * Compliance: Public API. No scraping, no evasion.
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

const GH_BASE = 'https://boards-api.greenhouse.io/v1/boards';
const TIMEOUT_MS = 15_000;

interface GhJob {
  id: number;
  title: string;
  updated_at: string;
  location?: { name?: string };
  departments?: Array<{ id: number; name: string; parent_id?: number | null }>;
  offices?: Array<{ id: number; name: string; location?: { name?: string } }>;
  absolute_url?: string;
  content?: string;          // HTML — present only in single-job response
  internal_job_id?: number;
}

interface GhJobsResponse {
  jobs: GhJob[];
}

interface GhDepartment {
  id: number;
  name: string;
  parent_id: number | null;
  child_ids: number[];
  jobs: GhJob[];
}

async function ghFetch<T>(url: string): Promise<{ data: T | null; status: number; error?: string }> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { data: null, status: res.status, error: `HTTP ${res.status}` };
    const data = (await res.json()) as T;
    return { data, status: res.status };
  } catch (err) {
    return { data: null, status: 0, error: (err as Error).message || 'Network error' };
  }
}

/** Strips HTML tags from Greenhouse job content. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract board token from a Greenhouse URL or treat as token directly. */
function extractBoardToken(input: string): string {
  // https://boards.greenhouse.io/company → token = "company"
  // https://job-boards.greenhouse.io/company → token = "company"
  const m = input.match(/greenhouse\.io\/([^/?#]+)/i);
  if (m) return m[1];
  // Treat raw string as token (e.g. "companyname")
  return input.replace(/^https?:\/\//i, '').split('/')[0];
}

function contentHash(posting: NormalizedJobPosting): string {
  return createHash('sha256')
    .update(`${posting.canonicalUrl}|${posting.title}|${posting.descriptionRaw.slice(0, 500)}`)
    .digest('hex');
}

export class GreenhouseConnector implements SourceConnector {
  readonly id = 'greenhouse';
  readonly name = 'Greenhouse Job Board API';
  readonly sourceKind: SourceKind = 'GREENHOUSE_API';

  canHandle(input: string): boolean {
    return /greenhouse\.io/i.test(input) || /^[a-z0-9_-]{2,50}$/i.test(input.trim());
  }

  async preflight(input: string): Promise<SourceDiagnostics> {
    const token = extractBoardToken(input);
    const { status, error } = await ghFetch<GhJobsResponse>(`${GH_BASE}/${token}/jobs`);
    if (status === 200) return ok({ apiAvailable: true });
    if (status === 404) {
      return blocked('NO_JOBS_FOUND', `Greenhouse board "${token}" not found.`, {
        userActionNeeded: 'Double-check the board token or URL.',
        errorCode: '404',
      });
    }
    return classifyHttpError(status, error);
  }

  async discover(input: string): Promise<DiscoverResult> {
    const token = extractBoardToken(input);
    const { data, status, error } = await ghFetch<GhJobsResponse>(`${GH_BASE}/${token}/jobs`);

    if (!data || status !== 200) {
      return {
        postings: [],
        totalCount: null,
        hasMore: false,
        diagnostics: classifyHttpError(status, error),
      };
    }

    const now = new Date().toISOString();
    const postings: RawPostingReference[] = (data.jobs || []).map((j) => ({
      externalId: String(j.id),
      title: j.title || '',
      url: j.absolute_url || `${GH_BASE}/${token}/jobs/${j.id}`,
      location: j.location?.name || null,
      department: j.departments?.[0]?.name || null,
      team: null,
      datePosted: j.updated_at || null,
      dateSeen: now,
      rawMetadata: { ...(j as unknown as Record<string, unknown>), _boardToken: token },
    }));

    return {
      postings,
      totalCount: postings.length,
      hasMore: false,
      diagnostics: ok({ apiAvailable: true }),
    };
  }

  async fetchPosting(ref: RawPostingReference): Promise<FetchResult> {
    const token = (ref.rawMetadata._boardToken as string) || '';
    const id = ref.externalId;
    if (!id) {
      return { html: null, json: null, diagnostics: blocked('PARSER_FAILED', 'No externalId') };
    }

    const url = token
      ? `${GH_BASE}/${token}/jobs/${id}`
      : ref.url;

    const { data, status, error } = await ghFetch<GhJob>(url);
    if (!data) {
      return { html: null, json: null, diagnostics: classifyHttpError(status, error) };
    }
    return { html: data.content || null, json: data as unknown as Record<string, unknown>, diagnostics: ok() };
  }

  async normalize(ref: RawPostingReference, fetch: FetchResult): Promise<NormalizeResult> {
    const job = (fetch.json || ref.rawMetadata) as GhJob;
    const descRaw = job.content ? stripHtml(job.content) : '';

    const posting: NormalizedJobPosting = {
      externalId: ref.externalId,
      canonicalUrl: ref.url,
      sourceUrl: ref.url,
      companyName: '',     // board token → company name lookup is not in public API
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
      language: 'en',
      datePosted: ref.datePosted,
      dateFirstSeen: ref.dateSeen,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
      salarySource: 'Greenhouse API (not provided)',
      descriptionRaw: descRaw,
      descriptionClean: descRaw,
      applicationUrl: ref.url,
      contentHash: '',
      sourceKind: this.sourceKind,
      confidenceScore: descRaw.length > 200 ? 90 : 60,
    };
    posting.contentHash = contentHash(posting);
    return { posting, diagnostics: ok() };
  }

  extractOrgSignals(postings: NormalizedJobPosting[]): OrgStructureSignal[] {
    return postings
      .filter((p) => p.department)
      .map((p) => ({
        companyName: p.companyName,
        department: p.department,
        subDepartment: p.subDepartment,
        team: p.team,
        location: p.location,
        jobFamily: p.jobFamily,
        title: p.title,
        seniority: inferSeniority(p.title),
        possibleReportsTo: null,
        possibleManagerTitle: null,
        evidenceText: `"${p.title}" posted in department "${p.department}"`,
        evidenceUrl: p.canonicalUrl,
        confidenceScore: 75,
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
