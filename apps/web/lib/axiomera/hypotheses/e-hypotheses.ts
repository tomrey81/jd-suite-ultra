/**
 * Axiomera E (Effort) hypotheses — 45 scorable units across 3 dimensions
 * Source: Axiomera Whitepaper v2 (April 2026), Tables 7, 8, 9, 10, 21
 *
 * Dimensions (from JD-R theory, Bakker & Demerouti 2007):
 *  - COG (cognitive effort): 11 primary + 7 interaction = 18 units
 *  - EMO (emotional effort, Hochschild 1983): 9 primary + 6 interaction = 15 units
 *  - PHY (physical effort): 3 primary + 9 interaction = 12 units
 *  Total: 45 units (whitepaper cites "35" — refers to distinct labels; formulas use unit counts)
 *
 * Each unit is binary 0/1.
 *
 * Internal consistency (α Cronbach):
 *   COG = 0.866 (good)
 *   EMO = 0.708 (acceptable)
 *   PHY = 0.958 (very high — redundancy note for executive physical roles)
 *
 * External convergence with O*NET (Spearman ρ):
 *   COG = 0.700 (high)   — H1 ≥ 0.50 ✅
 *   EMO = 0.475 (moderate) — H2 ≥ 0.40 ✅
 *   PHY = 0.594 (mod-high) — H3 ≥ 0.50 ✅
 *
 * Scoring (Table 21):
 *   COG_hyp = Σ(active COG units) / 18 × 100
 *   EMO_hyp = Σ(active EMO units) / 15 × 100
 *   PHY_hyp = Σ(active PHY units) / 12 × 100
 *   E_score = 0.45 × (COG/100) + 0.25 × (EMO/100) + 0.30 × (PHY/100)
 *   E_pkt   = E_score × 430  // used in grade composite
 */

export type EDimension = 'COG' | 'EMO' | 'PHY';
export type EType = 'P' | 'I';

export interface EHypothesis {
  key: string;
  dimension: EDimension;
  type: EType;
  onet_mapping: string;
  label_pl: string;
  label_en: string;
  label_de: string;
  guidance_en: string;
}

