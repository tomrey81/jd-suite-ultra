// ── JD Studio — Sonic Fingerprint Engine ───────────────────────────────────
// Pure functions — zero browser API dependencies. Safe to import server-side.
// All functions are deterministic and idempotent for the same input.

import { SCALES, ROOTS, DEFAULT_SCALE, DEFAULT_ROOT } from './audio-constants';

// ── Types ───────────────────────────────────────────────────────────────────

export interface JdFingerprint {
  /** Normalised note distribution over the scale degrees (sums to ~1) */
  normNote: number[];
  /** Normalised octave register distribution [low, mid, hi] */
  normOct: number[];
  /** Mean velocity (loudness) 0–1 */
  velMean: number;
  /** Velocity variance (dynamic range proxy) */
  velVar: number;
  /** Fraction of intervals larger than 7 semitones (register inconsistency) */
  largeJumps: number;
  /** Fraction of intervals ≤ 1 semitone (melodic flatness / monotone language) */
  flatness: number;
  /** Fraction of 4+-letter words appearing 3+ times (repetition rate) */
  repRate: number;
  /** Share of melody covered by top-3 scale degrees (harmonic concentration) */
  concentration: number;
  /** Top 8 words by frequency */
  topWords: Array<{ w: string; c: number }>;
  /** Number of characters processed */
  charCount: number;
  /** Number of 4+-letter words */
  wordCount: number;
}

export interface SimilarityScore {
  /** Weighted composite: melodic 50% + register 30% + dynamic 20% */
  overall: number;
  /** Cosine similarity of note distributions */
  melodic: number;
  /** Register (octave) similarity */
  register: number;
  /** Dynamic (velocity mean) similarity */
  dynamic: number;
}

export type SonicIssueSeverity = 'critical' | 'warning' | 'info';
export type SonicIssueType =
  | 'duplication'
  | 'vague'
  | 'inconsistency'
  | 'structure'
  | 'missing_section'
  | 'grade_inflation'
  | 'bias';

export interface SonicIssue {
  id: string;
  sev: SonicIssueSeverity;
  type: SonicIssueType;
  msg: string;
  sonicNote: string;
  fix: string;
  location: string;
  /** Whether this issue came from Claude AI (vs. local heuristic) */
  isAi: boolean;
  /** Pending: user hasn't acted; accepted: approved for apply; skipped: ignored */
  status: 'pending' | 'accepted' | 'skipped';
  /** User-edited version of the fix recommendation */
  editedFix: string;
  /** If Claude provided a ready-made replacement snippet */
  fixedSnippet?: string;
}

// ── Core: Fingerprint computation ──────────────────────────────────────────

/**
 * Map a JD text string to its sonic fingerprint.
 * Each character maps to a scale degree + octave + velocity via ASCII arithmetic.
 * Metrics are normalised so fingerprints are comparable regardless of JD length.
 */
