/**
 * Layout-aware org-chart extractor.
 *
 * STRATEGY:
 *   pdf-parse alone gives us a flat token bag — useless for visual hierarchy.
 *   Instead we render each PDF page to PNG (in the browser, using pdfjs-dist)
 *   and send the IMAGE to Claude Sonnet 4.5 vision with a strict-JSON system
 *   prompt that names the node taxonomy and demands per-edge confidence.
 *
 *   The browser-side rendering keeps the API route tiny and Vercel-friendly
 *   (no native canvas binary in the function runtime). The server only handles:
 *   the Anthropic call + JSON validation.
 *
 *   For tests, we accept pre-rendered base64 PNGs directly so the test fixture
 *   doesn't need a real browser environment.
 */

import { z } from 'zod';
import { AI_MODEL } from '@/lib/ai';
import type { OrgChart, OrgNode, OrgNodeType, ReportingLine } from './types';

// ─── Vision system prompt ──────────────────────────────────────────────────

export const ORG_CHART_VISION_PROMPT = `You are an expert at reading visual organisational charts. The user will give you one or more page images of an org chart. Your job is to extract the FULL hierarchical structure as STRICT JSON.

CRITICAL RULES — read the chart, not your imagination:
1. Use the visual chart as the ground truth. Boxes, connector lines, dashed groupings, and column headers are the source of authority. Text proximity alone is NOT enough.
2. Preserve ALL printed abbreviation codes EXACTLY (e.g. DKLK, BHP, CWIR, BAML). Do not normalise capitalisation.
3. Preserve Polish characters exactly: ą ć ę ł ń ó ś ź ż.
4. Distinguish node types using the document's printed labels:
   - "Prezes Zarządu"            → PRESIDENT
   - "Wiceprezes Zarządu …"      → VICE_PRESIDENT
   - "Członek Zarządu"           → BOARD_MEMBER
   - "PION …" (uppercase header) → PION
   - "Departament …"             → DEPARTMENT
   - "Biuro …"                   → OFFICE
   - "Oddział …"                 → BRANCH
5. Pions are GROUPING containers. Their children are the boxes drawn inside or directly below their header. Do NOT flatten pion children up to the executive that owns the pion.
6. NEVER invent nodes that are not in the chart. NEVER omit small boxes.
7. NEVER guess a parent if the connector is unclear. Set confidence < 0.85 and add a clarification.
8. If a box has a dashed border or dashed connector, set reportingLine to "DOTTED" and confidence ≤ 0.8.
9. Every node MUST appear exactly once.
10. Output STRICT JSON only — no prose, no markdown fences, no comments.

OUTPUT SCHEMA:
{
  "companyName": string | null,
  "effectiveDate": string | null,    // ISO yyyy-mm-dd if printed
  "documentReference": string | null,
  "nodes": [
    {
      "code": string | null,         // abbreviation as printed, or null for executives/pions
      "name": string,                // full printed name including diacritics
      "type": "PRESIDENT" | "VICE_PRESIDENT" | "BOARD_MEMBER" | "PION" | "DEPARTMENT" | "OFFICE" | "BRANCH" | "TEAM",
      "parentName": string | null,   // parent's NAME (or code if executive has no name) — must match another node exactly
      "reportingLine": "SOLID" | "DOTTED" | "VISUAL_GROUPING",
      "confidence": number,          // 0..1, how sure you are of THIS node's parent link
      "evidence": string             // one-sentence visual evidence ("connector from BHP up to PION WSPARCIA header box")
    }
  ],
  "clarifications": string[]         // open questions for the human reviewer
}

Read the chart carefully. Take your time. Cross-check every parent link against the visual connectors.`;

// ─── Zod schema for validating Claude's response ───────────────────────────

const NODE_TYPES = ['PRESIDENT', 'VICE_PRESIDENT', 'BOARD_MEMBER', 'PION', 'DEPARTMENT', 'OFFICE', 'BRANCH', 'TEAM'] as const;
const REPORTING_LINES = ['SOLID', 'DOTTED', 'VISUAL_GROUPING'] as const;