export const E_HYPOTHESES: EHypothesis[] = [
  // ================= COG — 11 primary + 7 interaction = 18 units =================
  {
    key: 'solves_without_precedent', dimension: 'COG', type: 'P',
    onet_mapping: 'Making Decisions and Solving Problems (4.A.2.b.2)',
    label_pl: 'Rozwiązuje problemy bez precedensu',
    label_en: 'Solves problems without precedent',
    label_de: 'Löst präzedenzlose Probleme',
    guidance_en: 'Role handles novel problems where no established solution exists.',
  },
  {
    key: 'beyond_existing_methods', dimension: 'COG', type: 'P',
    onet_mapping: 'Thinking Creatively (4.A.2.b.4)',
    label_pl: 'Wykracza poza istniejące metody',
    label_en: 'Goes beyond existing methods',
    label_de: 'Geht über bestehende Methoden hinaus',
    guidance_en: 'Role requires creating approaches beyond current standard practices.',
  },
  {
    key: 'expert_own_discipline', dimension: 'COG', type: 'P',
    onet_mapping: 'Making Decisions and Solving Problems (4.A.2.b.2)',
    label_pl: 'Ekspert w swojej dziedzinie',
    label_en: 'Expert in own discipline',
    label_de: 'Experte in eigenem Fachgebiet',
    guidance_en: 'Role is recognised as an expert authority within the discipline.',
  },
  {
    key: 'conducts_applied_research', dimension: 'COG', type: 'P',
    onet_mapping: 'Analyzing Data or Information (4.A.2.a.4)',
    label_pl: 'Prowadzi badania stosowane',
    label_en: 'Conducts applied research',
    label_de: 'Führt angewandte Forschung durch',
    guidance_en: 'Role involves applied research, data analysis, or evidence generation.',
  },
  {
    key: 'performs_project_management', dimension: 'COG', type: 'P',
    onet_mapping: 'Scheduling Work and Activities (4.A.1.b.3)',
    label_pl: 'Prowadzi zarządzanie projektami',
    label_en: 'Performs project management',
    label_de: 'Führt Projektmanagement durch',
    guidance_en: 'Role explicitly includes project management accountability.',
  },
  {
    key: 'accountable_for_budget', dimension: 'COG', type: 'P',
    onet_mapping: 'Monitoring and Controlling Resources (4.A.4.c.2)',
    label_pl: 'Odpowiada za budżet',
    label_en: 'Accountable for budget',
    label_de: 'Verantwortlich für Budget',
    guidance_en: 'Role is accountable for managing a budget line.',
  },
  {
    key: 'influences_resource_allocation', dimension: 'COG', type: 'P',
    onet_mapping: 'Monitoring and Controlling Resources (4.A.4.c.2)',
    label_pl: 'Wpływa na alokację zasobów',
    label_en: 'Influences resource allocation',
    label_de: 'Beeinflusst Ressourcenzuteilung',
    guidance_en: 'Role influences how organisational resources are allocated.',
  },
  {
    key: 'shapes_function_strategy', dimension: 'COG', type: 'P',
    onet_mapping: 'Developing Objectives and Strategies (4.A.1.b.2)',
    label_pl: 'Kształtuje strategię funkcji',
    label_en: 'Shapes function strategy',
    label_de: 'Gestaltet die Funktionsstrategie',
    guidance_en: 'Role shapes the strategy of a function or business unit.',
  },
  {
    key: 'ensures_regulatory_compliance', dimension: 'COG', type: 'P',
    onet_mapping: 'Evaluating Info — Compliance Standards (4.A.2.a.2)',
    label_pl: 'Zapewnia zgodność regulacyjną',
    label_en: 'Ensures regulatory compliance',
    label_de: 'Stellt die Einhaltung von Vorschriften sicher',
    guidance_en: 'Role bears explicit accountability for regulatory compliance.',
  },
  {
    key: 'unpredictable_contexts', dimension: 'COG', type: 'P',
    onet_mapping: 'Problem Sensitivity (1.A.1.c.1)',
    label_pl: 'Pracuje w nieprzewidywalnych kontekstach',
    label_en: 'Works in unpredictable contexts',
    label_de: 'Arbeitet in unvorhersehbaren Kontexten',
    guidance_en: 'Role operates in contexts that are volatile / unpredictable.',
  },
  {
    key: 'varied_non_routine', dimension: 'COG', type: 'P',
    onet_mapping: 'Determine Tasks, Priorities and Goals (4.C.3.b.8)',
    label_pl: 'Zadania zróżnicowane i nierutynowe',
    label_en: 'Varied and non-routine work',
    label_de: 'Abwechslungsreiche, nicht routinemäßige Arbeit',
    guidance_en: 'Tasks vary substantially; work is non-routine.',
  },
  // COG interactions (7)
  {
    key: 'accountable_for_budget_x_pnl', dimension: 'COG', type: 'I',
    onet_mapping: 'Monitoring and Controlling Resources (4.A.4.c.2)',
    label_pl: 'Budżet × P&L', label_en: 'Budget × P&L accountability',
    label_de: 'Budget × GuV-Verantwortung',
    guidance_en: 'Co-activation: role is accountable for both budget and P&L.',
  },
  {
    key: 'pnl_x_function_strategy', dimension: 'COG', type: 'I',
    onet_mapping: 'Developing Objectives and Strategies (4.A.1.b.2)',
    label_pl: 'P&L × Strategia funkcji',
    label_en: 'P&L × Function strategy',
    label_de: 'GuV × Funktionsstrategie',
    guidance_en: 'Co-activation: role owns P&L and shapes function strategy.',
  },
  {
    key: 'strategic_direction_x_function_strategy', dimension: 'COG', type: 'I',
    onet_mapping: 'Developing Objectives and Strategies (4.A.1.b.2)',
    label_pl: 'Kierunek strategiczny × Strategia funkcji',
    label_en: 'Strategic direction × Function strategy',
    label_de: 'Strategische Ausrichtung × Funktionsstrategie',
    guidance_en: 'Co-activation: role influences strategic direction AND shapes function strategy.',
  },
  {
    key: 'highest_authority_planning_x_strategic_direction', dimension: 'COG', type: 'I',
    onet_mapping: 'Developing Objectives and Strategies (4.A.1.b.2)',
    label_pl: 'Najwyższa władza planistyczna × Kierunek strategiczny',
    label_en: 'Highest authority planning × Strategic direction',
    label_de: 'Höchste Planungsautorität × Strategische Ausrichtung',
    guidance_en: 'Co-activation: role is the highest planning authority and directs strategy.',
  },
  {
    key: 'milestones_x_project_management', dimension: 'COG', type: 'I',
    onet_mapping: 'Scheduling Work and Activities (4.A.1.b.3)',
    label_pl: 'Kamienie milowe × Zarządzanie projektami',
    label_en: 'Milestones × Project management',
    label_de: 'Meilensteine × Projektmanagement',
    guidance_en: 'Co-activation: role plans milestones AND performs project management.',
  },
  {
    key: 'analytical_reports_x_research', dimension: 'COG', type: 'I',
    onet_mapping: 'Analyzing Data or Information (4.A.2.a.4)',
    label_pl: 'Raporty analityczne × Badania stosowane',
    label_en: 'Analytical reports × Applied research',
    label_de: 'Analytische Berichte × Angewandte Forschung',
    guidance_en: 'Co-activation: role writes analytical reports and conducts research.',
  },
  {
    key: 'risk_analysis_x_compliance', dimension: 'COG', type: 'I',
    onet_mapping: 'Evaluating Info — Compliance Standards (4.A.2.a.2)',
    label_pl: 'Analiza ryzyka × Zgodność regulacyjna',
    label_en: 'Risk analysis × Regulatory compliance',
    label_de: 'Risikoanalyse × Regulatorische Compliance',
    guidance_en: 'Co-activation: role performs risk analysis AND ensures compliance.',
  },

  // ================= EMO — 9 primary + 6 interaction = 15 units =================
  {
    key: 'manages_external_stakeholders', dimension: 'EMO', type: 'P',
    onet_mapping: 'Communicating with People Outside the Organization (4.A.4.a.8)',
    label_pl: 'Zarządza interesariuszami zewnętrznymi',
    label_en: 'Manages external stakeholders',
    label_de: 'Verwaltet externe Stakeholder',
    guidance_en: 'Regular management of external stakeholder relationships.',
  },
  {
    key: 'represents_org_externally', dimension: 'EMO', type: 'P',
    onet_mapping: 'Communicating with People Outside the Organization (4.A.4.a.8)',
    label_pl: 'Reprezentuje organizację na zewnątrz',
    label_en: 'Represents organisation externally',
    label_de: 'Vertritt die Organisation nach außen',
    guidance_en: 'Role represents the organisation to external audiences.',
  },
  {
    key: 'manages_staff_directly', dimension: 'EMO', type: 'P',
    onet_mapping: 'Guiding, Directing, and Motivating Subordinates (4.A.4.b.4)',
    label_pl: 'Zarządza pracownikami bezpośrednio',
    label_en: 'Manages staff directly',
    label_de: 'Führt Mitarbeiter direkt',
    guidance_en: 'Role has direct line management of staff.',
  },
  {
    key: 'manages_managers', dimension: 'EMO', type: 'P',
    onet_mapping: 'Coordinating the Work and Activities of Others (4.A.4.b.1)',
    label_pl: 'Zarządza menedżerami',
    label_en: 'Manages managers',
    label_de: 'Führt Manager',
    guidance_en: 'Role manages other managers (manager-of-managers).',
  },
  {
    key: 'oversees_senior_leaders', dimension: 'EMO', type: 'P',
    onet_mapping: 'Work Outcomes and Results of Other Workers (4.C.1.c.2)',
    label_pl: 'Nadzoruje starsze kierownictwo',
    label_en: 'Oversees senior leaders',
    label_de: 'Beaufsichtigt Führungskräfte',
    guidance_en: 'Role oversees senior leaders / executives.',
  },
  {
    key: 'leads_multiple_functions', dimension: 'EMO', type: 'P',
    onet_mapping: 'Impact of Decisions on Co-workers or Company Results (4.C.1.e.1)',
    label_pl: 'Kieruje wieloma funkcjami',
    label_en: 'Leads multiple functions',
    label_de: 'Leitet mehrere Funktionen',
    guidance_en: 'Role leads more than one function / division.',
  },
  {
    key: 'handles_emotionally_demanding_situations', dimension: 'EMO', type: 'P',
    onet_mapping: 'Resolving Conflicts and Negotiating with Others (4.A.4.a.7)',
    label_pl: 'Zarządza sytuacjami emocjonalnie wymagającymi',
    label_en: 'Handles emotionally demanding situations',
    label_de: 'Bewältigt emotional anspruchsvolle Situationen',
    guidance_en: 'Regular exposure to conflict, crisis, or emotionally charged interactions.',
  },
  {
    key: 'provides_care_or_welfare_services', dimension: 'EMO', type: 'P',
    onet_mapping: 'Assisting and Caring for Others (4.A.4.a.4)',
    label_pl: 'Świadczy usługi opiekuńcze/pomocowe',
    label_en: 'Provides care or welfare services',
    label_de: 'Erbringt Pflege- oder Fürsorgeleistungen',
    guidance_en: 'Role delivers care, welfare, or support services to people.',
  },
  {
    key: 'responsible_for_client_wellbeing', dimension: 'EMO', type: 'P',
    onet_mapping: 'Assisting and Caring for Others (4.A.4.a.4)',
    label_pl: 'Odpowiada za dobrostan klienta',
    label_en: 'Responsible for client wellbeing',
    label_de: 'Verantwortlich für das Wohlergehen der Klienten',
    guidance_en: 'Role is directly responsible for client / patient wellbeing.',
  },
  // EMO interactions (6)
  {
    key: 'em_dem_x_provides_care', dimension: 'EMO', type: 'I',
    onet_mapping: 'Assisting and Caring for Others (4.A.4.a.4)',
    label_pl: 'Wymagające emocjonalnie × Opieka',
    label_en: 'Emotionally demanding × Care',
    label_de: 'Emotional anspruchsvoll × Pflege',
    guidance_en: 'Co-activation: emotionally demanding AND provides care.',
  },
  {
    key: 'em_dem_x_responsible_client', dimension: 'EMO', type: 'I',
    onet_mapping: 'Resolving Conflicts and Negotiating with Others (4.A.4.a.7)',
    label_pl: 'Wymagające emocjonalnie × Odpowiedzialność za klienta',
    label_en: 'Emotionally demanding × Client responsibility',
    label_de: 'Emotional anspruchsvoll × Klientenverantwortung',
    guidance_en: 'Co-activation: emotionally demanding AND responsible for client wellbeing.',
  },
  {
    key: 'direct_customer_x_em_dem', dimension: 'EMO', type: 'I',
    onet_mapping: 'Resolving Conflicts and Negotiating with Others (4.A.4.a.7)',
    label_pl: 'Bezpośredni kontakt z klientem × Wymagające emocjonalnie',
    label_en: 'Direct customer × Emotionally demanding',
    label_de: 'Direkter Kundenkontakt × Emotional anspruchsvoll',
    guidance_en: 'Co-activation: direct customer contact AND emotionally demanding.',
  },
  {
    key: 'manages_staff_x_coaches', dimension: 'EMO', type: 'I',
    onet_mapping: 'Coaching and Developing Others (4.A.4.b.5)',
    label_pl: 'Zarządza personelem × Coaching zespołu',
    label_en: 'Manages staff × Coaches team',
    label_de: 'Führt Mitarbeiter × Coacht Team',
    guidance_en: 'Co-activation: manages staff AND coaches/evaluates team.',
  },
  {
    key: 'manages_managers_x_full_authority', dimension: 'EMO', type: 'I',
    onet_mapping: 'Staffing Organizational Units (4.A.4.c.1)',
    label_pl: 'Zarządza menedżerami × Pełna władza zarządcza',
    label_en: 'Manages managers × Full management authority',
    label_de: 'Führt Manager × Volle Führungsbefugnis',
    guidance_en: 'Co-activation: manages managers with full management authority.',
  },
  {
    key: 'leads_functions_x_shapes_culture', dimension: 'EMO', type: 'I',
    onet_mapping: 'Impact of Decisions on Co-workers (4.C.1.e.1)',
    label_pl: 'Kieruje funkcjami × Kształtuje kulturę',
    label_en: 'Leads functions × Shapes culture',
    label_de: 'Leitet Funktionen × Gestaltet Kultur',
    guidance_en: 'Co-activation: leads multiple functions AND shapes org culture.',
  },

  // ================= PHY — 3 primary + 9 interaction = 12 units =================
  {
    key: 'performs_physical_manual_work', dimension: 'PHY', type: 'P',
    onet_mapping: 'Performing General Physical Activities (4.A.3.b.4)',
    label_pl: 'Wykonuje pracę fizyczną / manualną',
    label_en: 'Performs physical / manual work',
    label_de: 'Verrichtet körperliche / manuelle Arbeit',
    guidance_en: 'Role requires regular physical or manual labour.',
  },
  {
    key: 'operates_maintains_equipment', dimension: 'PHY', type: 'P',
    onet_mapping: 'Repairing and Maintaining Mechanical Equipment (4.A.3.b.2)',
    label_pl: 'Obsługuje / konserwuje sprzęt',
    label_en: 'Operates / maintains equipment',
    label_de: 'Bedient / wartet Ausrüstung',
    guidance_en: 'Role operates or maintains mechanical / technical equipment.',
  },
  {
    key: 'works_in_hazardous_conditions', dimension: 'PHY', type: 'P',
    onet_mapping: 'Exposed to Hazardous Conditions (4.C.2.b.1)',
    label_pl: 'Pracuje w warunkach niebezpiecznych',
    label_en: 'Works in hazardous conditions',
    label_de: 'Arbeitet unter gefährlichen Bedingungen',
    guidance_en: 'Role exposes the worker to hazardous conditions.',
  },
  // PHY interactions (9)
  {
    key: 'physical_x_hazardous', dimension: 'PHY', type: 'I',
    onet_mapping: 'Exposed to Hazardous Conditions (4.C.2.b.1)',
    label_pl: 'Fizyczna × Niebezpieczna',
    label_en: 'Physical × Hazardous',
    label_de: 'Körperlich × Gefährlich',
    guidance_en: 'Co-activation: physical work in hazardous conditions.',
  },
  {
    key: 'equipment_x_hazardous', dimension: 'PHY', type: 'I',
    onet_mapping: 'Exposed to Hazardous Equipment (4.C.2.b.2)',
    label_pl: 'Sprzęt × Niebezpieczna',
    label_en: 'Equipment × Hazardous',
    label_de: 'Ausrüstung × Gefährlich',
    guidance_en: 'Co-activation: equipment operation in hazardous conditions.',
  },
  {
    key: 'physical_x_equipment_x_hazardous', dimension: 'PHY', type: 'I',
    onet_mapping: 'Exposed to Hazardous Conditions + Equipment',
    label_pl: 'Fizyczna × Sprzęt × Niebezpieczna',
    label_en: 'Physical × Equipment × Hazardous',
    label_de: 'Körperlich × Ausrüstung × Gefährlich',
    guidance_en: 'Co-activation: physical + equipment + hazardous (triple).',
  },
  {
    key: 'physical_x_routine_supervision', dimension: 'PHY', type: 'I',
    onet_mapping: 'Pace Determined by Speed of Equipment (4.C.3.d.5)',
    label_pl: 'Fizyczna × Rutyna pod nadzorem',
    label_en: 'Physical × Routine under supervision',
    label_de: 'Körperlich × Routine unter Aufsicht',
    guidance_en: 'Co-activation: physical work on a paced routine line.',
  },
  {
    key: 'physical_x_fixed_procedures', dimension: 'PHY', type: 'I',
    onet_mapping: 'Importance of Repeating Same Tasks (4.C.3.d.7)',
    label_pl: 'Fizyczna × Stałe procedury',
    label_en: 'Physical × Fixed procedures',
    label_de: 'Körperlich × Feste Verfahren',
    guidance_en: 'Co-activation: physical work following fixed, repetitive procedures.',
  },
  {
    key: 'equipment_x_fixed_procedures', dimension: 'PHY', type: 'I',
    onet_mapping: 'Importance of Repeating Same Tasks (4.C.3.d.7)',
    label_pl: 'Sprzęt × Stałe procedury',
    label_en: 'Equipment × Fixed procedures',
    label_de: 'Ausrüstung × Feste Verfahren',
    guidance_en: 'Co-activation: equipment operation with fixed procedures.',
  },
  {
    key: 'hazardous_x_routine_supervision', dimension: 'PHY', type: 'I',
    onet_mapping: 'Exposed to Hazardous Conditions (4.C.2.b.1)',
    label_pl: 'Niebezpieczna × Rutyna pod nadzorem',
    label_en: 'Hazardous × Routine under supervision',
    label_de: 'Gefährlich × Routine unter Aufsicht',
    guidance_en: 'Co-activation: hazardous work on a paced routine line.',
  },
  {
    key: 'hazardous_x_fixed_procedures', dimension: 'PHY', type: 'I',
    onet_mapping: 'Exposed to Hazardous Conditions (4.C.2.b.1)',
    label_pl: 'Niebezpieczna × Stałe procedury',
    label_en: 'Hazardous × Fixed procedures',
    label_de: 'Gefährlich × Feste Verfahren',
    guidance_en: 'Co-activation: hazardous work with fixed, repetitive procedures.',
  },
  {
    key: 'equipment_x_routine_supervision', dimension: 'PHY', type: 'I',
    onet_mapping: 'Pace Determined by Speed of Equipment (4.C.3.d.5)',
    label_pl: 'Sprzęt × Rutyna pod nadzorem',
    label_en: 'Equipment × Routine under supervision',
    label_de: 'Ausrüstung × Routine unter Aufsicht',
    guidance_en: 'Co-activation: equipment on a paced routine line.',
  },
];

