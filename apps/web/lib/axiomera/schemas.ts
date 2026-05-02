/**
 * Strict schema validators for LLM extraction output.
 * No numeric scoring happens inside LLM output — only boolean activations
 * and literal evidence quotes. All numbers come from deterministic rules.
 */

import { R_HYPOTHESES } from './hypotheses/r-hypotheses';
import { E_HYPOTHESES } from './hypotheses/e-hypotheses';

export interface ActivationItem {
  key: string;
  active: boolean;
  evidence: string | null;
}

export interface ActivationPayload {
  activations: ActivationItem[];
}

const R_KEYS: Set<string> = new Set(R_HYPOTHESES.map((h) => h.key));
const E_KEYS: Set<string> = new Set(E_HYPOTHESES.map((h) => h.key));

export function validateRActivations(raw: unknown): { ok: true; value: ActivationPayload } | { ok: false; error: string } {
  return validateActivations(raw, R_KEYS, 'R');
}
export function validateEActivations(raw: unknown): { ok: true; value: ActivationPayload } | { ok: false; error: string } {
  return validateActivations(raw, E_KEYS, 'E');
}

function validateActivations(
  raw: unknown,
  validKeys: Set<string>,
  engine: 'R' | 'E',
): { ok: true; value: ActivationPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: `${engine}: not an object` };
  const act = (raw as Record<string, unknown>).activations;
  if (!Array.isArray(act)) return { ok: false, error: `${engine}: activations is not an array` };
  const seen = new Set<string>();
  const out: ActivationItem[] = [];
  for (const item of act) {
    if (!item || typeof item !== 'object') return { ok: false, error: `${engine}: activation item not object` };
    const i = item as Record<string, unknown>;
    if (typeof i.key !== 'string') return { ok: false, error: `${engine}: missing key` };
    if (!validKeys.has(i.key)) return { ok: false, error: `${engine}: unknown hypothesis key "${i.key}"` };
    if (seen.has(i.key)) return { ok: false, error: `${engine}: duplicate key "${i.key}"` };
    seen.add(i.key);
    if (typeof i.active !== 'boolean') return { ok: false, error: `${engine}: active not boolean for "${i.key}"` };
    if (i.evidence !== null && typeof i.evidence !== 'string') {
      return { ok: false, error: `${engine}: evidence must be string or null for "${i.key}"` };
    }
    // If active=true, evidence must be non-empty
    if (i.active && (!i.evidence || (typeof i.evidence === 'string' && i.evidence.trim().length === 0))) {
      return { ok: false, error: `${engine}: active but no evidence for "${i.key}"` };
    }
    out.push({ key: i.key, active: i.active, evidence: (i.evidence as string | null) ?? null });
  }
  return { ok: true, value: { activations: out } };
}

/**
 * Verify each claimed evidence quote is actually a substring of the source JD
 * (case-insensitive, whitespace-normalised). Strips out hallucinated quotes.
 */
export function filterEvidenceInSource(
  activations: ActivationItem[],
  sourceText: string,
): ActivationItem[] {
  const normSource = normalise(sourceText);
  return activations.map((a) => {
    if (!a.active || !a.evidence) return a;
    const normEvidence = normalise(a.evidence);
    if (normEvidence.length < 3) return { ...a, active: false, evidence: null };
    if (!normSource.includes(normEvidence)) {
      // Hallucinated evidence — downgrade to inactive
      return { ...a, active: false, evidence: null };
    }
    return a;
  });
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}
