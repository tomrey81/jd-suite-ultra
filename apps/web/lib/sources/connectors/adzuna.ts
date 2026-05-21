/**
 * Adzuna API connector.
 *
 * Adzuna is a JOB ADVERTISEMENT aggregator, not a direct employer source.
 * Descriptions may be snippets only (truncated by Adzuna).
 * Use for: discovery, salary signals, market benchmarks, source URLs.
 * NOT as the primary source for evaluation-grade JD extraction.
 *
 * Official API docs: https://developer.adzuna.com/
 * Compliance: Official REST API. Requires ADZUNA_APP_ID + ADZUNA_APP_KEY.
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
import { ok, missingApiKey, classifyHttpError, blocked } from '../diagnostics';

const ADZUNA_BASE = 'https://api.adzuna.com/v1/api/jobs';
const RESULTS_PER_PAGE = 30;
const TIMEOUT_MS = 15_000;

export interface AdzunaSearchOptions {
  country: string;
  query: string;
  where?: string;
  category?: string;
  salaryMin?: number;
  fullTime?: boolean;
  page?: number;
}

interface AdzunaApiJob {
  id: string;
  title: string;
  description: string;
  redirect_url: string;
  created: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  contract_type?: string;
  category?: { tag?: string; label?: string };
}

interface AdzunaApiResponse {
  results?: AdzunaApiJob[];
  count?: number;
  __CLASS__?: string;
  exception?: string;
}

function contentHash(posting: NormalizedJobPosting): string {
  return createHash('sha256')
    .update(`${posting.canonicalUrl}|${posting.title}|${posting.descriptionRaw.slice(0, 200)}`)
    .digest('hex');
}

export class AdzunaConnector implements SourceConnector {
  readonly id = 'adzuna';
  readonly name = 'Adzuna Job Board API';
  readonly sourceKind: SourceKind = 'ADZUNA_API';

  canHandle(input: string): boolean {
    // Adzuna handles any search query or adzuna.com URL
    return /adzuna\.com/i.test(input) || this._hasCredentials();
  }

  private _hasCredentials(): boolean {
    return !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
  }

  async preflight(_input: string): Promise<SourceDiagnostics> {
    if (!this._hasCredentials()) {
      return missingApiKey('ADZUNA_APP_ID / ADZUNA_APP_KEY', 'https://developer.adzuna.com/');
    }
    return ok({
      apiAvailable: true,
      reason: 'Adzuna API credentials present. Note: descriptions may be snippets only.',
    });
  }

  /**
   * Discovers job postings via Adzuna search.
   * `input` should be a JSON-encoded AdzunaSearchOptions, or a company name.
   */
  async discover(input: string, options?: Record<string, unknown>): Promise<DiscoverResult> {
    if (!this._hasCredentials()) {
      return {
        postings: [],
        totalCount: null,
        hasMore: false,
        diagnostics: missingApiKey('ADZUNA_APP_ID / ADZUNA_APP_KEY', 'https://developer.adzuna.com/'),
      };
    }

    let opts: AdzunaSearchOptions;
    try {
      opts = JSON.parse(input) as AdzunaSearchOptions;
    } catch {
      opts = { country: 'gb', query: input, ...(options as Partial<AdzunaSearchOptions>) };
    }

    const country = (opts.country || 'gb').toLowerCase().slice(0, 2);
    const page = opts.page || 1;

    const params = new URLSearchParams({
      app_id: process.env.ADZUNA_APP_ID!,
      app_key: process.env.ADZUNA_APP_KEY!,
      results_per_page: String(RESULTS_PER_PAGE),
      content_type: 'application/json',
    });
    if (opts.query?.trim()) params.set('what', opts.query.trim());
    if (opts.where?.trim()) params.set('where', opts.where.trim());
    if (opts.category?.trim()) params.set('category', opts.category.trim());
    if (opts.salaryMin) params.set('salary_min', String(opts.salaryMin));
    if (opts.fullTime) params.set('full_time', '1');

    const url = `${ADZUNA_BASE}/${country}/search/${page}?${params}`;

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        return {
          postings: [],
          totalCount: null,
          hasMore: false,
          diagnostics: classifyHttpError(res.status),
        };
      }
      const data = (await res.json()) as AdzunaApiResponse;

      if (data.exception) {
        return {
          postings: [],
          totalCount: null,
          hasMore: false,
          diagnostics: blocked('PARSER_FAILED', `Adzuna API error: ${data.exception}`, {
            userActionNeeded: 'Check ADZUNA_APP_ID and ADZUNA_APP_KEY in Settings.',
          }),
        };
      }

      const now = new Date().toISOString();
      const postings: RawPostingReference[] = (data.results || []).map((j) => ({
        externalId: j.id,
        title: j.title || '',
        url: j.redirect_url || '',
        location: j.location?.display_name || null,
        department: null,
        team: null,
        datePosted: j.created || null,
        dateSeen: now,
        rawMetadata: { ...(j as unknown as Record<string, unknown>), _country: country },
      }));

      const total = data.count ?? postings.length;
      return {
        postings,
        totalCount: total,
        hasMore: page * RESULTS_PER_PAGE < total,
        diagnostics: ok({
          apiAvailable: true,
          reason: `Adzuna: ${total} results found. Descriptions are snippets — use redirect_url for full JD.`,
        }),
      };
    } catch (err) {
      return {
        postings: [],
        totalCount: null,
        hasMore: false,
        diagnostics: classifyHttpError(0, (err as Error).message),
      };
    }
  }

  async fetchPosting(ref: RawPostingReference): Promise<FetchResult> {
    // Adzuna only provides a redirect URL and a snippet in the API response.
    // The full JD lives at ref.url (the employer's own page).
    // We do NOT fetch it here — caller should route to the appropriate
    // direct-employer connector (schema-org, greenhouse, ashby, or generic-html).
    return {
      html: null,
      json: ref.rawMetadata,
      diagnostics: ok({
        reason: 'Adzuna provides snippets only. Route redirect URL to direct-employer connector for full JD.',
      }),
    };
  }

  async normalize(ref: RawPostingReference, _fetch: FetchResult): Promise<NormalizeResult> {
    const j = ref.rawMetadata as unknown as AdzunaApiJob;

    const isSnippet = !!(j.description && j.description.length < 600);

    const posting: NormalizedJobPosting = {
      externalId: j.id,
      canonicalUrl: j.redirect_url || ref.url,
      sourceUrl: `https://adzuna.com (id: ${j.id})`,
      companyName: j.company?.display_name || '',
      title: j.title || '',
      normalizedTitle: null,
      department: null,
      subDepartment: null,
      team: null,
      jobFamily: j.category?.label || null,
      jobLevel: null,
      employmentType: null,
      contractType: j.contract_type || null,
      workingModel: null,
      location: j.location?.display_name || null,
      country: j.location?.area?.[0] || null,
      language: 'en',
      datePosted: j.created || null,
      dateFirstSeen: ref.dateSeen,
      salaryMin: j.salary_min ?? null,
      salaryMax: j.salary_max ?? null,
      salaryCurrency: ({ gb: 'GBP', us: 'USD', ca: 'CAD', au: 'AUD', de: 'EUR', fr: 'EUR', nl: 'EUR', it: 'EUR', pl: 'PLN', br: 'BRL', in: 'INR', sg: 'SGD', za: 'ZAR', mx: 'MXN' } as Record<string, string>)[((ref.rawMetadata as Record<string, unknown>)._country as string) || 'gb'] ?? 'GBP',
      salaryPeriod: 'annual',
      salarySource: j.salary_is_predicted === '1' ? 'Adzuna (estimated)' : 'Adzuna (stated)',
      descriptionRaw: j.description || '',
      descriptionClean: j.description || '',
      applicationUrl: j.redirect_url || '',
      contentHash: '',
      sourceKind: this.sourceKind,
      // Adzuna snippets are not evaluation-grade — score accordingly
      confidenceScore: isSnippet ? 30 : 50,
    };
    posting.contentHash = contentHash(posting);

    const diagnostics = isSnippet
      ? {
          ...ok(),
          status: 'PARTIAL_EXTRACTION' as const,
          reason:
            'Adzuna returned a snippet only. Visit the redirect URL for the full job description.',
          userActionNeeded:
            'Use "Fetch full JD from redirect URL" to extract the complete job description from the employer\'s own site.',
        }
      : ok();

    return { posting, diagnostics };
  }

  extractOrgSignals(postings: NormalizedJobPosting[]): OrgStructureSignal[] {
    // Adzuna aggregator data has low org-structure confidence
    return postings
      .filter((p) => p.companyName)
      .map((p) => ({
        companyName: p.companyName,
        department: null,
        subDepartment: null,
        team: null,
        location: p.location,
        jobFamily: p.jobFamily,
        title: p.title,
        seniority: null,
        possibleReportsTo: null,
        possibleManagerTitle: null,
        evidenceText: `Adzuna listing: "${p.title}" at "${p.companyName}"`,
        evidenceUrl: p.canonicalUrl,
        confidenceScore: 25,    // low — Adzuna is aggregated data
      }));
  }
}
