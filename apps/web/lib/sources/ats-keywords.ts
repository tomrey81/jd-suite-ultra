/**
 * ATS Keyword Analysis — Phase 8.
 *
 * Extracts and analyses keywords from a normalised job posting.
 * Lawful: reads only the job posting text itself. No ATS internal algorithm access.
 * Does not keyword-stuff, manipulate, or claim hidden weights.
 */

export interface KeywordEntry {
  keyword: string;
  category: 'hard_skill' | 'tool' | 'certification' | 'methodology' | 'soft_skill' | 'industry' | 'qualification';
  frequency: number;
  isLikelyKnockout: boolean;
  evidence: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AtsKeywordAnalysis {
  disclaimer: string;
  criticalKeywords: KeywordEntry[];
  supportingKeywords: KeywordEntry[];
  likelyKnockoutCriteria: string[];
  missingCommonKeywords: string[];
  warningFlags: string[];
}

// ── Taxonomy dictionaries ────────────────────────────────────────────────────

const TOOL_PATTERNS = [
  /\b(excel|powerpoint|word|office 365|google workspace|gsuite|tableau|power bi|looker|dbt|airflow|spark|databricks|snowflake|redshift|bigquery|salesforce|sap|workday|successfactors|oracle|jira|confluence|notion|asana|monday\.com|slack|teams|zoom)\b/gi,
];

const CERT_PATTERNS = [
  /\b(pmp|prince2|cpa|cfa|frm|cissp|cism|aws certified|gcp certified|azure certified|google cloud|six sigma|lean|scrum master|psm|csm|safe|togaf|itil)\b/gi,
];

const METHODOLOGY_PATTERNS = [
  /\b(agile|scrum|kanban|waterfall|devops|ci\/cd|tdd|bdd|oop|rest|graphql|microservices|soa|lean startup|okr|kpi|balanced scorecard)\b/gi,
];

const SOFT_SKILL_PATTERNS = [
  /\b(leadership|communication|collaboration|stakeholder management|influencing|problem.solving|analytical|strategic thinking|cross.functional|mentoring|coaching|negotiation|presentation)\b/gi,
];

const QUALIFICATION_PATTERNS = [
  /\b(\d+[\+]?\s*years?.*experience|bachelor['s]*|master['s]*|mba|phd|degree in|qualified|chartered|licensed)\b/gi,
];

const KNOCKOUT_PHRASES = [
  /must have\b/gi,
  /required[:\s]/gi,
  /mandatory[:\s]/gi,
  /essential[:\s]/gi,
  /\bminimum\b.*\byear/gi,
  /right to work/gi,
  /eligible to work/gi,
  /security clearance/gi,
];

// ── Extraction helpers ────────────────────────────────────────────────────────

function extractMatches(text: string, patterns: RegExp[]): string[] {
  const found: string[] = [];
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const m of matches) {
      const kw = m[0].toLowerCase().trim();
      if (!found.includes(kw)) found.push(kw);
    }
  }
  return found;
}

