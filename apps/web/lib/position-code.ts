// Position-code generator. If a JD has no client-supplied jobCode, build
// a deterministic one from its family + level + per-cell sequence.
//
// Format: {FAMILY_ABBREV}{LEVEL}{SEQ}
//   FAMILY_ABBREV — 2-4 chars, uppercase, derived from family name
//   LEVEL          — 2 digits, zero-padded (01..25)
//   SEQ            — 2 digits, zero-padded (per family+level cell)
//
// Examples (per the user's spec):
//   "HR Compensation & Benefits" L1, slot 1 → HRCB0101
//   "Technology" L8, slot 2          → TECH0802
//   "Sales" L3, slot 1               → SAL0301

const STOPWORDS = new Set(['and', 'or', 'of', 'the', 'a', '&', '/']);

/**
 * Two-to-four-letter abbreviation. Heuristic:
 *  - Strip stopwords + punctuation
 *  - If the name has multiple words, take the leading letter of each (max 4)
 *  - Otherwise take the first 3 letters
 */
export function abbrevFamily(name: string): string {
  if (!name) return 'GEN';
  const cleaned = name
    .replace(/[&,/\\.\\-_]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()));

  if (cleaned.length === 0) return 'GEN';

  if (cleaned.length === 1) {
    const w = cleaned[0];
    return w.slice(0, Math.min(4, Math.max(2, Math.min(3, w.length)))).toUpperCase();
  }

  // Multi-word: collect first letter of up to 4 leading words
  const initials = cleaned.slice(0, 4).map((w) => w[0]).join('').toUpperCase();
  return initials.slice(0, 4) || 'GEN';
}

export function formatPositionCode(familyName: string, level: number, seqWithinCell: number): string {
  const fam = abbrevFamily(familyName);
  const lvl = String(Math.max(1, Math.min(99, level))).padStart(2, '0');
  const seq = String(Math.max(1, Math.min(99, seqWithinCell))).padStart(2, '0');
  return `${fam}${lvl}${seq}`;
}

export function describePositionCode(familyName: string, level: number): string {
  return `${abbrevFamily(familyName)}-L${String(level).padStart(2, '0')}-NN`;
}
