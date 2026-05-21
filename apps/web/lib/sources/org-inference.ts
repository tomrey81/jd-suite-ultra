/**
 * Org Structure Inference Engine.
 *
 * Builds a draft org graph from normalised job postings.
 * Every node and edge has evidence and confidence — never AI fantasy.
 *
 * Rule: label all output as "Draft org structure inferred from public job-source evidence."
 */

import type { NormalizedJobPosting, OrgStructureSignal } from './types';

// ── Output types ─────────────────────────────────────────────────────────────

export type OrgNodeType = 'company' | 'department' | 'subDepartment' | 'team' | 'jobFamily' | 'role' | 'location';

export interface OrgNode {
  id: string;
  type: OrgNodeType;
  label: string;
  normalizedLabel: string;
  /** 0-100 */
  confidence: number;
  evidence: string[];
  sourceUrls: string[];
  jobCount: number;
}

export interface OrgEdge {
  fromId: string;
  toId: string;
  relationshipType: 'contains' | 'reports_to' | 'co_located' | 'peer';
  confidence: number;
  evidence: string[];
}

export interface OrgConflict {
  signal: string;
  reason: string;
}

export interface OrgInferenceResult {
  disclaimer: string;
  nodes: OrgNode[];
  edges: OrgEdge[];
  unresolvedSignals: OrgStructureSignal[];
  conflicts: OrgConflict[];
  stats: {
    totalPostings: number;
    departments: number;
    teams: number;
    locations: number;
    roles: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalize(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9 &/-]/g, '').replace(/\s+/g, ' ');
}

function nodeId(type: OrgNodeType, label: string): string {
  return `${type}:${normalize(label)}`;
}

const SENIORITY_PATTERNS = [
  { re: /\b(chief|c[- ]?[a-z]{2,3}o|president|founder)\b/i, level: 'C-Suite' },
  { re: /\b(vp|vice president|svp|evp)\b/i, level: 'VP' },
  { re: /\b(director|head of|principal)\b/i, level: 'Director' },
  { re: /\b(senior|sr\.?|lead|staff)\b/i, level: 'Senior' },
  { re: /\b(manager|mgr)\b/i, level: 'Manager' },
  { re: /\b(junior|jr\.?|associate|entry)\b/i, level: 'Junior' },
  { re: /\b(intern|graduate|trainee)\b/i, level: 'Intern' },
];

function inferSeniority(title: string): string | null {
  for (const { re, level } of SENIORITY_PATTERNS) {
    if (re.test(title)) return level;
  }
  return null;
}

function inferWorkingModel(posting: NormalizedJobPosting): string | null {
  if (posting.workingModel) return posting.workingModel;
  const text = `${posting.title} ${posting.descriptionRaw || ''}`.toLowerCase();
  if (/\bremote\b/.test(text)) return 'Remote';
  if (/\bhybrid\b/.test(text)) return 'Hybrid';
  return null;
}

// ── Main inference function ───────────────────────────────────────────────────

