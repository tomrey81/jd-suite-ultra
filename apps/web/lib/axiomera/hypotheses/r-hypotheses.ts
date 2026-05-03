/**
 * Axiomera R (Responsibility) hypotheses — 19 binary markers
 * Source: Axiomera Whitepaper v2 (April 2026), Tables 2, 3, 5, 6
 *
 * Each hypothesis is a binary signal extracted from JD text.
 * Active hypothesis = 1 (confirmed by NLI evidence from JD text)
 * Level (1=low, 2=mid, 3=high) reflects empirical clustering from N=116 anchors.
 * M_zone = mean R-zone where hypothesis activates (1–9 Axiomera convention)
 * M_tercile = mean tercile rank (1=LOW, 2=MID, 3=HIGH) on O*NET external benchmark
 *
 * Internal consistency: α = 0.761 (Cronbach, reverse-coded low-level items)
 * Convergent validity with O*NET: ρ = 0.469 (p < 0.001)
 * Differentiation (Kruskal–Wallis η²): 0.666 internal / 0.268 external
 */

export type RLevel = 1 | 2 | 3;

export interface RHypothesis {
  key: string;
  level: RLevel;
  m_zone: number;
  m_tercile: number;
  n_anchors: number;
  label_pl: string;
  label_en: string;
  label_de: string;
  guidance_en: string; // what evidence in JD would activate this hypothesis
}

