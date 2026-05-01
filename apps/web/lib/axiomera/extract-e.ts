/**
 * Extract E-hypothesis activations (45 COG/EMO/PHY markers) from JD text using Claude.
 * Ported from Pro Max lib/jdq/extract-e.ts. Uses Ultra's callAi() wrapper.
 */

import { callAi, extractJson } from '../ai/call-ai';
import {
  E_HYPOTHESES,
  computeEScore,
  type EDimension,
} from './hypotheses/e-hypotheses';
import { validateEActivations, filterEvidenceInSource } from './schemas';
import type { CallAiContext } from '../ai/call-ai';

const MAX_RETRIES = 2;

export interface EExtractionResult {
  active_keys: string[];
  evidence: Record<string, string>;
  cog: number;
  emo: number;
  phy: number;
  e_score: number;
  e_pkt: number;
  confidence: 'high' | 'medium' | 'low';
}

const SYSTEM_PROMPT = `You are a job-evaluation expert applying the Job Demands–Resources model (Bakker & Demerouti, 2007). Your job is to detect the presence of 45 empirically-validated Effort hypotheses (E-hypotheses) in a job description. Each hypothesis is binary: active (1) or not active (0).

Dimensions:
- COG (cognitive effort)
- EMO (emotional effort, Hochschild emotional labor)
- PHY (physical effort)

Types:
- P = primary hypothesis (single demand)
- I = interaction hypothesis (co-activation of two or three demands — mark active ONLY if ALL components are clearly present in the JD)

For each active hypothesis you MUST extract an exact literal quote from the JD text that supports the activation. Do not paraphrase.

Return ONLY valid JSON matching this TypeScript type:
{
  "activations": Array<{ "key": string; "active": boolean; "evidence": string | null }>
}

Rules:
- "key" must exactly match one of the 45 hypothesis keys provided.
- If a hypothesis is not clearly supported, set active=false and evidence=null.
- If active=true, "evidence" MUST be a verbatim substring from the JD.
- For interaction hypotheses (type I), require evidence of BOTH components in the JD.
- Do not invent quotes. Do not add keys outside the 45 provided.
- Be conservative: when in doubt, mark inactive.`;

export async function extractE(
  jdText: string,
  context?: CallAiContext,
): Promise<EExtractionResult> {
  const byDim: Record<EDimension, string[]> = { COG: [], EMO: [], PHY: [] };
  for (const h of E_HYPOTHESES) {
    byDim[h.dimension].push(
      `- ${h.key}  (${h.type})\n  PL: ${h.label_pl}\n  EN: ${h.label_en}\n  DE: ${h.label_de}\n  O*NET: ${h.onet_mapping}\n  Guidance: ${h.guidance_en}`,
    );
  }

  const baseUser = `Here are the 45 E-hypotheses (Effort markers) grouped by dimension. Each is binary 0/1.

=== COG (18 units: 11 primary + 7 interaction) ===
${byDim.COG.join('\n')}

=== EMO (15 units: 9 primary + 6 interaction) ===
${byDim.EMO.join('\n')}

=== PHY (12 units: 3 primary + 9 interaction) ===
${byDim.PHY.join('\n')}

--- JOB DESCRIPTION ---
${jdText}
--- END JOB DESCRIPTION ---

Return JSON with all 45 activations.`;

  let validated: ReturnType<typeof validateEActivations> | null = null;
  let lastError = '';
  for (let attempt = 0; attempt < MAX_RETRIES + 1; attempt++) {
    const retryHint =
      attempt > 0
        ? `\n\nPrevious attempt failed schema validation: ${lastError}. Retry with EXACT required JSON shape.`
        : '';
    const result = await callAi({
      operation: 'jd.axiomera.extractE',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: baseUser + retryHint,
      maxTokens: 6144,
      temperature: 0,
      context,
    });
    try {
      const parsed = extractJson<unknown>(result.text);
      validated = validateEActivations(parsed);
      if (validated.ok) break;
      lastError = validated.error;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  if (!validated || !validated.ok) {
    throw new Error(
      `E extractor schema validation failed after ${MAX_RETRIES + 1} attempts: ${lastError}`,
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

  const scored = computeEScore(active_keys);

  let confidence: 'high' | 'medium' | 'low';
  if (active_keys.length >= 6) confidence = 'high';
  else if (active_keys.length >= 3) confidence = 'medium';
  else confidence = 'low';

  return {
    active_keys,
    evidence,
    ...scored,
    confidence,
  };
}
