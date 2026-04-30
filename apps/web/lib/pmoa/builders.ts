// PMOA AI builders. Take corpus of parsed documents (tagged 'recent' or
// 'partially_valid'), run Claude to extract structured org / process data.
//
// Each builder is a single Claude call returning STRICT JSON. Output is
// then persisted by the calling API route — builders themselves do no DB I/O.

import { AI_MODEL } from '@/lib/ai';

export interface BuiltPosition {
  name: string;
  positionNumber: string | null;
  reportsTo: string | null;       // matches another BuiltPosition.name
  department: string | null;
  currentHolderName: string | null;
  vacancy: boolean;
  spanOfControl: number;
  sourceDocumentIds: string[];
  notes: string | null;
}

export interface BuiltDepartment {
  name: string;
  parent: string | null;
  headPositionName: string | null;
  sourceDocumentIds: string[];
}

export interface BuiltAssignment {
  positionName: string;
  personName: string;
  kind: 'permanent' | 'acting' | 'split';
  splitWithPosition: string | null;
  splitPct: number | null;
}

export interface OrgBuildResult {
  departments: BuiltDepartment[];
  positions: BuiltPosition[];
  assignments: BuiltAssignment[];
  globalClarifications: string[];
}

export interface BuiltProcessStep {
  stepOrder: number;
  name: string;
  kind: 'task' | 'decision' | 'handoff' | 'event';
  actorRoleName: string | null;     // free text — caller resolves to position
  slaDescription: string | null;
  sourceDocumentId: string | null;
  sourcePage: number | null;
}

export interface BuiltProcess {
  name: string;
  description: string | null;
  ownerRoleName: string | null;
  sourceDocumentIds: string[];
  steps: BuiltProcessStep[];
}

export interface ProcessBuildResult {
  processes: BuiltProcess[];
  globalClarifications: string[];
}

// ── Org builder ────────────────────────────────────────────────────────────

const ORG_SYSTEM_PROMPT = `You are an organisation analyst. The user has uploaded HR documents (HRIS rosters, org charts, regulations). Extract a unified org graph.

Output STRICT JSON only:
{
  "departments": [{ "name": string, "parent": string|null, "headPositionName": string|null, "sourceDocumentIds": string[] }],
  "positions": [{
    "name": string,
    "positionNumber": string|null,
    "reportsTo": string|null,
    "department": string|null,
    "currentHolderName": string|null,
    "vacancy": boolean,
    "spanOfControl": number,
    "sourceDocumentIds": string[],
    "notes": string|null
  }],
  "assignments": [{
    "positionName": string,
    "personName": string,
    "kind": "permanent"|"acting"|"split",
    "splitWithPosition": string|null,
    "splitPct": number|null
  }],
  "globalClarifications": string[]
}

Rules:
- Position names must be canonical (deduplicate spelling variants).
- "reportsTo" must reference another position's "name" exactly, or null for top of tree.
- spanOfControl = count of direct reports (positions whose reportsTo equals this position's name).
- A position can be vacant. "currentHolderName" should be null in that case.
- For acting roles, create one assignment with kind="acting" + the temporary holder.
- For split assignments, create TWO assignments — one per position, each pointing at the other via splitWithPosition + splitPct.
- NEVER invent positions not in the source. If a document mentions a person but no position, omit them.
- globalClarifications: questions you'd ask the user about ambiguous structures.
- Output JSON only — no prose, no markdown fences.`;

const PROCESS_SYSTEM_PROMPT = `You are a process analyst. The user has uploaded SOPs, regulations, and BPMN/flowchart files. Extract structured business processes.

Output STRICT JSON only:
{
  "processes": [{
    "name": string,
    "description": string|null,
    "ownerRoleName": string|null,
    "sourceDocumentIds": string[],
    "steps": [{
      "stepOrder": number,
      "name": string,
      "kind": "task"|"decision"|"handoff"|"event",
      "actorRoleName": string|null,
      "slaDescription": string|null,
      "sourceDocumentId": string|null,
      "sourcePage": number|null
    }]
  }],
  "globalClarifications": string[]
}

Rules:
- Each process is a coherent business workflow (e.g. "New hire onboarding", "Purchase order approval").
- Steps must be in execution order via stepOrder (0, 1, 2, …).
- kind: "task" = action; "decision" = gateway/branch; "handoff" = role-to-role transfer; "event" = start/end/timer.
- actorRoleName: free text matching how the document refers to the role (we resolve to formal positions later).
- NEVER invent steps. If a doc lists 5 steps, return 5 steps.
- globalClarifications: questions about ambiguous flows.
- Output JSON only — no prose, no markdown fences.`;

async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 4000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error?.message || `Anthropic ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

function parseStrictJSON(text: string): unknown {
  let t = text.trim();
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

interface CorpusEntry { id: string; name: string; rawText: string; }

export async function buildOrgFromCorpus(corpus: CorpusEntry[]): Promise<OrgBuildResult> {
  const message = formatCorpus(corpus);
  const raw = await callClaude(ORG_SYSTEM_PROMPT, message, 6000);
  const parsed = parseStrictJSON(raw) as OrgBuildResult;
  // Defensive normalisation
  if (!Array.isArray(parsed.departments)) parsed.departments = [];
  if (!Array.isArray(parsed.positions)) parsed.positions = [];
  if (!Array.isArray(parsed.assignments)) parsed.assignments = [];
  if (!Array.isArray(parsed.globalClarifications)) parsed.globalClarifications = [];
  return parsed;
}

export async function buildProcessesFromCorpus(corpus: CorpusEntry[]): Promise<ProcessBuildResult> {
  const message = formatCorpus(corpus);
  const raw = await callClaude(PROCESS_SYSTEM_PROMPT, message, 6000);
  const parsed = parseStrictJSON(raw) as ProcessBuildResult;
  if (!Array.isArray(parsed.processes)) parsed.processes = [];
  if (!Array.isArray(parsed.globalClarifications)) parsed.globalClarifications = [];
  for (const p of parsed.processes) {
    if (!Array.isArray(p.steps)) p.steps = [];
    if (!Array.isArray(p.sourceDocumentIds)) p.sourceDocumentIds = [];
  }
  return parsed;
}

function formatCorpus(corpus: CorpusEntry[]): string {
  // Cap each doc + total length to keep within token budget.
  const PER_DOC_CAP = 8_000;
  const TOTAL_CAP = 100_000;
  let totalUsed = 0;
  const blocks: string[] = [];
  for (const d of corpus) {
    if (totalUsed >= TOTAL_CAP) break;
    const text = d.rawText.slice(0, PER_DOC_CAP);
    const block = `=== Document id=${d.id} name="${d.name}" ===\n${text}\n`;
    if (totalUsed + block.length > TOTAL_CAP) break;
    blocks.push(block);
    totalUsed += block.length;
  }
  return `Below are ${blocks.length} parsed documents. Extract the structured map per the system prompt.\n\n${blocks.join('\n')}`;
}