export const R_HYPOTHESES: RHypothesis[] = [
  // === LEVEL 1 — LOW RESPONSIBILITY (strict supervision, procedural) ===
  {
    key: 'no_prior_experience',
    level: 1, m_zone: 1.00, m_tercile: 1.00, n_anchors: 3,
    label_pl: 'Brak wymaganego doświadczenia',
    label_en: 'No prior experience required',
    label_de: 'Keine vorherige Berufserfahrung erforderlich',
    guidance_en: 'JD states no prior experience required; entry-level role.',
  },
  {
    key: 'little_discretion',
    level: 1, m_zone: 1.56, m_tercile: 1.25, n_anchors: 16,
    label_pl: 'Minimalna autonomia decyzyjna',
    label_en: 'Little decision-making discretion',
    label_de: 'Geringer Entscheidungsspielraum',
    guidance_en: 'Decisions are limited to narrow task execution, no operational autonomy.',
  },
  {
    key: 'close_supervision',
    level: 1, m_zone: 1.56, m_tercile: 1.44, n_anchors: 9,
    label_pl: 'Ścisły nadzór',
    label_en: 'Close supervision',
    label_de: 'Enge Beaufsichtigung',
    guidance_en: 'Work is performed under direct, continuous supervision.',
  },
  {
    key: 'confirms_task_steps',
    level: 1, m_zone: 2.00, m_tercile: 1.50, n_anchors: 2,
    label_pl: 'Potwierdza kolejne kroki zadania',
    label_en: 'Confirms task steps with supervisor',
    label_de: 'Bestätigt Arbeitsschritte mit Vorgesetzten',
    guidance_en: 'Role requires confirming each step of the process with a supervisor.',
  },
  {
    key: 'structured_assignments',
    level: 1, m_zone: 2.06, m_tercile: 1.43, n_anchors: 35,
    label_pl: 'Ustrukturyzowane zadania',
    label_en: 'Structured assignments',
    label_de: 'Strukturierte Aufgaben',
    guidance_en: 'Task scope is fully defined before work begins — what to do, how to do it, and success criteria are all prescribed. Active ONLY when the role has NO latitude to plan or structure its own work. Exclude roles that plan projects, manage workstreams, or determine how to meet objectives, even if they operate within a broader framework.',
  },
  {
    key: 'follows_verbal_written_instructions',
    level: 1, m_zone: 2.62, m_tercile: 1.62, n_anchors: 39,
    label_pl: 'Wykonuje polecenia ustne lub pisemne',
    label_en: 'Follows verbal or written instructions',
    label_de: 'Folgt mündlichen oder schriftlichen Anweisungen',
    guidance_en: 'Primarily executes against direct instructions from manager.',
  },
  {
    key: 'structured_environment',
    level: 1, m_zone: 3.21, m_tercile: 1.82, n_anchors: 57,
    label_pl: 'Ustrukturyzowane środowisko pracy',
    label_en: 'Structured work environment',
    label_de: 'Strukturiertes Arbeitsumfeld',
    guidance_en: 'Work is governed by SOPs, regulations, or procedural frameworks so tightly that any deviation requires explicit supervisory authorisation. Active only for roles where strict adherence to rules IS the primary mode of work. Not active merely because a role operates within a regulated sector or uses documented processes — most professional roles do.',
  },
  {
    key: 'solves_recurring_problems',
    level: 1, m_zone: 3.72, m_tercile: 1.88, n_anchors: 65,
    label_pl: 'Rozwiązuje powtarzalne problemy',
    label_en: 'Solves recurring problems',
    label_de: 'Löst wiederkehrende Probleme',
    guidance_en: 'Applies established procedures to diagnose and resolve problem types the role has encountered before — following known templates rather than developing new approaches. Active when JD explicitly says problems are "standard", "routine", or references checklists/established procedures. NOT active merely because the role performs repetitive tasks or works within a defined scope.',
  },

  // === LEVEL 2 — MODERATE (autonomy, coordination, beyond-team impact) ===
  {
    key: 'determines_escalation',
    level: 2, m_zone: 5.00, m_tercile: 2.32, n_anchors: 22,
    label_pl: 'Decyduje co eskalować',
    label_en: 'Determines what to escalate',
    label_de: 'Entscheidet über Eskalationen',
    guidance_en: 'Role holder exercises genuine professional judgment to decide WHAT issues or exceptions are significant enough to escalate to higher authority. Active when JD describes autonomy over issue classification (e.g. "identifies complex cases for escalation", "decides when to involve senior management"). NOT active for roles that merely follow prescribed escalation procedures or are required to refer all non-routine matters to a supervisor.',
  },
  {
    key: 'general_direction',
    level: 2, m_zone: 5.17, m_tercile: 2.19, n_anchors: 77,
    label_pl: 'Działa pod ogólnym kierunkiem',
    label_en: 'Works under general direction',
    label_de: 'Arbeitet unter allgemeiner Anleitung',
    guidance_en: 'Role holder receives goals or outcomes and independently determines their own methods, priorities, and pace — without managerial oversight of HOW work is done. Active only when autonomy over method is explicit (e.g. "works independently", "self-directed", "no day-to-day supervision", "sets own work programme"). NOT active for roles that "support", "assist", or "report to" a named director/manager — those signal directed work, not general direction.',
  },
  {
    key: 'coordinates_team_work',
    level: 2, m_zone: 5.41, m_tercile: 2.25, n_anchors: 71,
    label_pl: 'Koordynuje pracę zespołu',
    label_en: 'Coordinates team work',
    label_de: 'Koordiniert Teamarbeit',
    guidance_en: 'Coordinates activities of a team, even without formal authority.',
  },
  {
    key: 'impact_beyond_team',
    level: 2, m_zone: 5.85, m_tercile: 2.38, n_anchors: 61,
    label_pl: 'Wpływ poza zespół',
    label_en: 'Impact beyond immediate team',
    label_de: 'Wirkung über das unmittelbare Team hinaus',
    guidance_en: 'Role affects outcomes beyond the immediate team or function.',
  },
  {
    key: 'drives_professional_development_others',
    level: 2, m_zone: 5.89, m_tercile: 2.38, n_anchors: 37,
    label_pl: 'Rozwija kompetencje innych',
    label_en: 'Drives professional development of others',
    label_de: 'Fördert die berufliche Entwicklung anderer',
    guidance_en: 'Coaches, mentors, or develops other professionals.',
  },
  {
    key: 'develops_professional_network',
    level: 2, m_zone: 6.35, m_tercile: 2.41, n_anchors: 17,
    label_pl: 'Rozwija sieć kontaktów zawodowych',
    label_en: 'Develops professional network',
    label_de: 'Entwickelt berufliches Netzwerk',
    guidance_en: 'Role requires building an external/cross-industry professional network.',
  },

  // === LEVEL 3 — HIGH (org-wide impact, exec committee, strategic) ===
  {
    key: 'influences_industry',
    level: 3, m_zone: 4.00, m_tercile: 2.00, n_anchors: 1,
    label_pl: 'Wpływa na całą branżę',
    label_en: 'Influences the industry',
    label_de: 'Beeinflusst die gesamte Branche',
    guidance_en: 'Role has recognized industry-level influence or thought leadership. (N=1 outlier — flag as low-confidence.)',
  },
  {
    key: 'org_wide_impact',
    level: 3, m_zone: 6.94, m_tercile: 2.38, n_anchors: 16,
    label_pl: 'Wpływ ogólnoorganizacyjny',
    label_en: 'Organisation-wide impact',
    label_de: 'Organisationsweite Wirkung',
    guidance_en: 'Decisions or outputs affect the whole organisation or its entire workforce, not just one department or function. In public sector / government: decisions shape policy, service standards, legal compliance, or resource allocation for the whole authority or department. Active when role holds enterprise-wide mandate — broader than "cross-functional"; scope must be organisational or authority-wide.',
  },
  {
    key: 'member_executive_committee',
    level: 3, m_zone: 7.25, m_tercile: 2.75, n_anchors: 4,
    label_pl: 'Członek komitetu wykonawczego',
    label_en: 'Member of executive committee',
    label_de: 'Mitglied des Exekutivausschusses',
    guidance_en: 'Role sits on executive committee / C-suite body.',
  },
  {
    key: 'reports_to_board',
    level: 3, m_zone: 7.25, m_tercile: 2.75, n_anchors: 4,
    label_pl: 'Raportuje do zarządu / rady nadzorczej',
    label_en: 'Reports to board',
    label_de: 'Berichtet an den Vorstand / Aufsichtsrat',
    guidance_en: 'Role has a formal reporting or accountability relationship to a governing body — board of directors, trustees, non-executive directors, supervisory board, governing council, parent-entity board, or equivalent governance body. Active even when language is indirect: "accountable to the Board", "presents to trustees", "works with the governing body", "reports to the Audit Committee".',
  },
  {
    key: 'sets_enterprise_vision',
    level: 3, m_zone: 9.00, m_tercile: 3.00, n_anchors: 1,
    label_pl: 'Wyznacza wizję przedsiębiorstwa',
    label_en: 'Sets enterprise vision',
    label_de: 'Legt die Unternehmensvision fest',
    guidance_en: 'Role shapes the strategic direction of the whole enterprise — not just a function or division. Active for roles with explicit enterprise-wide strategic mandate: CEO, Managing Director, General Counsel with enterprise legal strategy, or equivalent. Does NOT require the word "vision" — "leads the enterprise", "sets strategic direction for the organisation", "defines long-term enterprise strategy" all qualify. (N=1 anchor — treat as high-confidence signal when evidence is explicit.)',
  },
];

