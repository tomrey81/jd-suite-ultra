/**
 * Axiomera grade & band convention.
 *
 * Source: AXIOMERA_WP_ACCESS.docx — Tabela 9 + Tabela 10.
 *   Grades: 6–30 (25 levels)
 *   Formula: Grade = round((R + S + E) / 50)
 *
 * Bands map every 5 grades:
 *   A1–A5  →  grades 6–10   "Wsparcie" (Support)        — supervised execution
 *   B1–B5  →  grades 11–15  "Specjalista" (Specialist)  — autonomous expert work
 *   C1–C5  →  grades 16–20  "Ekspert / Kierownik"        — team / function lead
 *   D1–D5  →  grades 21–25  "Menedżer senior"            — managing managers
 *   E1–E5  →  grades 26–30  "Kadra kierownicza"          — executive leadership
 */

export type AxiomeraBandLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export interface AxiomeraBand {
  letter: AxiomeraBandLetter;
  label: string;
  labelPL: string;
  description: string;
  /** First grade of the band (inclusive) */
  gradeMin: number;
  /** Last grade of the band (inclusive) */
  gradeMax: number;
  color: string;
  bgClass: string;
  fgClass: string;
}

export const AXIOMERA_BANDS: AxiomeraBand[] = [
  {
    letter: 'A',
    label: 'Support',
    labelPL: 'Wsparcie',
    description: 'Supervised execution; operational tasks under direction.',
    gradeMin: 6,
    gradeMax: 10,
    color: '#7A7060',
    bgClass: 'bg-stone-100',
    fgClass: 'text-stone-700',
  },
  {
    letter: 'B',
    label: 'Specialist',
    labelPL: 'Specjalista',
    description: 'Autonomous expert work; coordination of work within an area.',
    gradeMin: 11,
    gradeMax: 15,
    color: '#1F6FEB',
    bgClass: 'bg-blue-50',
    fgClass: 'text-blue-700',
  },
  {
    letter: 'C',
    label: 'Expert / Manager',
    labelPL: 'Ekspert / Kierownik',
    description: 'Team or function leadership; technical mastery.',
    gradeMin: 16,
    gradeMax: 20,
    color: '#2DA44E',
    bgClass: 'bg-emerald-50',
    fgClass: 'text-emerald-700',
  },
  {
    letter: 'D',
    label: 'Senior Manager',
    labelPL: 'Menedżer senior',
    description: 'Managing managers; multi-team or division responsibility.',
    gradeMin: 21,
    gradeMax: 25,
    color: '#BC4C00',
    bgClass: 'bg-orange-50',
    fgClass: 'text-orange-700',
  },
  {
    letter: 'E',
    label: 'Executive',
    labelPL: 'Kadra kierownicza',
    description: 'Whole-organisation responsibility; C-suite and direct reports.',
    gradeMin: 26,
    gradeMax: 30,
    color: '#8250DF',
    bgClass: 'bg-purple-50',
    fgClass: 'text-purple-700',
  },
];

/** Convert a grade (6-30) to its Axiomera band code, e.g. 17 → "C2" */
export function gradeToBandCode(grade: number): string {
  const band = AXIOMERA_BANDS.find((b) => grade >= b.gradeMin && grade <= b.gradeMax);
  if (!band) return `?${grade}`;
  const offset = grade - band.gradeMin + 1; // 1..5
  return `${band.letter}${offset}`;
}

/** Band code (e.g. "C2") to grade (e.g. 17). Returns null if invalid. */
export function bandCodeToGrade(code: string): number | null {
  const m = /^([A-E])([1-5])$/i.exec(code.trim());
  if (!m) return null;
  const letter = m[1].toUpperCase() as AxiomeraBandLetter;
  const offset = parseInt(m[2], 10);
  const band = AXIOMERA_BANDS.find((b) => b.letter === letter);
  if (!band) return null;
  return band.gradeMin + offset - 1;
}

/** Get the band for a given grade */
export function getBand(grade: number): AxiomeraBand | null {
  return AXIOMERA_BANDS.find((b) => grade >= b.gradeMin && grade <= b.gradeMax) ?? null;
}

/** All grades 6-30, descending (executive at top) */
export const AXIOMERA_GRADES_DESC: number[] = Array.from({ length: 25 }, (_, i) => 30 - i);

/**
 * Given placed levels, return only the grades that are populated, plus a small
 * buffer above and below so users can drag into adjacent cells.
 *
 * @param placed - Set of grades that currently have JDs placed
 * @param buffer - How many extra grades to show above/below (default 1)
 */
export function visibleGrades(placed: number[], buffer: number = 1): number[] {
  if (placed.length === 0) {
    // Default view: B1..C5 (11..20) — the most common JD range
    return Array.from({ length: 10 }, (_, i) => 20 - i);
  }
  const min = Math.max(6, Math.min(...placed) - buffer);
  const max = Math.min(30, Math.max(...placed) + buffer);
  const out: number[] = [];
  for (let g = max; g >= min; g--) out.push(g);
  return out;
}
