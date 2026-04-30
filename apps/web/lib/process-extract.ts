import { AI_MODEL } from './ai';

export interface ExtractedStep {
  step: string;
  rasci: Record<string, 'R' | 'A' | 'S' | 'C' | 'I'>;
  confidence: number; // 0..1
  clarifications?: string[];
  source?: string; // verbatim quote / region from input
}

export interface ExtractedProcess {
  roles: string[];
  steps: ExtractedStep[];
  globalClarifications: string[]; // ambiguities about overall structure
}

const SYSTEM_PROMPT = `You are a process-mapping analyst. Your job is to read a document (a process flow chart, internal procedure, RACI/RASCI table, or department rules) and extract a structured RASCI map.

Output STRICT JSON matching this schema:
{
  "roles": string[],                       // distinct role/team names mentioned (e.g. "HR Manager", "IT Lead")
  "steps": [{
    "step": string,                        // verbatim step text (e.g. "8.2.1 Define data governance policy")
    "rasci": { "<role>": "R"|"A"|"S"|"C"|"I" },
    "confidence": number,                  // 0..1; lower if document was ambiguous
    "clarifications": string[],            // questions to ask user when not 100% sure (empty array if confident)
    "source": string                       // 1-line direct quote / paraphrase from the source identifying this step
  }],
  "globalClarifications": string[]         // questions about overall structure (e.g. "two roles labelled 'Manager' — same person?")
}

Rules:
- ONE Accountable (A) per step. If the doc names two, set confidence < 0.7 and ask a clarification.
- If a role appears with R but no other roles have any letter, that's fine — surface it as a clarification only if it makes the step undefined.
- If the document mixes "RACI" and "RASCI", normalise to RASCI; if "S" (Support) is absent, omit it (don't fabricate).
- Steps must be returned in the order they appear.
- If the document is a flow chart image: each box/swim-lane crossing becomes a step.
- NEVER invent roles or steps not in the source. If a cell is blank, leave it blank.
- Output JSON ONLY. No prose, no markdown fences. Start with { and end with }.`;

export interface ClaudeMessage {
  role: 'user';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | {
            type: 'image';
            source: { type: 'base64'; media_type: string; data: string };
          }
      >;
}

export async function callClaudeForExtraction(messages: ClaudeMessage[]): Promise<string> {
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
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    throw new Error(err.error?.message || `Anthropic API error: ${res.status}`);
  }

  const data = await res.json();
  const content = data.content?.[0];
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response from Claude');
  }
  return content.text;
}

/** Parse the model's JSON output, tolerant of accidental fences */
export function parseExtractionJSON(text: string): ExtractedProcess {
  let trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  // Some models emit a leading sentence. Grab the first { ... } balanced span.
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace > 0) trimmed = trimmed.slice(firstBrace, lastBrace + 1);

  const parsed = JSON.parse(trimmed);

  // Defensive normalisation
  if (!Array.isArray(parsed.roles)) parsed.roles = [];
  if (!Array.isArray(parsed.steps)) parsed.steps = [];
  if (!Array.isArray(parsed.globalClarifications)) parsed.globalClarifications = [];
  for (const s of parsed.steps) {
    if (typeof s.confidence !== 'number') s.confidence = 0.5;
    if (!Array.isArray(s.clarifications)) s.clarifications = [];
    if (!s.rasci || typeof s.rasci !== 'object') s.rasci = {};
    // Filter rasci values to allowed letters
    for (const k of Object.keys(s.rasci)) {
      const v = String(s.rasci[k]).toUpperCase();
      if (!['R', 'A', 'S', 'C', 'I'].includes(v)) delete s.rasci[k];
      else s.rasci[k] = v;
    }
  }
  return parsed as ExtractedProcess;
}