/**
 * Score per active hypothesis: 1 / 2 / 3 by level.
 * R_level (hypothesis-derived) = mean of active-hypothesis levels (range 1–3).
 * From Table 4, average R_level per zone ranges from 1.66 (zone 1) to 3.37 (zone 9).
 */
export function computeRLevel(activeKeys: string[]): number {
  if (activeKeys.length === 0) return 1;
  const levels = activeKeys
    .map((k) => R_HYPOTHESES.find((h) => h.key === k)?.level)
    .filter((x): x is RLevel => x !== undefined);
  if (levels.length === 0) return 1;
  return levels.reduce((a, b) => a + b, 0) / levels.length;
}

/**
 * Weighted zone estimate from active hypothesis M_zone values.
 * This approximates the Axiomera zone classifier when the real LoRA1 is not available.
 */
export function computeWeightedZone(activeKeys: string[]): number {
  if (activeKeys.length === 0) return 1;
  const zones = activeKeys
    .map((k) => R_HYPOTHESES.find((h) => h.key === k)?.m_zone)
    .filter((x): x is number => x !== undefined);
  if (zones.length === 0) return 1;
  return zones.reduce((a, b) => a + b, 0) / zones.length;
}

/**
 * Flag contradictory activations, e.g. close_supervision AND reports_to_board.
 */
export function detectContradictions(activeKeys: string[]): string[] {
  const flags: string[] = [];
  const set = new Set(activeKeys);
  const lowKeys = R_HYPOTHESES.filter((h) => h.level === 1).map((h) => h.key);
  const highKeys = R_HYPOTHESES.filter((h) => h.level === 3).map((h) => h.key);
  const hasLow = lowKeys.some((k) => set.has(k));
  const hasHigh = highKeys.some((k) => set.has(k));
  if (hasLow && hasHigh) {
    flags.push('Low-level supervision hypotheses co-activate with high-level executive hypotheses — review required.');
  }
  return flags;
}

/**
 * Geometric R-point scale from Table 15 (Axiomera).
 * Used as the R-component of the grade composite: Grade = round((R + S + E) / 50).
 */
export const R_ZONE_POINTS: Record<number, number> = {
  1: 140,
  2: 170,
  3: 205,
  4: 250,
  5: 300,
  6: 365,
  7: 440,
  8: 530,
  9: 635,
};

export function rZoneToPoints(zone: number): number {
  const z = Math.max(1, Math.min(9, Math.round(zone)));
  return R_ZONE_POINTS[z];
}
