'use client';

import { useState, useCallback, useEffect } from 'react';
import { HubNav } from '@/components/layout/hub-nav';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConnectorMeta {
  id: string;
  name: string;
  sourceKind: string;
  priority: number;
  description: string;
  requiresApiKey: boolean;
  complianceNote?: string;
}

interface SourceDiagnostics {
  status: string;
  reason?: string;
  robotsAllowed?: boolean | null;
  authRequired?: boolean;
  captchaDetected?: boolean;
  rateLimited?: boolean;
  apiAvailable?: boolean;
  recommendedAlternative?: string;
  userActionNeeded?: string | null;
  technicalDetails?: string | null;
}

interface DetectedConnector {
  id: string;
  name: string;
  sourceKind: string;
  priority?: number;
  description?: string;
  requiresApiKey?: boolean;
  complianceNote?: string;
}

interface PostingResult {
  externalId?: string;
  title: string;
  url?: string;
  location?: string;
  department?: string;
  team?: string;
  datePosted?: string;
  companyName?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  workingModel?: string;
  employmentType?: string;
  descriptionRaw?: string;
  confidenceScore?: number;
  quickReadinessScore?: number;
  sourceKind?: string;
}

interface KeywordEntry {
  keyword: string;
  category: string;
  frequency: number;
  isLikelyKnockout: boolean;
  evidence: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface AtsKeywordResult {
  disclaimer: string;
  criticalKeywords: KeywordEntry[];
  supportingKeywords: KeywordEntry[];
  likelyKnockoutCriteria: string[];
  missingCommonKeywords: string[];
  warningFlags: string[];
}

interface OrgNode {
  id: string;
  type: string;
  label: string;
  normalizedLabel: string;
  confidence: number;
  evidence: string[];
  sourceUrls: string[];
  jobCount: number;
}

interface OrgEdge {
  fromId: string;
  toId: string;
  relationshipType: string;
  confidence: number;
  evidence: string[];
}

interface OrgInferenceResult {
  disclaimer: string;
  nodes: OrgNode[];
  edges: OrgEdge[];
  unresolvedSignals: unknown[];
  conflicts: unknown[];
  stats: { totalPostings: number; departments: number; teams: number; locations: number; roles: number };
}

interface ReadinessElement {
  text: string;
  strength: 'DIRECT' | 'INFERRED' | 'MISSING';
  sourceNote?: string | null;
}

interface FullReadiness {
  rolePurpose: ReadinessElement;
  topResponsibilities: ReadinessElement[];
  decisionRights: ReadinessElement;
  scopeOfImpact: ReadinessElement;
  reportingRelationships: ReadinessElement;
  criticalRequirements: ReadinessElement[];
  skillsEvidence: ReadinessElement[];
  missingEvidence: string[];
  ambiguityFlags: string[];
  recruitmentCopyWarning: boolean;
  evaluationReadinessScore: number;
  confidenceScore: number;
  recommendedQuestionsForHR: string[];
  recommendedImprovements: string[];
}

interface ExtraContextItem {
  sourceType: string;
  title: string;
  url: string;
  publishedAt: string | null;
  summary: string;
  relevanceToJd: string | null;
  reliabilityScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: 'INCLUDE' | 'KEEP_AS_CONTEXT' | 'IGNORE';
  fetchError: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  OK: 'text-success bg-success/10',
  LOGIN_REQUIRED: 'text-danger bg-danger-bg',
  CAPTCHA_OR_BOT_CHALLENGE: 'text-danger bg-danger-bg',
  ROBOTS_DISALLOWED: 'text-warning bg-warning-bg',
  RATE_LIMITED: 'text-warning bg-warning-bg',
  API_KEY_REQUIRED: 'text-warning bg-warning-bg',
  UNSUPPORTED_ATS: 'text-text-muted bg-surface-page',
  JS_RENDER_REQUIRED: 'text-warning bg-warning-bg',
  NETWORK_ERROR: 'text-danger bg-danger-bg',
  PARSER_FAILED: 'text-danger bg-danger-bg',
  NO_JOBS_FOUND: 'text-text-muted bg-surface-page',
  PARTIAL_EXTRACTION: 'text-warning bg-warning-bg',
  LOW_CONFIDENCE_EXTRACTION: 'text-warning bg-warning-bg',
};

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Official API',
  2: 'Structured data',
  3: 'HTML fallback',
  4: 'Aggregator',
  5: 'Upload',
};

const inputCls =
  'w-full rounded-md border border-border-default bg-white px-3 py-[7px] font-body text-xs text-text-primary outline-none focus:border-brand-gold/60';

const STRENGTH_COLOURS: Record<string, string> = {
  DIRECT: 'text-success',
  INFERRED: 'text-warning',
  MISSING: 'text-danger',
};
const STRENGTH_ICONS: Record<string, string> = {
  DIRECT: '✓',
  INFERRED: '~',
  MISSING: '✗',
};

const RISK_COLOURS: Record<string, string> = {
  LOW: 'text-success bg-success/10',
  MEDIUM: 'text-warning bg-warning-bg',
  HIGH: 'text-danger bg-danger-bg',
};

const REC_COLOURS: Record<string, string> = {
  INCLUDE: 'text-success bg-success/10',
  KEEP_AS_CONTEXT: 'text-brand-gold bg-brand-gold/10',
  IGNORE: 'text-text-muted bg-surface-page',
};