/**
 * Unit counts used in formula denominators (from Table 21).
 */
export const E_DIM_UNIT_COUNT: Record<EDimension, number> = {
  COG: 18,
  EMO: 15,
  PHY: 12,
};

export const E_DIM_WEIGHTS: Record<EDimension, number> = {
  COG: 0.45,
  EMO: 0.25,
  PHY: 0.30,
};

export const E_POINT_OPERATOR = 430;

/**
 * Compute E dimension sub-score (0–100) from list of active unit keys.
 */
export function computeEDimension(activeKeys: string[], dim: EDimension): number {
  const activeInDim = activeKeys.filter((k) =>
    E_HYPOTHESES.some((h) => h.key === k && h.dimension === dim),
  );
  return (activeInDim.length / E_DIM_UNIT_COUNT[dim]) * 100;
}

/**
 * Compute E_score (0–1), E_pkt (final points).
 */
export function computeEScore(activeKeys: string[]): {
  cog: number;
  emo: number;
  phy: number;
  e_score: number;
  e_pkt: number;
} {
  const cog = computeEDimension(activeKeys, 'COG');
  const emo = computeEDimension(activeKeys, 'EMO');
  const phy = computeEDimension(activeKeys, 'PHY');
  const e_score =
    E_DIM_WEIGHTS.COG * (cog / 100) +
    E_DIM_WEIGHTS.EMO * (emo / 100) +
    E_DIM_WEIGHTS.PHY * (phy / 100);
  return { cog, emo, phy, e_score, e_pkt: e_score * E_POINT_OPERATOR };
}
