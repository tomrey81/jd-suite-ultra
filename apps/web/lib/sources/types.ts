/**
 * Source Intelligence Engine — core types.
 *
 * Every concept is modelled explicitly so callers never deal with
 * untyped `any`.  All external-boundary objects are Zod-validated
 * in the connector implementations; these interfaces describe the
 * canonical in-memory shapes.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export type SourceKind =
  | 'ADZUNA_API'
  | 'GREENHOUSE_API'
  | 'ASHBY_POSTING_API'
  | 'LEVER_POSTINGS_API'
  | 'SMARTRECRUITERS_POSTING_API'
  | 'TEAMTAILOR_FEED'
  | 'GENERIC_SCHEMA_ORG'
  | 'GENERIC_SITEMAP'
  | 'GENERIC_PUBLIC_HTML'
  | 'USER_UPLOAD'
  | 'MANUAL_URL_LIST';

export type DiagnosticStatus =
  | 'OK'
  | 'LOGIN_REQUIRED'
  | 'CAPTCHA_OR_BOT_CHALLENGE'
  | 'ROBOTS_DISALLOWED'
  | 'RATE_LIMITED'
  | 'API_KEY_REQUIRED'
  | 'UNSUPPORTED_ATS'
  | 'JS_RENDER_REQUIRED'
  | 'NETWORK_ERROR'
  | 'PARSER_FAILED'
  | 'NO_JOBS_FOUND'
  | 'PARTIAL_EXTRACTION'
  | 'LOW_CONFIDENCE_EXTRACTION';

export type PermissionStatus = 'UNKNOWN' | 'PERMITTED' | 'BLOCKED' | 'REQUIRES_API';

export type EvidenceStrength = 'DIRECT' | 'INFERRED' | 'MISSING';

// ── Source diagnostics ───────────────────────────────────────────────────────

export interface SourceDiagnostics {
  status: DiagnosticStatus;
  reason: string;
  robotsAllowed: boolean | null;
  authRequired: boolean;
  captchaDetected: boolean;
  rateLimited: boolean;
  apiAvailable: boolean;
  recommendedAlternative: string | null;
  userActionNeeded: string | null;
  errorCode: string | null;
  technicalDetails: string | null;
}

// ── Raw posting reference ────────────────────────────────────────────────────

export interface RawPostingReference {
  externalId: string | null;
  title: string;
  url: string;
  location: string | null;
  department: string | null;
  team: string | null;
  datePosted: string | null;
  dateSeen: string;
  rawMetadata: Record<string, unknown>;
}

// ── Normalised posting ───────────────────────────────────────────────────────

export interface NormalizedJobPosting {
  externalId: string | null;
  canonicalUrl: string;
  sourceUrl: string;
  companyName: string;
  title: string;
  normalizedTitle: string | null;
  department: string | null;
  subDepartment: string | null;
  team: string | null;
  jobFamily: string | null;
  jobLevel: string | null;
  employmentType: string | null;
  contractType: string | null;
  workingModel: string | null;       // remote / hybrid / onsite
  location: string | null;
  country: string | null;
  language: string | null;
  datePosted: string | null;
  dateFirstSeen: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;       // annual / monthly / hourly
  salarySource: string | null;
  descriptionRaw: string;
  descriptionClean: string;
  applicationUrl: string | null;
  contentHash: string;               // sha256 of canonical+title+descriptionRaw
  sourceKind: SourceKind;
  confidenceScore: number;           // 0-100
}

// ── JD Evaluation Readiness ──────────────────────────────────────────────────

export interface EvidenceItem {
  text: string;
  strength: EvidenceStrength;
  sourceNote: string | null;
}

export interface JDEvaluationReadiness {
  rolePurpose: EvidenceItem;
  topResponsibilities: EvidenceItem[];
  decisionRights: EvidenceItem;
  scopeOfImpact: EvidenceItem;
  reportingRelationships: EvidenceItem;
  criticalRequirements: EvidenceItem[];
  skillsEvidence: EvidenceItem[];
  missingEvidence: string[];
  ambiguityFlags: string[];
  recruitmentCopyWarning: boolean;
  evaluationReadinessScore: number;  // 0-100
  confidenceScore: number;           // 0-100
  recommendedQuestionsForHR: string[];
  recommendedImprovements: string[];
}

// ── Org structure signals ────────────────────────────────────────────────────

export interface OrgStructureSignal {
  companyName: string;
  department: string | null;
  subDepartment: string | null;
  team: string | null;
  location: string | null;
  jobFamily: string | null;
  title: string;
  seniority: string | null;
  possibleReportsTo: string | null;
  possibleManagerTitle: string | null;
  evidenceText: string;
  evidenceUrl: string;
  confidenceScore: number;           // 0-100
}

// ── Extra context ────────────────────────────────────────────────────────────

export type ContextRecommendation = 'INCLUDE' | 'KEEP_AS_CONTEXT' | 'IGNORE';

export interface ExtraContextItem {
  sourceType: string;
  title: string;
  url: string;
  publishedAt: string | null;
  summary: string;
  relevanceToJD: string;
  reliabilityScore: number;          // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: ContextRecommendation;
  reason: string;
}

// ── Source connector interface ───────────────────────────────────────────────

export interface DiscoverResult {
  postings: RawPostingReference[];
  totalCount: number | null;
  hasMore: boolean;
  diagnostics: SourceDiagnostics;
}

export interface FetchResult {
  html: string | null;
  json: unknown | null;
  diagnostics: SourceDiagnostics;
}

export interface NormalizeResult {
  posting: NormalizedJobPosting;
  diagnostics: SourceDiagnostics;
}

export interface SourceConnector {
  /** Unique connector identifier */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Source type enum value */
  readonly sourceKind: SourceKind;

  /**
   * Returns true if this connector can handle the given input.
   * input may be a URL, company name, board slug, or config object.
   */
  canHandle(input: string): boolean;

  /**
   * Performs preflight checks: robots.txt, API availability, auth.
   * Returns diagnostics without fetching any job data.
   */
  preflight(input: string): Promise<SourceDiagnostics>;

  /**
   * Discovers available job postings without fetching full content.
   * May return snippets + URLs for later full fetch.
   */
  discover(input: string, options?: Record<string, unknown>): Promise<DiscoverResult>;

  /**
   * Fetches the raw content of a single posting.
   */
  fetchPosting(ref: RawPostingReference): Promise<FetchResult>;

  /**
   * Normalizes raw content into a structured NormalizedJobPosting.
   */
  normalize(ref: RawPostingReference, fetchResult: FetchResult): Promise<NormalizeResult>;

  /**
   * Returns org structure signals extracted from all postings.
   * Called once after batch normalize.
   */
  extractOrgSignals(postings: NormalizedJobPosting[]): OrgStructureSignal[];
}