function ReadinessBar({ score }: { score: number }) {
  if (score < 0) return <span className="text-[10px] text-danger">Score failed</span>;
  const colour = score >= 70 ? 'bg-success' : score >= 40 ? 'bg-warning' : 'bg-danger';
  const label = score >= 70 ? 'Ready' : score >= 40 ? 'Partial' : 'Low';
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-border-default"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`JD readiness: ${score}% — ${label}`}
      >
        <div className={`h-full ${colour}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] text-text-muted">{score} · {label}</span>
    </div>
  );
}

function DiagnosticBadge({ status }: { status: string }) {
  const cls = STATUS_COLOURS[status] ?? 'text-text-muted bg-surface-page';
  const descriptions: Record<string, string> = {
    OK: 'Source is accessible and ready to discover postings.',
    LOGIN_REQUIRED: 'Authentication required — use API or export.',
    CAPTCHA_OR_BOT_CHALLENGE: 'Bot challenge detected — paste HTML or use ATS API.',
    ROBOTS_DISALLOWED: 'robots.txt disallows crawling this path.',
    RATE_LIMITED: 'Too many requests — wait or use official API.',
    API_KEY_REQUIRED: 'API credentials missing — configure in Settings.',
    UNSUPPORTED_ATS: 'No connector matched this URL.',
    JS_RENDER_REQUIRED: 'JavaScript rendering required — paste HTML or use ATS API.',
    NETWORK_ERROR: 'Network error — check URL and try again.',
    PARSER_FAILED: 'Extraction failed — try a different URL or paste HTML.',
    NO_JOBS_FOUND: 'No job postings found — board may be empty.',
    PARTIAL_EXTRACTION: 'Only snippets available — route to employer URL for full JD.',
    LOW_CONFIDENCE_EXTRACTION: 'Weak signals — HR validation recommended.',
  };
  return (
    <span
      className={`inline-block cursor-help rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold ${cls}`}
      title={descriptions[status] ?? status}
    >
      {status}
    </span>
  );
}

// ── Full Readiness Modal (Phase 11) ───────────────────────────────────────────

function ReadinessModal({
  posting,
  readiness,
  onClose,
}: {
  posting: PostingResult;
  readiness: FullReadiness;
  onClose: () => void;
}) {
  const score = readiness.evaluationReadinessScore;
  const scoreColour = score >= 70 ? 'text-success' : score >= 40 ? 'text-warning' : 'text-danger';
  const scoreLabel = score >= 70 ? 'Evaluation-ready' : score >= 40 ? 'Partially ready' : 'Recruitment copy only';

  function ElementRow({ label, el }: { label: string; el: ReadinessElement }) {
    const col = STRENGTH_COLOURS[el.strength] ?? '';
    const icon = STRENGTH_ICONS[el.strength] ?? '?';
    return (
      <div className="border-b border-border-default py-2.5 last:border-0">
        <div className="flex items-baseline gap-2">
          <span className={`text-[11px] font-semibold ${col}`}>{icon}</span>
          <span className="text-[11px] font-semibold text-text-primary">{label}</span>
          <span className={`ml-auto text-[10px] font-mono ${col}`}>{el.strength}</span>
        </div>
        {el.text && el.strength !== 'MISSING' && (
          <p className="mt-1 pl-4 text-[11px] text-text-secondary leading-relaxed">{el.text}</p>
        )}
        {el.sourceNote && (
          <p className="mt-0.5 pl-4 text-[10px] italic text-text-muted">{el.sourceNote}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl border border-border-default bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-default px-6 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">JD Evaluation Readiness</div>
            <h2 className="mt-0.5 text-[14px] font-semibold text-text-primary line-clamp-1">{posting.title}</h2>
            {posting.companyName && <div className="text-[11px] text-text-muted">{posting.companyName}</div>}
          </div>
          <button onClick={onClose} className="ml-4 text-text-muted hover:text-text-primary" aria-label="Close">
            ✕
          </button>
        </div>

        {/* Score banner */}
        <div className="flex items-center gap-6 border-b border-border-default bg-surface-page px-6 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Readiness score</div>
            <div className={`text-2xl font-bold ${scoreColour}`}>{score}<span className="text-sm font-normal text-text-muted">/100</span></div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Verdict</div>
            <div className={`text-[12px] font-semibold ${scoreColour}`}>{scoreLabel}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Confidence</div>
            <div className="text-[12px] font-semibold text-text-primary">{readiness.confidenceScore}%</div>
          </div>
          {readiness.recruitmentCopyWarning && (
            <div className="ml-auto rounded border border-warning bg-warning-bg px-2.5 py-1 text-[10px] font-medium text-warning">
              ⚠ Recruitment copy detected
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-4">
          {/* 6 Gradeability Elements */}
          <div className="mb-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">6 Gradeability Elements</div>
            <div className="rounded-lg border border-border-default px-4">
              <ElementRow label="Role Purpose" el={readiness.rolePurpose} />
              <ElementRow label="Decision Rights" el={readiness.decisionRights} />
              <ElementRow label="Scope of Impact" el={readiness.scopeOfImpact} />
              <ElementRow label="Reporting Relationships" el={readiness.reportingRelationships} />
              {readiness.topResponsibilities.slice(0, 3).map((el, i) => (
                <ElementRow key={i} label={i === 0 ? 'Top Responsibilities' : ''} el={el} />
              ))}
              {readiness.criticalRequirements.slice(0, 2).map((el, i) => (
                <ElementRow key={i} label={i === 0 ? 'Critical Requirements' : ''} el={el} />
              ))}
            </div>
          </div>

          {/* Missing evidence */}
          {readiness.missingEvidence.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Missing Evidence</div>
              <ul className="space-y-1">
                {readiness.missingEvidence.map((m, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-danger">
                    <span className="mt-0.5 shrink-0">✗</span>{m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ambiguity flags */}
          {readiness.ambiguityFlags.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Ambiguity Flags</div>
              <ul className="space-y-1">
                {readiness.ambiguityFlags.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-warning">
                    <span className="mt-0.5 shrink-0">⚠</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Questions for HR */}
          {readiness.recommendedQuestionsForHR.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Recommended Questions for HR</div>
              <ol className="space-y-1 list-decimal list-inside">
                {readiness.recommendedQuestionsForHR.map((q, i) => (
                  <li key={i} className="text-[11px] text-text-secondary">{q}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Improvements */}
          {readiness.recommendedImprovements.length > 0 && (
            <div className="mb-2">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Recommended Improvements</div>
              <ul className="space-y-1">
                {readiness.recommendedImprovements.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-text-secondary">
                    <span className="mt-0.5 shrink-0 text-brand-gold">→</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ATS Keywords Drawer (Phase 8) ─────────────────────────────────────────────

function AtsKeywordsDrawer({
  posting,
  result,
  onClose,
}: {
  posting: PostingResult;
  result: AtsKeywordResult;
  onClose: () => void;
}) {
  const CATEGORY_COLOURS: Record<string, string> = {
    tool: 'bg-blue-50 text-blue-700 border-blue-200',
    certification: 'bg-purple-50 text-purple-700 border-purple-200',
    methodology: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    soft_skill: 'bg-green-50 text-green-700 border-green-200',
    qualification: 'bg-orange-50 text-orange-700 border-orange-200',
    hard_skill: 'bg-gray-50 text-gray-700 border-gray-200',
    industry: 'bg-teal-50 text-teal-700 border-teal-200',
  };

  function KeywordChip({ kw }: { kw: KeywordEntry }) {
    const cls = CATEGORY_COLOURS[kw.category] ?? 'bg-surface-page text-text-secondary border-border-default';
    return (
      <span
        title={kw.evidence || kw.keyword}
        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium ${cls} ${kw.isLikelyKnockout ? 'ring-1 ring-danger/40' : ''}`}
      >
        {kw.isLikelyKnockout && <span className="text-danger">!</span>}
        {kw.keyword}
        {kw.frequency > 1 && <span className="opacity-60">×{kw.frequency}</span>}
      </span>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/30"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex h-full w-full max-w-[480px] flex-col border-l border-border-default bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-default px-5 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">ATS Keyword Analysis</div>
            <h2 className="mt-0.5 text-[13px] font-semibold text-text-primary line-clamp-1">{posting.title}</h2>
          </div>
          <button onClick={onClose} className="ml-4 text-text-muted hover:text-text-primary" aria-label="Close">✕</button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* Disclaimer */}
          <p className="text-[10px] italic text-text-muted">{result.disclaimer}</p>

          {/* Warning flags */}
          {result.warningFlags.length > 0 && (
            <div className="rounded border border-warning bg-warning-bg px-3 py-2 space-y-0.5">
              {result.warningFlags.map((f, i) => (
                <p key={i} className="text-[11px] text-warning">⚠ {f}</p>
              ))}
            </div>
          )}

          {/* Knockout criteria */}
          {result.likelyKnockoutCriteria.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-danger">Likely Knockout Criteria</div>
              <ul className="space-y-1">
                {result.likelyKnockoutCriteria.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-text-secondary">
                    <span className="text-danger mt-0.5 shrink-0">!</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Critical keywords */}
          {result.criticalKeywords.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Critical Keywords</div>
              <div className="flex flex-wrap gap-1.5">
                {result.criticalKeywords.map((kw, i) => <KeywordChip key={i} kw={kw} />)}
              </div>
            </div>
          )}

          {/* Supporting keywords */}
          {result.supportingKeywords.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Supporting Keywords</div>
              <div className="flex flex-wrap gap-1.5">
                {result.supportingKeywords.map((kw, i) => <KeywordChip key={i} kw={kw} />)}
              </div>
            </div>
          )}

          {/* Missing common */}
          {result.missingCommonKeywords.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Potentially Missing</div>
              <ul className="space-y-1">
                {result.missingCommonKeywords.map((m, i) => (
                  <li key={i} className="text-[11px] text-text-muted">· {m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Legend */}
          <div className="rounded border border-border-default bg-surface-page px-3 py-2">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Legend</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CATEGORY_COLOURS).map(([cat, cls]) => (
                <span key={cat} className={`rounded border px-1.5 py-0.5 text-[10px] ${cls}`}>{cat}</span>
              ))}
              <span className="rounded border border-danger/40 px-1.5 py-0.5 text-[10px] text-danger">! = knockout</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Section 1: Source Setup ───────────────────────────────────────────────────

function SourceSetup({
  onPreflightResult,
}: {
  onPreflightResult: (connector: DetectedConnector | null, diag: SourceDiagnostics, input: string) => void;
}) {
  const [connectors, setConnectors] = useState<ConnectorMeta[] | null>(null);
  const [loadingConnectors, setLoadingConnectors] = useState(false);
  const [input, setInput] = useState('');
  const [preflighting, setPreflighting] = useState(false);
  const [showConnectorList, setShowConnectorList] = useState(false);

  async function loadConnectors() {
    if (connectors) { setShowConnectorList((v) => !v); return; }
    setLoadingConnectors(true);
    try {
      const res = await fetch('/api/sources/preflight');
      const data = await res.json();
      setConnectors(data.connectors ?? []);
      setShowConnectorList(true);
    } finally {
      setLoadingConnectors(false);
    }
  }

  async function runPreflight() {
    if (!input.trim()) return;
    setPreflighting(true);
    try {
      const res = await fetch('/api/sources/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.diagnostics) {
        onPreflightResult(null, {
          status: 'NETWORK_ERROR',
          reason: data.error || `Preflight failed (${res.status})`,
          robotsAllowed: null,
          authRequired: false,
          captchaDetected: false,
          rateLimited: false,
          apiAvailable: false,
        } as SourceDiagnostics, input.trim());
        return;
      }
      onPreflightResult(data.detectedConnector ?? null, data.diagnostics, input.trim());
    } finally {
      setPreflighting(false);
    }
  }

  return (
    <section className="rounded-lg border border-border-default bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-text-primary">1 · Add source</h2>
        <button
          type="button"
          onClick={loadConnectors}
          className="text-[11px] text-brand-gold hover:underline"
        >
          {loadingConnectors ? 'Loading…' : showConnectorList ? 'Hide connectors' : 'View supported connectors'}
        </button>
      </div>

      {showConnectorList && connectors && (
        <div className="mb-4 overflow-hidden rounded border border-border-default">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-surface-page text-left text-[10px] uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2">Connector</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Auth</th>
                <th className="px-3 py-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {connectors.map((c) => (
                <tr key={c.id} className="hover:bg-surface-page/50">
                  <td className="px-3 py-2 font-medium text-text-primary">{c.name}</td>
                  <td className="px-3 py-2 text-text-muted">{PRIORITY_LABELS[c.priority] ?? c.sourceKind}</td>
                  <td className="px-3 py-2">{c.requiresApiKey ? <span className="rounded bg-warning-bg px-1 text-[10px] text-warning">API key</span> : <span className="text-text-muted">None</span>}</td>
                  <td className="px-3 py-2 text-text-muted">{c.complianceNote ?? c.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <label className="mb-3 flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
          Careers page URL or company name
        </span>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runPreflight()}
            placeholder="https://boards.greenhouse.io/acme  ·  https://jobs.ashbyhq.com/acme  ·  https://careers.company.com"
            className={inputCls}
          />
          <button
            type="button"
            onClick={runPreflight}
            disabled={preflighting || !input.trim()}
            className="shrink-0 rounded-md bg-brand-gold px-4 py-[7px] text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {preflighting ? 'Checking…' : 'Preflight →'}
          </button>
        </div>
      </label>

      <p className="text-[11px] text-text-muted">
        Preflight detects the connector, checks access, and confirms data is available — before importing anything.
      </p>
    </section>
  );
}

// ── Section 2: Preflight Result ───────────────────────────────────────────────

function PreflightResult({
  connector,
  diagnostics,
  input,
  onDiscover,
  discovering,
}: {
  connector: DetectedConnector | null;
  diagnostics: SourceDiagnostics;
  input: string;
  onDiscover: () => void;
  discovering: boolean;
}) {
  const canDiscover = diagnostics.status === 'OK' || diagnostics.status === 'PARTIAL_EXTRACTION';

  return (
    <section className="rounded-lg border border-border-default bg-white p-5">
      <h2 className="mb-3 text-[13px] font-semibold text-text-primary">2 · Preflight result</h2>

      <div className="mb-3 flex flex-wrap items-start gap-4">
        <div>
          <div className="mb-0.5 text-[10px] uppercase tracking-wider text-text-muted">Status</div>
          <DiagnosticBadge status={diagnostics.status} />
        </div>
        {connector && (
          <div>
            <div className="mb-0.5 text-[10px] uppercase tracking-wider text-text-muted">Connector detected</div>
            <div className="text-[12px] font-medium text-text-primary">
              {connector.name}
              {connector.priority && (
                <span className="ml-1.5 text-[10px] text-text-muted">({PRIORITY_LABELS[connector.priority]})</span>
              )}
            </div>
          </div>
        )}
        {diagnostics.robotsAllowed !== null && diagnostics.robotsAllowed !== undefined && (
          <div>
            <div className="mb-0.5 text-[10px] uppercase tracking-wider text-text-muted">robots.txt</div>
            <div className={`text-[12px] font-medium ${diagnostics.robotsAllowed ? 'text-success' : 'text-danger'}`}>
              {diagnostics.robotsAllowed ? '✓ Allowed' : '✗ Disallowed'}
            </div>
          </div>
        )}
        {diagnostics.apiAvailable && (
          <div>
            <div className="mb-0.5 text-[10px] uppercase tracking-wider text-text-muted">API</div>
            <div className="text-[12px] font-medium text-success">✓ Available</div>
          </div>
        )}
      </div>

      {diagnostics.reason && (
        <p className="mb-2 text-[11px] text-text-secondary">{diagnostics.reason}</p>
      )}
      {diagnostics.userActionNeeded && (
        <div className="mb-2 rounded border border-warning bg-warning-bg px-3 py-2 text-[11px] text-warning">
          <strong>Action needed:</strong> {diagnostics.userActionNeeded}
        </div>
      )}
      {diagnostics.recommendedAlternative && (
        <div className="mb-2 text-[11px] text-text-muted">
          <strong>Alternative:</strong> {diagnostics.recommendedAlternative}
        </div>
      )}
      {connector?.complianceNote && (
        <div className="mb-3 text-[10px] text-text-muted italic">{connector.complianceNote}</div>
      )}

      {canDiscover && (
        <button
          type="button"
          onClick={onDiscover}
          disabled={discovering}
          className="rounded-md bg-brand-gold px-4 py-[7px] text-xs font-medium text-white disabled:opacity-50"
        >
          {discovering ? 'Discovering postings…' : '↓ Discover postings'}
        </button>
      )}
    </section>
  );
}

// ── Section 3: Ingestion run summary ─────────────────────────────────────────

function IngestionSummary({
  total,
  source,
  diagnostics,
}: {
  total: number;
  source: string;
  diagnostics?: SourceDiagnostics;
}) {
  return (
    <section className="rounded-lg border border-border-default bg-white p-5">
      <h2 className="mb-2 text-[13px] font-semibold text-text-primary">3 · Ingestion run</h2>
      <div className="flex flex-wrap gap-6 text-[12px]">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Discovered</div>
          <div className="mt-0.5 text-lg font-bold text-text-primary">{total}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Source</div>
          <div className="mt-0.5 font-medium text-text-primary truncate max-w-[240px]" title={source}>{source}</div>
        </div>
        {diagnostics && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Status</div>
            <div className="mt-0.5"><DiagnosticBadge status={diagnostics.status} /></div>
          </div>
        )}
      </div>
      {diagnostics?.reason && (
        <p className="mt-2 text-[11px] text-text-muted">{diagnostics.reason}</p>
      )}
    </section>
  );
}

// ── Section 4: Imported jobs table ────────────────────────────────────────────

function PostingsTable({
  postings,
  onSaveToHub,
  savingMap,
  savedMap,
  saveErrors,
  onAnalyseReadiness,
  analysingMap,
  readinessMap,
  onViewKeywords,
  keywordsLoadingMap,
}: {
  postings: PostingResult[];
  onSaveToHub: (p: PostingResult) => void;
  savingMap: Record<string, boolean>;
  savedMap: Record<string, string>;
  saveErrors: Record<string, string>;
  onAnalyseReadiness: (p: PostingResult) => void;
  analysingMap: Record<string, boolean>;
  readinessMap: Record<string, number | FullReadiness>;
  onViewKeywords: (p: PostingResult) => void;
  keywordsLoadingMap: Record<string, boolean>;
}) {
  if (postings.length === 0) return null;

  return (
    <section className="rounded-lg border border-border-default bg-white">
      <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
        <h2 className="text-[13px] font-semibold text-text-primary">4 · Discovered postings</h2>
        <span className="text-[11px] text-text-muted">{postings.length} postings</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-[11px]" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '26%' }} />
          </colgroup>
          <thead>
            <tr className="bg-surface-page text-left text-[10px] uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2.5">Title</th>
              <th className="px-4 py-2.5">Department</th>
              <th className="px-4 py-2.5">Location</th>
              <th className="px-4 py-2.5">Salary</th>
              <th className="px-4 py-2.5">Posted</th>
              <th className="px-4 py-2.5">Readiness</th>
              <th className="px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {postings.map((p, i) => {
              const key = p.externalId ?? p.url ?? String(i);
              const savedId = savedMap[key];
              const saving = savingMap[key];
              const saveErr = saveErrors[key];
              const analysing = analysingMap[key];
              const readinessEntry = readinessMap[key];
              const kLoading = keywordsLoadingMap[key];

              let readinessScore: number | undefined;
              let hasFullReadiness = false;
              if (typeof readinessEntry === 'number') {
                readinessScore = readinessEntry;
              } else if (readinessEntry && typeof readinessEntry === 'object') {
                readinessScore = readinessEntry.evaluationReadinessScore;
                hasFullReadiness = true;
              } else {
                readinessScore = p.quickReadinessScore;
              }

              return (
                <tr key={key} className="hover:bg-surface-page/40">
                  <td className="px-4 py-3">
                    <div className="truncate font-medium text-text-primary" title={p.title}>
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noreferrer" className="hover:text-brand-gold">
                          {p.title}
                        </a>
                      ) : p.title}
                    </div>
                    {p.companyName && (
                      <div className="truncate text-[10px] text-text-muted">{p.companyName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="truncate text-text-secondary">{p.department ?? '—'}</div>
                    {p.team && <div className="truncate text-[10px] text-text-muted">{p.team}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="truncate text-text-secondary">{p.location ?? '—'}</div>
                    {p.workingModel && (
                      <div className="text-[10px] text-text-muted">{p.workingModel}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {p.salaryMin ? (
                      <div>
                        <span className="font-medium">{p.salaryCurrency ?? ''} {p.salaryMin.toLocaleString()}</span>
                        {p.salaryMax && <span> – {p.salaryMax.toLocaleString()}</span>}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {p.datePosted ? p.datePosted.slice(0, 10) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {readinessScore !== undefined ? (
                      <button
                        type="button"
                        onClick={() => onAnalyseReadiness(p)}
                        disabled={analysing}
                        className="text-left disabled:opacity-50"
                        title={hasFullReadiness ? 'Click to view full analysis' : 'Click to run full analysis'}
                      >
                        <ReadinessBar score={readinessScore} />
                        {!hasFullReadiness && (
                          <span className="text-[9px] text-brand-gold hover:underline">Full analysis →</span>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAnalyseReadiness(p)}
                        disabled={analysing}
                        className="text-[10px] text-brand-gold hover:underline disabled:opacity-50"
                      >
                        {analysing ? 'Scoring…' : '+ Score'}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {savedId ? (
                        <a
                          href={`/jd/${savedId}`}
                          className="rounded-full bg-success px-2 py-0.5 text-[10px] font-medium text-white hover:opacity-80"
                        >
                          ✓ Saved — Open
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSaveToHub(p)}
                          disabled={saving || !p.url}
                          className="rounded-full border border-brand-gold/40 bg-brand-gold/10 px-2 py-0.5 text-[10px] font-medium text-brand-gold hover:bg-brand-gold/20 disabled:opacity-50"
                        >
                          {saving ? 'Saving…' : '↓ Save to Hub'}
                        </button>
                      )}
                      {p.descriptionRaw && (
                        <button
                          type="button"
                          onClick={() => onViewKeywords(p)}
                          disabled={kLoading}
                          className="rounded-full border border-border-default px-2 py-0.5 text-[10px] text-text-muted hover:border-brand-gold/40 hover:text-brand-gold disabled:opacity-50"
                        >
                          {kLoading ? 'Loading…' : 'Keywords'}
                        </button>
                      )}
                    </div>
                    {saveErr && (
                      <div className="mt-0.5 text-[10px] text-danger truncate" title={saveErr}>{saveErr}</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Section 5: Org Structure Draft (Phase 9) ──────────────────────────────────

function OrgStructurePanel({
  result,
  loading,
  error,
}: {
  result: OrgInferenceResult | null;
  loading: boolean;
  error: string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (loading) {
    return (
      <section className="rounded-lg border border-border-default bg-white p-5">
        <h2 className="mb-3 text-[13px] font-semibold text-text-primary">5 · Org Structure Draft</h2>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-surface-page" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-border-default bg-white p-5">
        <h2 className="mb-2 text-[13px] font-semibold text-text-primary">5 · Org Structure Draft</h2>
        <p className="text-[11px] text-danger">{error}</p>
      </section>
    );
  }

  if (!result) return null;

  const { nodes, stats } = result;
  const depts = nodes.filter((n) => n.type === 'department');
  const teams = nodes.filter((n) => n.type === 'team');
  const locs = nodes.filter((n) => n.type === 'location');
  const roles = nodes.filter((n) => n.type === 'role');

  function NodeGroup({ title, items, colour }: { title: string; items: OrgNode[]; colour: string }) {
    if (items.length === 0) return null;
    return (
      <div>
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">{title}</div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((n) => {
            const conf = n.confidence;
            const opacity = conf >= 80 ? '' : conf >= 60 ? 'opacity-80' : 'opacity-60';
            return (
              <span
                key={n.id}
                title={`Confidence: ${conf}% · ${n.jobCount} posting${n.jobCount !== 1 ? 's' : ''} · ${n.evidence.slice(0, 1).join(', ')}`}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${colour} ${opacity}`}
              >
                {n.label}
                <span className="text-[9px] opacity-60">{conf}%</span>
                {n.jobCount > 1 && <span className="text-[9px] opacity-60">·{n.jobCount}</span>}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-border-default bg-white">
      <div
        className="flex cursor-pointer items-center justify-between px-5 py-3"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-[13px] font-semibold text-text-primary">5 · Org Structure Draft</h2>
          <div className="flex gap-3 text-[10px] text-text-muted">
            {stats.departments > 0 && <span>{stats.departments} dept{stats.departments !== 1 ? 's' : ''}</span>}
            {stats.teams > 0 && <span>{stats.teams} teams</span>}
            {stats.locations > 0 && <span>{stats.locations} locations</span>}
          </div>
        </div>
        <span className="text-[11px] text-text-muted">{collapsed ? '▸' : '▾'}</span>
      </div>

      {!collapsed && (
        <div className="border-t border-border-default px-5 pb-5 pt-4 space-y-4">
          <p className="text-[10px] italic text-text-muted">{result.disclaimer}</p>

          <NodeGroup
            title="Departments"
            items={depts}
            colour="border-blue-200 bg-blue-50 text-blue-700"
          />
          <NodeGroup
            title="Teams"
            items={teams}
            colour="border-indigo-200 bg-indigo-50 text-indigo-700"
          />
          <NodeGroup
            title="Locations"
            items={locs}
            colour="border-green-200 bg-green-50 text-green-700"
          />
          {roles.length > 0 && (
            <NodeGroup
              title="Senior Roles Detected"
              items={roles.slice(0, 20)}
              colour="border-orange-200 bg-orange-50 text-orange-700"
            />
          )}

          {result.conflicts.length > 0 && (
            <div className="rounded border border-warning bg-warning-bg px-3 py-2">
              <div className="text-[10px] font-bold text-warning uppercase tracking-wider mb-1">Conflicts detected</div>
              <p className="text-[11px] text-warning">{result.conflicts.length} node label conflict{result.conflicts.length !== 1 ? 's' : ''} — same name appears under different types. Manual review recommended.</p>
            </div>
          )}

          {result.unresolvedSignals.length > 0 && (
            <p className="text-[10px] text-text-muted">
              {result.unresolvedSignals.length} posting{result.unresolvedSignals.length !== 1 ? 's' : ''} had no dept/team signal and were excluded from the graph.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ── Section 6: Extra Context (Phase 7) ────────────────────────────────────────

function ExtraContextPanel({
  companyName,
}: {
  companyName: string;
}) {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ExtraContextItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  async function addContext() {
    if (!urlInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sources/extra-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput.trim(),
          contextCompany: companyName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.item) {
        setError(data.error || 'Failed to fetch context');
        return;
      }
      setItems((prev) => [data.item, ...prev]);
      setUrlInput('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-border-default bg-white">
      <div
        className="flex cursor-pointer items-center justify-between px-5 py-3"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-[13px] font-semibold text-text-primary">6 · Extra Context</h2>
          <span className="text-[10px] text-text-muted">Annual reports · Press releases · News · IR pages</span>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <span className="rounded-full bg-brand-gold/10 px-2 py-0.5 text-[10px] font-medium text-brand-gold">{items.length}</span>
          )}
          <span className="text-[11px] text-text-muted">{collapsed ? '▸' : '▾'}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-border-default px-5 pb-5 pt-4">
          <p className="mb-3 text-[11px] text-text-muted">
            Add public URLs (annual reports, press releases, news articles, IR pages) to enrich the job analysis context. Only publicly accessible pages. No authentication attempted.
          </p>

          <div className="mb-4 flex gap-2">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addContext()}
              placeholder="https://investors.company.com/annual-report-2024  ·  https://newsroom.company.com/press-release"
              className={inputCls}
            />
            <button
              type="button"
              onClick={addContext}
              disabled={loading || !urlInput.trim()}
              className="shrink-0 rounded-md bg-brand-gold px-4 py-[7px] text-xs font-medium text-white disabled:opacity-50"
            >
              {loading ? 'Fetching…' : '+ Add'}
            </button>
          </div>

          {error && (
            <div className="mb-3 text-[11px] text-danger">{error}</div>
          )}

          {items.length === 0 && (
            <div className="rounded border border-dashed border-border-default py-6 text-center text-[11px] text-text-muted">
              No extra context added yet. Paste a URL above to start.
            </div>
          )}

          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="rounded-lg border border-border-default p-3">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono font-semibold uppercase text-text-muted">{item.sourceType.replace('_', ' ')}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${RISK_COLOURS[item.riskLevel]}`}>
                      {item.riskLevel} risk
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${REC_COLOURS[item.recommendation]}`}>
                      {item.recommendation.replace('_', ' ')}
                    </span>
                    <span className="ml-auto text-[10px] text-text-muted">Reliability: {item.reliabilityScore}%</span>
                  </div>
                  <div className="mb-0.5 text-[12px] font-medium text-text-primary truncate">
                    <a href={item.url} target="_blank" rel="noreferrer" className="hover:text-brand-gold">{item.title}</a>
                  </div>
                  {item.publishedAt && (
                    <div className="mb-1 text-[10px] text-text-muted">{item.publishedAt.slice(0, 10)}</div>
                  )}
                  {item.fetchError ? (
                    <p className="text-[11px] text-danger">{item.fetchError}</p>
                  ) : (
                    <p className="text-[11px] text-text-secondary line-clamp-2">{item.summary}</p>
                  )}
                  {item.relevanceToJd && (
                    <p className="mt-1 text-[10px] italic text-text-muted line-clamp-1">{item.relevanceToJd}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                    className="mt-1.5 text-[10px] text-text-muted hover:text-danger"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SourcesPage() {
  // Preflight state
  const [preflightDone, setPreflightDone] = useState(false);
  const [detectedConnector, setDetectedConnector] = useState<DetectedConnector | null>(null);
  const [preflightDiag, setPreflightDiag] = useState<SourceDiagnostics | null>(null);
  const [preflightInput, setPreflightInput] = useState('');

  // Discovery state
  const [discovering, setDiscovering] = useState(false);
  const [discoverDone, setDiscoverDone] = useState(false);
  const [postings, setPostings] = useState<PostingResult[]>([]);
  const [discoverDiag, setDiscoverDiag] = useState<SourceDiagnostics | null>(null);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  // Per-row: save to Hub
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<string, string>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  // Per-row: readiness scoring (number = quick, FullReadiness = full)
  const [analysingMap, setAnalysingMap] = useState<Record<string, boolean>>({});
  const [readinessMap, setReadinessMap] = useState<Record<string, number | FullReadiness>>({});

  // Full readiness modal (Phase 11)
  const [readinessModal, setReadinessModal] = useState<{ posting: PostingResult; readiness: FullReadiness } | null>(null);

  // ATS Keywords drawer (Phase 8)
  const [keywordsLoadingMap, setKeywordsLoadingMap] = useState<Record<string, boolean>>({});
  const [keywordsDrawer, setKeywordsDrawer] = useState<{ posting: PostingResult; result: AtsKeywordResult } | null>(null);

  // Org inference (Phase 9) — auto-run after discovery
  const [orgResult, setOrgResult] = useState<OrgInferenceResult | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);

  function handlePreflightResult(
    connector: DetectedConnector | null,
    diag: SourceDiagnostics,
    input: string,
  ) {
    setDetectedConnector(connector);
    setPreflightDiag(diag);
    setPreflightInput(input);
    setPreflightDone(true);
    setDiscoverDone(false);
    setPostings([]);
    setDiscoverDiag(null);
    setDiscoverError(null);
    setOrgResult(null);
    setOrgError(null);
  }

  async function runDiscover() {
    if (!preflightInput) return;
    setDiscovering(true);
    setDiscoverError(null);
    try {
      const res = await fetch('/api/sources/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: preflightInput,
          connectorId: detectedConnector?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDiscoverError(data.error || `Discovery failed (${res.status})`);
        return;
      }
      const discovered: PostingResult[] = data.postings ?? [];
      setPostings(discovered);
      setDiscoverDiag(data.diagnostics ?? null);
      setDiscoverDone(true);

      // Auto-run org inference if we have postings (Phase 9)
      if (discovered.length > 0) {
        runOrgInference(discovered);
      }
    } finally {
      setDiscovering(false);
    }
  }

  async function runOrgInference(ps: PostingResult[]) {
    setOrgLoading(true);
    setOrgError(null);
    try {
      const res = await fetch('/api/sources/org-inference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postings: ps }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOrgError(data.error || 'Org inference failed');
        return;
      }
      setOrgResult(data.result ?? null);
    } catch (err: unknown) {
      setOrgError(err instanceof Error ? err.message : 'Org inference failed');
    } finally {
      setOrgLoading(false);
    }
  }

  const rowKey = useCallback((p: PostingResult, i: number) => p.externalId ?? p.url ?? String(i), []);

  async function saveToHub(p: PostingResult) {
    const url = p.url;
    if (!url) return;
    const key = p.externalId ?? url;
    setSavingMap((s) => ({ ...s, [key]: true }));
    setSaveErrors((s) => { const n = { ...s }; delete n[key]; return n; });
    try {
      const res = await fetch('/api/jobs/scrape-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          jobTitleHint: p.title,
          companyHint: p.companyName,
          sourceUrl: url,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setSavedMap((s) => ({ ...s, [key]: data.jdId }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setSaveErrors((s) => ({ ...s, [key]: msg }));
    } finally {
      setSavingMap((s) => ({ ...s, [key]: false }));
    }
  }

  async function analyseReadiness(p: PostingResult, i: number) {
    const key = rowKey(p, i);
    if (!p.descriptionRaw || !p.title) return;

    const existing = readinessMap[key];
    const quickOnly = !existing; // first click = quick, second = full

    setAnalysingMap((s) => ({ ...s, [key]: true }));
    try {
      const res = await fetch('/api/sources/analyse-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: p.title,
          description: p.descriptionRaw,
          companyName: p.companyName,
          location: p.location,
          quickOnly,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (quickOnly && data.quickScore !== undefined) {
          setReadinessMap((s) => ({ ...s, [key]: data.quickScore as number }));
        } else if (!quickOnly && data.readiness) {
          const fullR = data.readiness as FullReadiness;
          setReadinessMap((s) => ({ ...s, [key]: fullR }));
          setReadinessModal({ posting: p, readiness: fullR });
        } else {
          setReadinessMap((s) => ({ ...s, [key]: -1 }));
        }
      } else {
        setReadinessMap((s) => ({ ...s, [key]: -1 }));
      }
    } catch {
      setReadinessMap((s) => ({ ...s, [key]: -1 }));
    } finally {
      setAnalysingMap((s) => ({ ...s, [key]: false }));
    }
  }

  async function viewKeywords(p: PostingResult) {
    if (!p.descriptionRaw || !p.title) return;
    const key = p.externalId ?? p.url ?? p.title;
    setKeywordsLoadingMap((s) => ({ ...s, [key]: true }));
    try {
      const res = await fetch('/api/sources/ats-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: p.title,
          description: p.descriptionRaw,
          jobFamily: p.department,
        }),
      });
      const data = await res.json();
      if (res.ok && data.result) {
        setKeywordsDrawer({ posting: p, result: data.result as AtsKeywordResult });
      }
    } finally {
      setKeywordsLoadingMap((s) => ({ ...s, [key]: false }));
    }
  }

  // Derive company name from first posting
  const companyName = postings[0]?.companyName ?? '';

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1080px]">
        <HubNav />

        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">
          JD Hub · Source Intelligence
        </div>
        <h1 className="mb-1 font-display text-2xl font-bold text-text-primary">Sources</h1>
        <p className="mb-6 text-[13px] text-text-secondary">
          Import job postings from official ATS APIs, structured career pages, and job boards. The pipeline uses
          official APIs first, structured data second, and HTML extraction only as a last resort — with full
          diagnostic transparency at every step.
        </p>

        <div className="flex flex-col gap-4">
          {/* Step 1 — always visible */}
          <SourceSetup onPreflightResult={handlePreflightResult} />

          {/* Step 2 — after preflight */}
          {preflightDone && preflightDiag && (
            <PreflightResult
              connector={detectedConnector}
              diagnostics={preflightDiag}
              input={preflightInput}
              onDiscover={runDiscover}
              discovering={discovering}
            />
          )}

          {/* Discovery loading skeleton */}
          {discovering && (
            <div className="rounded-lg border border-border-default bg-white p-5">
              <div className="mb-3 h-4 w-32 animate-pulse rounded bg-border-default" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-surface-page" />
                ))}
              </div>
            </div>
          )}

          {/* Discover error */}
          {discoverError && !discovering && (
            <div className="rounded-lg border border-danger bg-danger-bg p-4 text-[12px] text-danger">
              {discoverError}
            </div>
          )}

          {/* Step 3 — after discovery */}
          {discoverDone && (
            <IngestionSummary
              total={postings.length}
              source={preflightInput}
              diagnostics={discoverDiag ?? undefined}
            />
          )}

          {/* Step 4 — postings table */}
          {postings.length > 0 && (
            <PostingsTable
              postings={postings}
              onSaveToHub={saveToHub}
              savingMap={savingMap}
              savedMap={savedMap}
              saveErrors={saveErrors}
              onAnalyseReadiness={(p) => {
                const i = postings.indexOf(p);
                analyseReadiness(p, i);
              }}
              analysingMap={analysingMap}
              readinessMap={readinessMap}
              onViewKeywords={viewKeywords}
              keywordsLoadingMap={keywordsLoadingMap}
            />
          )}

          {/* Empty state after discovery with no jobs */}
          {discoverDone && postings.length === 0 && !discoverError && (
            <div className="rounded-lg border border-dashed border-border-default bg-white p-10 text-center text-[13px] text-text-muted">
              No postings discovered. The board may be empty, or try a different URL.
            </div>
          )}

          {/* Step 5 — Org structure (auto-runs after discovery) */}
          {(orgLoading || orgResult || orgError) && (
            <OrgStructurePanel
              result={orgResult}
              loading={orgLoading}
              error={orgError}
            />
          )}

          {/* Step 6 — Extra context */}
          {discoverDone && (
            <ExtraContextPanel companyName={companyName} />
          )}

          {/* Legacy tools */}
          <div className="mt-2 rounded-lg border border-border-default bg-surface-page p-4">
            <div className="mb-1 text-[11px] font-medium text-text-secondary">Legacy tools (still available)</div>
            <div className="flex gap-4 text-[11px]">
              <a href="/api/jobs/search" className="text-brand-gold hover:underline">Adzuna job board search (API)</a>
              <span className="text-text-muted">·</span>
              <span className="text-text-muted">Scrape careers page — use preflight above with any URL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Full Readiness Modal (Phase 11) */}
      {readinessModal && (
        <ReadinessModal
          posting={readinessModal.posting}
          readiness={readinessModal.readiness}
          onClose={() => setReadinessModal(null)}
        />
      )}

      {/* ATS Keywords Drawer (Phase 8) */}
      {keywordsDrawer && (
        <AtsKeywordsDrawer
          posting={keywordsDrawer.posting}
          result={keywordsDrawer.result}
          onClose={() => setKeywordsDrawer(null)}
        />
      )}
    </div>
  );
}