export function inferOrgStructure(
  postings: NormalizedJobPosting[],
  signals: OrgStructureSignal[],
): OrgInferenceResult {
  const nodesMap = new Map<string, OrgNode>();
  const edgesMap = new Map<string, OrgEdge>();
  const unresolvedSignals: OrgStructureSignal[] = [];
  const conflicts: OrgConflict[] = [];

  function upsertNode(
    type: OrgNodeType,
    label: string,
    confidence: number,
    evidenceText: string,
    sourceUrl: string,
  ): OrgNode {
    const id = nodeId(type, label);
    if (!nodesMap.has(id)) {
      nodesMap.set(id, {
        id,
        type,
        label: label.trim(),
        normalizedLabel: normalize(label),
        confidence,
        evidence: [evidenceText],
        sourceUrls: [sourceUrl].filter(Boolean),
        jobCount: 1,
      });
    } else {
      const n = nodesMap.get(id)!;
      n.confidence = Math.min(100, Math.round((n.confidence * n.jobCount + confidence) / (n.jobCount + 1)));
      n.jobCount++;
      if (!n.evidence.includes(evidenceText)) n.evidence.push(evidenceText);
      if (sourceUrl && !n.sourceUrls.includes(sourceUrl)) n.sourceUrls.push(sourceUrl);
    }
    return nodesMap.get(id)!;
  }

  function upsertEdge(
    fromId: string,
    toId: string,
    type: OrgEdge['relationshipType'],
    confidence: number,
    evidence: string,
  ) {
    const key = `${fromId}→${toId}:${type}`;
    if (!edgesMap.has(key)) {
      edgesMap.set(key, { fromId, toId, relationshipType: type, confidence, evidence: [evidence] });
    } else {
      const e = edgesMap.get(key)!;
      if (!e.evidence.includes(evidence)) e.evidence.push(evidence);
      e.confidence = Math.min(100, e.confidence + 3);
    }
  }

  // Company node (if companyName known)
  const companyNames = [...new Set(postings.map((p) => p.companyName).filter(Boolean))];
  let companyNodeId: string | null = null;
  if (companyNames.length === 1) {
    const cn = upsertNode('company', companyNames[0]!, 95, 'Company name from source', '');
    companyNodeId = cn.id;
  }

  // Process each posting
  for (const posting of postings) {
    const sourceUrl = posting.canonicalUrl || posting.sourceUrl || '';
    const seniority = inferSeniority(posting.title);

    // Department node
    let deptNode: OrgNode | null = null;
    if (posting.department) {
      deptNode = upsertNode(
        'department',
        posting.department,
        posting.sourceKind?.includes('API') ? 85 : 55,
        `From posting: ${posting.title}`,
        sourceUrl,
      );
      if (companyNodeId) upsertEdge(companyNodeId, deptNode.id, 'contains', 85, 'Company → Department');
    }

    // Team node
    let teamNode: OrgNode | null = null;
    if (posting.team) {
      teamNode = upsertNode(
        'team',
        posting.team,
        posting.sourceKind?.includes('API') ? 82 : 48,
        `From posting: ${posting.title}`,
        sourceUrl,
      );
      if (deptNode) upsertEdge(deptNode.id, teamNode.id, 'contains', 78, 'Department → Team');
      else if (companyNodeId) upsertEdge(companyNodeId, teamNode.id, 'contains', 60, 'Company → Team (dept unknown)');
    }

    // Job family node
    if (posting.jobFamily) {
      const jfNode = upsertNode('jobFamily', posting.jobFamily, 65, `Job family from posting: ${posting.title}`, sourceUrl);
      if (deptNode) upsertEdge(deptNode.id, jfNode.id, 'contains', 60, 'Department → Job Family');
    }

    // Location node
    if (posting.location) {
      const locNode = upsertNode('location', posting.location, 75, `Location from posting: ${posting.title}`, sourceUrl);
      if (deptNode) upsertEdge(deptNode.id, locNode.id, 'co_located', 55, 'Department has location');
    }

    // Role node
    const roleLabel = `${posting.title}${seniority ? ` (${seniority})` : ''}`;
    const roleNode = upsertNode(
      'role',
      roleLabel,
      posting.sourceKind?.includes('API') ? 78 : 45,
      `Posting: ${posting.canonicalUrl || posting.title}`,
      sourceUrl,
    );
    const parentNode = teamNode || deptNode;
    if (parentNode) upsertEdge(parentNode.id, roleNode.id, 'contains', 72, 'Team/Dept → Role');
    else if (companyNodeId) upsertEdge(companyNodeId, roleNode.id, 'contains', 40, 'Company → Role (no dept)');

    // Flag unresolved (no dept, no team, no location)
    if (!posting.department && !posting.team && !posting.location) {
      unresolvedSignals.push({
        companyName: posting.companyName || '',
        department: null,
        subDepartment: null,
        team: null,
        location: null,
        jobFamily: null,
        title: posting.title,
        seniority,
        possibleReportsTo: null,
        possibleManagerTitle: null,
        evidenceText: 'No department, team, or location signals available',
        evidenceUrl: sourceUrl,
        confidenceScore: 20,
      });
    }
  }

  // Process explicit OrgStructureSignals (higher-quality signals from connectors)
  for (const sig of signals) {
    if (!sig.department && !sig.team) {
      unresolvedSignals.push(sig);
      continue;
    }
    if (sig.department) {
      const deptNode = upsertNode('department', sig.department, sig.confidenceScore, sig.evidenceText, sig.evidenceUrl || '');
      if (companyNodeId) upsertEdge(companyNodeId, deptNode.id, 'contains', sig.confidenceScore, sig.evidenceText);
      if (sig.team) {
        const teamNode = upsertNode('team', sig.team, sig.confidenceScore, sig.evidenceText, sig.evidenceUrl || '');
        upsertEdge(deptNode.id, teamNode.id, 'contains', sig.confidenceScore, sig.evidenceText);
      }
    }
  }

  // Detect conflicts: same normalised label with different types
  const labelToTypes = new Map<string, Set<OrgNodeType>>();
  for (const node of nodesMap.values()) {
    if (!labelToTypes.has(node.normalizedLabel)) labelToTypes.set(node.normalizedLabel, new Set());
    labelToTypes.get(node.normalizedLabel)!.add(node.type);
  }
  for (const [label, types] of labelToTypes) {
    if (types.size > 1) {
      conflicts.push({
        signal: label,
        reason: `Label "${label}" appears as multiple node types: ${[...types].join(', ')}`,
      });
    }
  }

  const nodes = [...nodesMap.values()].sort((a, b) => b.confidence - a.confidence);
  const edges = [...edgesMap.values()];

  const depts = nodes.filter((n) => n.type === 'department').length;
  const teams = nodes.filter((n) => n.type === 'team').length;
  const locs = nodes.filter((n) => n.type === 'location').length;
  const roles = nodes.filter((n) => n.type === 'role').length;

  return {
    disclaimer: 'Draft org structure inferred from public job-source evidence. Not validated. Every node shows evidence and confidence. Do not present as fact.',
    nodes,
    edges,
    unresolvedSignals,
    conflicts,
    stats: {
      totalPostings: postings.length,
      departments: depts,
      teams,
      locations: locs,
      roles,
    },
  };
}
