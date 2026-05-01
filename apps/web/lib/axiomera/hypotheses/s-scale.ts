/**
 * Axiomera S (Skills) scoring — Job Zone / Education × Experience matrix
 * Source: Axiomera Whitepaper v2 (April 2026), Tables 16, 17, 18, 19, 20
 *
 * Architectural choice: decompose the O*NET Job Zone into two observable
 * variables — Edu (40%) and Exp (60%) — based on market practice that
 * weights practical experience over formal credentials.
 *
 * Falls back to ESCO semantic match (>=0.70) → Job Zone → S_pkt,
 * or to ISCO_2 median → S_pkt if semantic match is weak.
 */

export type SLevel = 1 | 2 | 3 | 4 | 5;

export const S_EDU_SCALE: Record<SLevel, { pl: string; en: string; de: string }> = {
  1: { pl: 'Podstawowe lub niższe', en: 'Primary or lower', de: 'Grundschule oder niedriger' },
  2: { pl: 'Szkoła zawodowa', en: 'Vocational school', de: 'Berufsschule' },
  3: { pl: 'Liceum lub Technikum', en: 'High school / Technical secondary', de: 'Gymnasium / Fachoberschule' },
  4: { pl: 'Licencjat', en: "Bachelor's degree", de: 'Bachelor-Abschluss' },
  5: { pl: 'Magister lub doktorat', en: "Master's or PhD", de: 'Master- oder Doktorabschluss' },
};

export const S_EXP_SCALE: Record<SLevel, { pl: string; en: string; de: string }> = {
  1: { pl: 'do 1 roku', en: 'up to 1 year', de: 'bis zu 1 Jahr' },
  2: { pl: 'powyżej 1 do 3 lat', en: '>1 to 3 years', de: '>1 bis 3 Jahre' },
  3: { pl: 'powyżej 3 do 7 lat', en: '>3 to 7 years', de: '>3 bis 7 Jahre' },
  4: { pl: 'powyżej 7 do 15 lat', en: '>7 to 15 years', de: '>7 bis 15 Jahre' },
  5: { pl: 'powyżej 15 lat', en: '>15 years', de: '>15 Jahre' },
};

/**
 * Table 17 — Edu × Exp → S_pkt matrix
 * Rows: Edu 1..5, Cols: Exp 1..5
 */
export const S_POINT_MATRIX: number[][] = [
  // Exp=1, Exp=2, Exp=3, Exp=4, Exp=5
  /* Edu=1 */ [50,  90,  90, 150, 150],
  /* Edu=2 */ [50,  90, 150, 150, 230],
  /* Edu=3 */ [90,  90, 150, 230, 230],
  /* Edu=4 */ [90, 150, 150, 230, 333],
  /* Edu=5 */ [150, 150, 230, 230, 333],
];

/**
 * Table 18 — Job Zone / S_level profiles
 */
export const S_LEVEL_PROFILES: Record<
  SLevel,
  { pkt: number; pl: string; en: string; de: string }
> = {
  1: { pkt: 50,  pl: 'Minimalne wymagania formalne', en: 'Entry — minimal formal requirements', de: 'Einstieg — minimale formale Anforderungen' },
  2: { pkt: 90,  pl: 'Podstawowe kwalifikacje zawodowe', en: 'Basic vocational qualifications', de: 'Grundlegende berufliche Qualifikationen' },
  3: { pkt: 150, pl: 'Solidne doświadczenie lub wyższe wykształcenie', en: 'Solid experience or higher education', de: 'Solide Erfahrung oder höhere Bildung' },
  4: { pkt: 230, pl: 'Zaawansowane kwalifikacje i doświadczenie', en: 'Advanced qualifications and experience', de: 'Fortgeschrittene Qualifikationen und Erfahrung' },
  5: { pkt: 333, pl: 'Doktorat lub 15+ lat z wyższym wykształceniem', en: 'PhD or 15+ years with higher education', de: 'Doktortitel oder 15+ Jahre mit höherer Bildung' },
};

/**
 * Look up S_pkt from Edu × Exp levels (Primary path — Tabela 19 priority 1).
 */
export function sPointsFromEduExp(edu: SLevel, exp: SLevel): number {
  return S_POINT_MATRIX[edu - 1][exp - 1];
}

/**
 * Look up S_pkt from a Job Zone (Fallback path — Tabela 20).
 */
export function sPointsFromJobZone(jobZone: SLevel): number {
  return S_LEVEL_PROFILES[jobZone].pkt;
}

export const S_COMPONENT_WEIGHTS = {
  edu: 0.4,
  exp: 0.6,
};