function countFrequency(text: string, keyword: string): number {
  return (text.toLowerCase().match(new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')) || []).length;
}

function isInKnockoutContext(text: string, keyword: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerKw = keyword.toLowerCase();
  const idx = lowerText.indexOf(lowerKw);
  if (idx < 0) return false;
  const surrounding = lowerText.slice(Math.max(0, idx - 100), idx + 100);
  return KNOCKOUT_PHRASES.some((re) => re.test(surrounding));
}

// ── Sentence extraction for evidence ─────────────────────────────────────────

function findEvidence(text: string, keyword: string): string {
  const sentences = text.split(/[.\n!?]+/);
  const found = sentences.find((s) => s.toLowerCase().includes(keyword.toLowerCase()));
  return found ? found.trim().slice(0, 120) : '';
}

// ── Main function ─────────────────────────────────────────────────────────────

export function analyseAtsKeywords(
  title: string,
  descriptionRaw: string,
  jobFamily?: string | null,
): AtsKeywordAnalysis {
  const fullText = `${title}\n${descriptionRaw}`;

  const tools = extractMatches(fullText, TOOL_PATTERNS).map((kw): KeywordEntry => ({
    keyword: kw,
    category: 'tool',
    frequency: countFrequency(fullText, kw),
    isLikelyKnockout: isInKnockoutContext(fullText, kw),
    evidence: findEvidence(fullText, kw),
    confidence: 'HIGH',
  }));

  const certs = extractMatches(fullText, CERT_PATTERNS).map((kw): KeywordEntry => ({
    keyword: kw,
    category: 'certification',
    frequency: countFrequency(fullText, kw),
    isLikelyKnockout: isInKnockoutContext(fullText, kw),
    evidence: findEvidence(fullText, kw),
    confidence: 'HIGH',
  }));

  const methods = extractMatches(fullText, METHODOLOGY_PATTERNS).map((kw): KeywordEntry => ({
    keyword: kw,
    category: 'methodology',
    frequency: countFrequency(fullText, kw),
    isLikelyKnockout: isInKnockoutContext(fullText, kw),
    evidence: findEvidence(fullText, kw),
    confidence: 'MEDIUM',
  }));

  const softSkills = extractMatches(fullText, SOFT_SKILL_PATTERNS).map((kw): KeywordEntry => ({
    keyword: kw,
    category: 'soft_skill',
    frequency: countFrequency(fullText, kw),
    isLikelyKnockout: false,
    evidence: findEvidence(fullText, kw),
    confidence: 'MEDIUM',
  }));

  const qualifications = extractMatches(fullText, QUALIFICATION_PATTERNS).map((kw): KeywordEntry => ({
    keyword: kw,
    category: 'qualification',
    frequency: countFrequency(fullText, kw),
    isLikelyKnockout: true, // qualifications are commonly knockout
    evidence: findEvidence(fullText, kw),
    confidence: 'HIGH',
  }));

  const all: KeywordEntry[] = [...tools, ...certs, ...methods, ...softSkills, ...qualifications]
    .sort((a, b) => b.frequency - a.frequency);

  const criticalKeywords = all.filter((k) => k.isLikelyKnockout || k.frequency >= 2);
  const supportingKeywords = all.filter((k) => !k.isLikelyKnockout && k.frequency < 2);
  const likelyKnockoutCriteria = all.filter((k) => k.isLikelyKnockout).map((k) => k.evidence || k.keyword);

  // Warning flags
  const warningFlags: string[] = [];
  if (descriptionRaw.length < 300) {
    warningFlags.push('Description is very short — keyword analysis may be incomplete.');
  }
  if (criticalKeywords.length === 0) {
    warningFlags.push('No clear knockout criteria detected — requirements may be implicit.');
  }
  if (qualifications.length === 0) {
    warningFlags.push('No explicit qualification requirements found — may use internal criteria.');
  }

  // Missing common keywords by job family
  const missingCommonKeywords: string[] = [];
  if (jobFamily) {
    const jf = jobFamily.toLowerCase();
    if ((jf.includes('data') || jf.includes('analyst')) && !tools.find((t) => /excel|tableau|power bi|sql/.test(t.keyword))) {
      missingCommonKeywords.push('Common data tools (SQL, Excel, Tableau) not mentioned — may be implicit requirements');
    }
    if (jf.includes('engineer') && !tools.find((t) => /git|ci|devops/.test(t.keyword))) {
      missingCommonKeywords.push('Engineering tools (Git, CI/CD) not mentioned');
    }
    if (jf.includes('finance') && !certs.find((c) => /cpa|cfa|acca/.test(c.keyword))) {
      missingCommonKeywords.push('Finance qualifications (CPA, CFA, ACCA) not explicitly stated');
    }
  }

  return {
    disclaimer: 'Keyword analysis reads only the job posting text. JD Suite does not have access to internal ATS ranking algorithms or screening weights. Do not keyword-stuff.',
    criticalKeywords,
    supportingKeywords,
    likelyKnockoutCriteria,
    missingCommonKeywords,
    warningFlags,
  };
}
