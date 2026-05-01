/**
 * Extract R-hypothesis activations (19 binary markers) from JD text using Claude.
 * Ported from Pro Max lib/jdq/extract-r.ts. Uses Ultra's callAi() wrapper for
 * cost logging.
 */

import { callAi, extractJson } from '../ai/call-ai';
import {
  R_HYPOTHESES,
  computeRLevel,
  computeWeightedZone,
  detectContradictions,
  rZoneToPoints,
} from './hypotheses/r-hypotheses';
import { validateRActivations, filterEvidenceInSource } from './schemas';
import type { CallAiContext } from '../ai/call-ai';

const MAX_RETRIES = 2;

export interface RExtractionResult {
  active_keys: string[];
  evidence: Record<string, string>;
  r_level_mean: number;
  weighted_zone: number;
  rounded_zone: number;
  r_points: number;
  contradictions: string[];
  confidence: 'high' | 'medium' | 'low';
}

const SYSTEM_PROMPT = `You are a job-evaluation expert. Your job is to detect the presence of 19 empirically-validated Responsibility hypotheses (R-hypotheses) in a job description. Each hypothesis is binary: active (1) or not active (0).

For each active hypothesis you MUST extract an exact literal quote from the JD text that supports the activation. Do not paraphrase.

Return ONLY valid JSON matching this TypeScript type:
{
  "activations": Array<{ "key": string; "active": boolean; "evidence": string | null }>
}

Rules:
- "key" must exactly match one of the 19 hypothesis keys provided.
- If a hypothesis is not clearly supported, set active=false and evidence=null.
- If active=true, "evidence" MUST be a verbatim substring from the JD.
- Do not invent quotes. Do not add keys outside the 19 provided.
- Be conservative: when in doubt, mark inactive.`;

export async function extractR(
  jdText: string,
  context?: CallAiContext,
): Promise<RExtractionResult> {
  const hypothesisList = R_HYPOTHESES.map(
    (h) =>
      `- ${h.key}  (level ${h.level})\n  PL: ${h.label_pl}\n  EN: ${h.label_en}\n  DE: ${h.label_de}\n  Guidance: ${h.guidance_en}`,
  ).join('\n');

  const baseUser = `Here are the 19 R-hypotheses (Responsibility markers) — each is binary 0/1:

${hypothesisList}

--- JOB DESCRIPTION ---
${jdText}
--- END JOB DESCRIPTION ---

Return JSON with all 19 activations.`;

  let validated: ReturnType<typeof validateRActivations> | null = null;
  let lastError = '';
  for (let attempt = 0; attempt < MAX_RETRIES + 1; attempt++) {
    const retryHint =
      attempt > 0
        ? `\n\nPrevious attempt failed schema validation: ${lastError}. Retry and output EXACTLY the required JSON shape.`
        : '';
    const result = await callAi({
      operation: 'jd.axiomera.extractR',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: baseUser + retryHint,
      maxTokens: 4096,
      temperature: 0,
      context,
    });
    try {
      const parsed = extractJson<unknown>(result.text);
      validated = validateRActivations(parsed);
      if (validated.ok) break;
      lastError = validated.error;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  if (!validated || !validated.ok) {
    throw new Error(
      `R extractor schema validation failed after ${MAX_RETRIES + 1} attempts: ${lastError}`,
    );
  }

  const verified = filterEvidenceInSource(validated.value.activations, jdText);

  const evidence: Record<string, string> = {};
  const active_keys: string[] = [];
  for (const a of verified) {
    if (a.active && a.evidence) {
      active_keys.push(a.key);
      evidence[a.key] = a.evidence;
    }
  }

  const r_level_mean = computeRLevel(active_keys);
  const weighted_zone = computeWeightedZone(active_keys);
  const rounded_zone = Math.max(1, Math.min(9, Math.round(weighted_zone)));
  const contradictions = detectContradictions(active_keys);

  let confidence: 'high' | 'medium' | 'low';
  if (active_keys.length >= 4 && contradictions.length === 0) confidence = 'high';
  else if (active_keys.length >= 2) confidence = 'medium';
  else confidence = 'low';

  return {
    active_keys,
    evidence,
    r_level_mean,
    weighted_zone,
    rounded_zone,
    r_points: rZoneToPoints(rounded_zone),
    contradictions,
    confidence,
  };
}