export function computeJdFingerprint(
  text: string,
  scaleKey: string = DEFAULT_SCALE,
  rootNote: string = DEFAULT_ROOT,
): JdFingerprint {
  const sc = SCALES[scaleKey] ?? SCALES[DEFAULT_SCALE];
  const rf = ROOTS[rootNote] ?? ROOTS[DEFAULT_ROOT];

  // Normalise whitespace before processing
  const chars = Array.from((text ?? '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim());

  const nd = new Array<number>(sc.length).fill(0);
  const od: [number, number, number] = [0, 0, 0];
  let vs = 0;
  let vs2 = 0;
  let lm: number | null = null;
  const ints: number[] = [];

  for (const c of chars) {
    const code = c.charCodeAt(0);
    const deg = code % sc.length;
    const oct = Math.floor(code / sc.length) % 3;
    const semi = Math.log2(rf / 261.63) * 12 + 60;
    const midi = semi + sc[deg] + oct * 12;
    const vel = 0.4 + ((code % 7) / 6) * 0.6;

    nd[deg]++;
    od[oct as 0 | 1 | 2]++;
    vs += vel;
    vs2 += vel * vel;

    if (lm !== null) ints.push(Math.abs(midi - lm));
    lm = midi;
  }

  const n = Math.max(1, chars.length);
  const normNote = nd.map((v) => v / n);
  const normOct = od.map((v) => v / n);
  const velMean = vs / n;
  const velVar = Math.sqrt(Math.max(0, vs2 / n - velMean * velMean));

  const intLen = Math.max(1, ints.length);
  const largeJumps = ints.filter((i) => i > 7).length / intLen;
  const flatness = ints.filter((i) => i <= 1).length / intLen;

  const words = (text ?? '').toLowerCase().match(/\b[a-zA-Z]{4,}\b/g) ?? [];
  const wf: Record<string, number> = {};
  for (const w of words) wf[w] = (wf[w] ?? 0) + 1;

  const repRate = Math.min(
    1,
    words.filter((w) => wf[w] > 2).length / Math.max(1, words.length),
  );

  const sn = [...normNote].sort((a, b) => b - a);
  const concentration = sn.slice(0, 3).reduce((s, v) => s + v, 0);

  const topWords = Object.entries(wf)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([w, c]) => ({ w, c }));

  return {
    normNote,
    normOct,
    velMean,
    velVar,
    largeJumps,
    flatness,
    repRate,
    concentration,
    topWords,
    charCount: n,
    wordCount: words.length,
  };
}

// ── Similarity: cosine distance over note distributions ────────────────────

/**
 * Compare two fingerprints. Returns null if either is missing.
 * Weighted composite: melodic (cosine) 50% + register (octave L1) 30% + dynamic (velocity) 20%.
 */
export function computeJdSimilarity(
  fp1: JdFingerprint | null,
  fp2: JdFingerprint | null,
): SimilarityScore | null {
  if (!fp1 || !fp2) return null;

  const dot = fp1.normNote.reduce((s, v, i) => s + v * (fp2.normNote[i] ?? 0), 0);
  const m1 = Math.sqrt(fp1.normNote.reduce((s, v) => s + v * v, 0));
  const m2 = Math.sqrt(fp2.normNote.reduce((s, v) => s + v * v, 0));
  const cosSim = m1 && m2 ? dot / (m1 * m2) : 0;

  const octSim =
    1 - fp1.normOct.reduce((s, v, i) => s + Math.abs(v - (fp2.normOct[i] ?? 0)), 0) / 2;
  const velSim = 1 - Math.min(1, Math.abs(fp1.velMean - fp2.velMean) / 0.4);

  return {
    overall: Math.round((cosSim * 0.5 + octSim * 0.3 + velSim * 0.2) * 100),
    melodic: Math.round(cosSim * 100),
    register: Math.round(octSim * 100),
    dynamic: Math.round(velSim * 100),
  };
}

// ── Issue detection: heuristic rules derived from fingerprint metrics ───────

/**
 * Run all heuristic sonic issue detectors against a fingerprint + raw text.
 * Returns issues sorted by severity: critical → warning → info.
 * Each issue is ready to be shown in the UI as-is (no further mapping needed).
 */
export function detectSonicIssues(fp: JdFingerprint | null, text: string): Omit<SonicIssue, 'status' | 'editedFix' | 'isAi'>[] {
  if (!fp) return [];

  const iss: Omit<SonicIssue, 'status' | 'editedFix' | 'isAi'>[] = [];
  const wc = (text ?? '').split(/\s+/).filter(Boolean).length;

  // ── Bias (critical — legal risk) ──────────────────────────────────────────
  const genderedMatch = (text ?? '').match(/\b(he|she|his|her)\b/i);
  if (genderedMatch) {
    iss.push({
      id: 't_bias',
      sev: 'critical',
      type: 'bias',
      msg: 'Gendered pronouns detected — legal and DEI risk',
      sonicNote: 'Bias signal detected in text composition',
      fix: 'Replace all "he/she/his/her" with "they/their" or restructure to avoid pronouns entirely',
      location: genderedMatch[0],
    });
  }

  // ── Grade inflation language ───────────────────────────────────────────────
  const inflatedMatch = (text ?? '').match(/(rockstar|ninja|guru|wizard|superhero|passionate about)/i);
  if (inflatedMatch) {
    iss.push({
      id: 't_inflated',
      sev: 'warning',
      type: 'grade_inflation',
      msg: 'Exclusionary / inflated language detected',
      sonicNote: 'Hyperbolic amplitude peaks — unrealistic expectations in the composition',
      fix: 'Replace with specific, measurable requirements: "5+ years in X" vs "exceptional X skills"',
      location: inflatedMatch[0],
    });
  }

  // ── Mixed seniority signals ────────────────────────────────────────────────
  const txt = (text ?? '').toLowerCase();
  const seniorityWords = ['senior', 'junior', 'lead', 'principal', 'head of', 'director', 'chief'].filter((w) =>
    txt.includes(w),
  );
  if (seniorityWords.length > 2) {
    iss.push({
      id: 't_sen',
      sev: 'warning',
      type: 'grade_inflation',
      msg: `Mixed seniority signals detected: ${seniorityWords.slice(0, 4).join(', ')}`,
      sonicNote: 'Dissonant register shifts in melodic composition',
      fix: 'Pick one seniority level and remove conflicting labels throughout the JD',
      location: seniorityWords.slice(0, 3).join(', '),
    });
  }

  // ── High vocabulary repetition ────────────────────────────────────────────
  if (fp.repRate > 0.30) {
    iss.push({
      id: 'si_rep',
      sev: 'warning',
      type: 'duplication',
      msg: `High vocabulary repetition — ${Math.round(fp.repRate * 100)}% of words repeat 3+ times`,
      sonicNote: `Clustered notes: top 3 scale degrees = ${Math.round(fp.concentration * 100)}% of melody`,
      fix: 'Diversify language: replace repeated terms with synonyms, restructure repeated concepts',
      location: fp.topWords.slice(0, 3).map((t) => `"${t.w}" ×${t.c}`).join(', '),
    });
  }

  // ── Monotonic language ────────────────────────────────────────────────────
  if (fp.flatness > 0.78) {
    iss.push({
      id: 'si_mono',
      sev: 'warning',
      type: 'vague',
      msg: `Monotonic language — ${Math.round(fp.flatness * 100)}% of transitions are stepwise (≤1 semitone)`,
      sonicNote: 'Flat melody: nearly all notes move by step — no dynamic contrast',
      fix: 'Add concrete action verbs, quantified requirements, specific deliverables',
      location: 'Throughout JD',
    });
  }

  // ── Inconsistent register ─────────────────────────────────────────────────
  if (fp.largeJumps > 0.28) {
    iss.push({
      id: 'si_jump',
      sev: 'warning',
      type: 'inconsistency',
      msg: `Inconsistent register — ${Math.round(fp.largeJumps * 100)}% of intervals are large (>7 semitones)`,
      sonicNote: 'Large melodic leaps: language switches abruptly between registers',
      fix: 'Align seniority framing consistently — entry, mid or senior level throughout',
      location: 'Multiple sections',
    });
  }

  // ── Low dynamic variance ──────────────────────────────────────────────────
  if (fp.velVar < 0.07) {
    iss.push({
      id: 'si_flat',
      sev: 'info',
      type: 'structure',
      msg: 'Low dynamic variance — text lacks emphasis hierarchy',
      sonicNote: `Flat amplitude envelope: velocity variance = ${fp.velVar.toFixed(3)}`,
      fix: 'Add section headers, vary sentence length, use bullets to create natural emphasis',
      location: 'Overall structure',
    });
  }

  // ── Narrow vocabulary ─────────────────────────────────────────────────────
  if (fp.concentration > 0.52) {
    iss.push({
      id: 'si_cluster',
      sev: 'info',
      type: 'vague',
      msg: `Narrow vocabulary — top 3 note clusters cover ${Math.round(fp.concentration * 100)}% of melody`,
      sonicNote: 'Scale clustering: limited harmonic variety mirrors limited vocabulary range',
      fix: 'Expand vocabulary range, add specificity to descriptions',
      location: fp.topWords.slice(0, 3).map((t) => `"${t.w}"`).join(', '),
    });
  }

  // ── JD too short ──────────────────────────────────────────────────────────
  if (wc < 80) {
    iss.push({
      id: 't_short',
      sev: 'warning',
      type: 'missing_section',
      msg: `JD too short (${wc} words) — key sections likely missing`,
      sonicNote: 'Short melody: insufficient harmonic development',
      fix: 'Add: Job Summary, Key Responsibilities, Requirements, Nice-to-have, What We Offer',
      location: 'Entire JD',
    });
  }

  // ── JD too long ───────────────────────────────────────────────────────────
  if (wc > 600) {
    iss.push({
      id: 't_long',
      sev: 'info',
      type: 'structure',
      msg: `JD is long (${wc} words) — consider condensing for readability`,
      sonicNote: 'Extended composition: candidate attention may fade',
      fix: 'Target 200–400 words. Remove redundant descriptions and legal boilerplate',
      location: 'Entire JD',
    });
  }

  // Sort: critical first, then warning, then info
  const order: Record<SonicIssueSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return iss.sort((a, b) => order[a.sev] - order[b.sev]);
}

// ── Delta calculation: before vs. after fixes ───────────────────────────────

export interface FingerprintDelta {
  repRate: { before: number; after: number; improved: boolean };
  flatness: { before: number; after: number; improved: boolean };
  largeJumps: { before: number; after: number; improved: boolean };
  velVar: { before: number; after: number; improved: boolean };
  wordCount: { before: number; after: number; improved: boolean };
  concentration: { before: number; after: number; improved: boolean };
}

export function computeDelta(before: JdFingerprint, after: JdFingerprint): FingerprintDelta {
  return {
    repRate:     { before: before.repRate,     after: after.repRate,     improved: after.repRate < before.repRate },
    flatness:    { before: before.flatness,    after: after.flatness,    improved: after.flatness < before.flatness },
    largeJumps:  { before: before.largeJumps,  after: after.largeJumps,  improved: after.largeJumps < before.largeJumps },
    velVar:      { before: before.velVar,      after: after.velVar,      improved: after.velVar > before.velVar },
    wordCount:   { before: before.wordCount,   after: after.wordCount,   improved: after.wordCount >= before.wordCount },
    concentration: { before: before.concentration, after: after.concentration, improved: after.concentration < before.concentration },
  };
}

// ── Text patching: apply accepted fixes to the original text ────────────────

/**
 * Apply a list of accepted issues to the original JD text.
 * For issues with a fixedSnippet, it replaces the location string in the text.
 * Issues without a snippet are skipped (they require manual edit).
 * Returns the patched text plus a count of actually applied patches.
 */
export function applyFixes(
  originalText: string,
  issues: SonicIssue[],
): { patchedText: string; appliedCount: number } {
  let patchedText = originalText;
  let appliedCount = 0;

  for (const issue of issues) {
    if (issue.status !== 'accepted') continue;

    const snippet = issue.editedFix.trim() || issue.fixedSnippet?.trim();
    if (!snippet || !issue.location) continue;

    // Only replace if the location string actually appears in the text
    // Use first occurrence — avoids ambiguous global replaces
    if (patchedText.includes(issue.location)) {
      patchedText = patchedText.replace(issue.location, snippet);
      appliedCount++;
    }
  }

  return { patchedText, appliedCount };
}