const VisionNodeSchema = z.object({
  code: z.string().nullable(),
  name: z.string().min(1),
  type: z.enum(NODE_TYPES),
  parentName: z.string().nullable(),
  reportingLine: z.enum(REPORTING_LINES),
  confidence: z.number().min(0).max(1),
  evidence: z.string(),
});

const VisionResponseSchema = z.object({
  companyName: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  documentReference: z.string().nullable(),
  nodes: z.array(VisionNodeSchema).min(1),
  clarifications: z.array(z.string()),
});

export type VisionNode = z.infer<typeof VisionNodeSchema>;
export type VisionResponse = z.infer<typeof VisionResponseSchema>;

// ─── Anthropic vision call ─────────────────────────────────────────────────

export interface PageImage {
  /** Base64-encoded PNG data (no data: prefix). */
  dataB64: string;
  /** 1-based page number from the source document. */
  pageNumber: number;
}

export interface ExtractOptions {
  pages: PageImage[];
  /** Override the default model (sonnet 4.5 by default). */
  model?: string;
  /** Apify-style guard so a malformed PDF can't burn budget. */
  maxTokens?: number;
}

export async function extractOrgChartFromImages(opts: ExtractOptions): Promise<VisionResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  if (!opts.pages.length) throw new Error('No page images provided');

  const content: Array<
    | { type: 'image'; source: { type: 'base64'; media_type: 'image/png'; data: string } }
    | { type: 'text'; text: string }
  > = [];

  for (const p of opts.pages) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: p.dataB64 },
    });
    content.push({ type: 'text', text: `[Above is page ${p.pageNumber} of the source document.]` });
  }
  content.push({
    type: 'text',
    text: 'Extract the full org structure as STRICT JSON per the system prompt. JSON only — no prose, no markdown fences.',
  });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: opts.model || AI_MODEL,
      max_tokens: opts.maxTokens ?? 8000,
      system: ORG_CHART_VISION_PROMPT,
      messages: [{ role: 'user', content }],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as { error?: { message?: string } }).error?.message || `Anthropic ${res.status}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const raw = data.content?.[0]?.text ?? '';
  const parsed = parseStrictJSON(raw);
  return VisionResponseSchema.parse(parsed);
}

function parseStrictJSON(text: string): unknown {
  let t = text.trim();
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

// ─── Convert vision response → OrgChart graph ──────────────────────────────

function slugify(s: string, fallback: string): string {
  const base = s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || fallback;
}

/**
 * Resolve a vision response into a fully-linked OrgChart with ids and levels.
 * Parents are matched by NAME (case-insensitive, whitespace-collapsed).
 */
export function visionResponseToOrgChart(
  resp: VisionResponse,
  meta: { sourceFile: string; chartId: string },
): OrgChart {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  // Pre-assign ids and a name→id map
  const idByName = new Map<string, string>();
  const usedSlugs = new Set<string>();
  const intermediate = resp.nodes.map((n, idx) => {
    let slug = slugify(n.code || n.name, `n${idx}`);
    let candidate = slug;
    let i = 2;
    while (usedSlugs.has(candidate)) candidate = `${slug}-${i++}`;
    usedSlugs.add(candidate);
    idByName.set(norm(n.name), candidate);
    return { node: n, id: candidate };
  });

  // Build OrgNodes with parent ids resolved
  const nodes: OrgNode[] = intermediate.map(({ node, id }) => {
    const parentId = node.parentName ? idByName.get(norm(node.parentName)) ?? null : null;
    return {
      id,
      parentId,
      code: node.code,
      name: node.name,
      type: node.type as OrgNodeType,
      level: 0, // computed below
      sourcePage: null,
      reportingLine: node.reportingLine as ReportingLine,
      confidence: parentId === null && node.parentName !== null ? Math.min(node.confidence, 0.5) : node.confidence,
      evidence: node.evidence || null,
      manuallyEdited: false,
    };
  });

  // Compute levels via BFS from the root(s)
  const childrenByParent = new Map<string | null, string[]>();
  for (const n of nodes) {
    const list = childrenByParent.get(n.parentId) ?? [];
    list.push(n.id);
    childrenByParent.set(n.parentId, list);
  }
  const queue: Array<{ id: string; level: number }> = (childrenByParent.get(null) || []).map((id) => ({ id, level: 0 }));
  const seen = new Set<string>();
  while (queue.length) {
    const { id, level } = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const n = nodes.find((x) => x.id === id);
    if (n) n.level = level;
    for (const childId of childrenByParent.get(id) || []) {
      queue.push({ id: childId, level: level + 1 });
    }
  }

  const avgConfidence =
    nodes.length === 0 ? 0 : nodes.reduce((s, n) => s + n.confidence, 0) / nodes.length;

  return {
    id: meta.chartId,
    name: resp.companyName ? `${resp.companyName} — Org structure` : meta.sourceFile,
    sourceFile: meta.sourceFile,
    effectiveDate: resp.effectiveDate,
    documentReference: resp.documentReference,
    companyName: resp.companyName,
    extractionConfidence: avgConfidence,
    nodes,
    clarifications: resp.clarifications,
    extractedAt: new Date().toISOString(),
  };
}

// ─── Acceptance scoring (used by tests + the review UI) ────────────────────

import type { GroundTruthNode } from './types';

export interface ExtractionScore {
  /** % of ground-truth nodes the extraction returned */
  recall: number;
  /** % of returned nodes that match a ground-truth entry */
  precision: number;
  /** % of returned nodes whose parent link matches ground truth */
  parentAccuracy: number;
  /** Nodes present in extraction but not in ground truth */
  spurious: string[];
  /** Nodes present in ground truth but missing from extraction */
  missing: string[];
  /** Nodes whose parent doesn't match ground truth */
  wrongParents: Array<{ name: string; expected: string | null; actual: string | null }>;
}

const normName = (s: string | null | undefined) =>
  (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

export function scoreExtraction(extracted: OrgChart, truth: GroundTruthNode[]): ExtractionScore {
  // Index extracted by name + by code
  const exByName = new Map<string, OrgNode>();
  const exByCode = new Map<string, OrgNode>();
  for (const n of extracted.nodes) {
    exByName.set(normName(n.name), n);
    if (n.code) exByCode.set(n.code, n);
  }
  // Same for truth
  const truthByName = new Map<string, GroundTruthNode>();
  const truthByCode = new Map<string, GroundTruthNode>();
  for (const t of truth) {
    truthByName.set(normName(t.name), t);
    if (t.code) truthByCode.set(t.code, t);
  }

  // Recall + missing
  const missing: string[] = [];
  let matched = 0;
  for (const t of truth) {
    const m = (t.code && exByCode.get(t.code)) || exByName.get(normName(t.name));
    if (m) matched++;
    else missing.push(t.code ? `${t.code} — ${t.name}` : t.name);
  }
  const recall = truth.length === 0 ? 0 : matched / truth.length;

  // Precision + spurious
  const spurious: string[] = [];
  let validCount = 0;
  for (const n of extracted.nodes) {
    const t = (n.code && truthByCode.get(n.code)) || truthByName.get(normName(n.name));
    if (t) validCount++;
    else spurious.push(n.code ? `${n.code} — ${n.name}` : n.name);
  }
  const precision = extracted.nodes.length === 0 ? 0 : validCount / extracted.nodes.length;

  // Parent accuracy — only over nodes that match truth
  const wrongParents: Array<{ name: string; expected: string | null; actual: string | null }> = [];
  let correctParents = 0;
  let consideredParents = 0;
  for (const n of extracted.nodes) {
    const t = (n.code && truthByCode.get(n.code)) || truthByName.get(normName(n.name));
    if (!t) continue;
    consideredParents++;

    const expectedParent = t.parentCode
      ? truthByCode.get(t.parentCode)?.name ?? t.parentCode
      : null;
    const actualParent = n.parentId
      ? extracted.nodes.find((x) => x.id === n.parentId)?.name ?? null
      : null;

    const expectedNorm = normName(expectedParent || '');
    const actualNorm = normName(actualParent || '');

    if (expectedNorm === actualNorm) correctParents++;
    else wrongParents.push({ name: n.name, expected: expectedParent, actual: actualParent });
  }
  const parentAccuracy = consideredParents === 0 ? 0 : correctParents / consideredParents;

  return { recall, precision, parentAccuracy, missing, spurious, wrongParents };
}
