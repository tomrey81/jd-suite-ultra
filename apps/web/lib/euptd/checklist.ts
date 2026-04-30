// EUPTD Pay Transparency Readiness checklist.
// Inspired by Mercer's 4-pillar model (Job Architecture, Pay Equity, Policy,
// People & Culture). Items are bilingual EN/PL — pick by `lang` at render time.
//
// Each item has a stable `id` so stored answers survive future copy edits.
// `weight` lets pillars or items count more toward the overall %.

export type Pillar = 'architecture' | 'pay_equity' | 'policy' | 'culture';
export type Lang = 'en' | 'pl';

export interface Item {
  id: string;
  pillar: Pillar;
  weight: number;     // 1..3
  // EUPTD article reference where applicable
  ref?: string;
  // Optional link to a JD Suite tool that helps answer / fix this
  tool?: { href: string; label: { en: string; pl: string } };
  question: { en: string; pl: string };
  hint: { en: string; pl: string };
}

export const PILLAR_META: Record<Pillar, { label: { en: string; pl: string }; color: string; icon: string }> = {
  architecture: {
    label: { en: 'Job architecture', pl: 'Architektura stanowisk' },
    color: '#1F6FEB',
    icon: '⊞',
  },
  pay_equity: {
    label: { en: 'Pay equity', pl: 'Równość wynagrodzeń' },
    color: '#2DA44E',
    icon: '⚖',
  },
  policy: {
    label: { en: 'Policy', pl: 'Polityka' },
    color: '#BC4C00',
    icon: '⊡',
  },
  culture: {
    label: { en: 'People & culture', pl: 'Ludzie i kultura' },
    color: '#8250DF',
    icon: '◉',
  },
};

export const CHECKLIST: Item[] = [
  // ── Architecture (8) ──────────────────────────────────────────────────────
  { id: 'arch-001', pillar: 'architecture', weight: 3, ref: 'EUPTD Art. 4(1)',
    question: {
      en: 'Do you have a documented job architecture covering all roles?',
      pl: 'Czy posiadają Państwo udokumentowaną architekturę stanowisk obejmującą wszystkie role?',
    },
    hint: {
      en: 'A structured map of families × levels with each role assigned.',
      pl: 'Strukturalna mapa rodzin × poziomów z każdą rolą przypisaną.',
    },
    tool: { href: '/architecture', label: { en: 'Architecture matrix', pl: 'Macierz architektury' } } },
  { id: 'arch-002', pillar: 'architecture', weight: 2,
    question: {
      en: 'Are job descriptions consistent in format across the organisation?',
      pl: 'Czy opisy stanowisk mają spójny format w całej organizacji?',
    },
    hint: {
      en: 'Same template, same fields filled in for every role.',
      pl: 'Ten sam szablon, te same pola wypełnione dla każdej roli.',
    },
    tool: { href: '/rubric', label: { en: 'Rubric / template', pl: 'Rubryka / szablon' } } },
  { id: 'arch-003', pillar: 'architecture', weight: 3, ref: 'EUPTD Art. 4(3)',
    question: {
      en: 'Does each JD address the four EUPTD criteria (Skills, Effort, Responsibility, Working Conditions)?',
      pl: 'Czy każdy opis stanowiska uwzględnia cztery kryteria EUPTD (Umiejętności, Wysiłek, Odpowiedzialność, Warunki pracy)?',
    },
    hint: {
      en: 'Run an audit report on a sample of JDs to verify.',
      pl: 'Uruchom raport audytu na próbce opisów stanowisk, aby zweryfikować.',
    },
    tool: { href: '/jd', label: { en: 'JD hub', pl: 'Centrum JD' } } },
  { id: 'arch-004', pillar: 'architecture', weight: 2,
    question: {
      en: 'Do you use objective, gender-neutral criteria for grading and progression?',
      pl: 'Czy stosują Państwo obiektywne, neutralne pod względem płci kryteria klasyfikacji i awansu?',
    },
    hint: {
      en: 'EIGE / ILO 4-factor framework: Skills, Effort, Responsibility, Working Conditions.',
      pl: 'Ramy 4-czynnikowe EIGE / ILO: Umiejętności, Wysiłek, Odpowiedzialność, Warunki pracy.',
    } },
  { id: 'arch-005', pillar: 'architecture', weight: 2,
    question: {
      en: 'Are career paths defined and visible across families?',
      pl: 'Czy ścieżki kariery są zdefiniowane i widoczne pomiędzy rodzinami?',
    },
    hint: {
      en: 'Employees should see how to progress vertically (up a level) and laterally (to another family).',
      pl: 'Pracownicy powinni widzieć, jak awansować pionowo (o poziom wyżej) i poziomo (do innej rodziny).',
    } },
  { id: 'arch-006', pillar: 'architecture', weight: 2,
    question: {
      en: 'Are there clear position codes that uniquely identify each role?',
      pl: 'Czy istnieją jasne kody stanowisk, które jednoznacznie identyfikują każdą rolę?',
    },
    hint: {
      en: 'e.g. HRCB0501 = HR Compensation & Benefits, level 5, slot 1.',
      pl: 'np. HRCB0501 = HR Wynagrodzenia i Benefity, poziom 5, miejsce 1.',
    },
    tool: { href: '/architecture', label: { en: 'Position codes', pl: 'Kody stanowisk' } } },
  { id: 'arch-007', pillar: 'architecture', weight: 1,
    question: {
      en: 'Do you map jobs to ESCO or another international taxonomy?',
      pl: 'Czy mapują Państwo stanowiska na ESCO lub inną międzynarodową taksonomię?',
    },
    hint: {
      en: 'Helps cross-employer comparability for "work of equal value" tests.',
      pl: 'Ułatwia porównywanie międzypracodawcze w testach „pracy o równej wartości".',
    } },
  { id: 'arch-008', pillar: 'architecture', weight: 2,
    question: {
      en: 'Is your architecture reviewed at least annually?',
      pl: 'Czy Państwa architektura jest przeglądana przynajmniej raz w roku?',
    },
    hint: {
      en: 'New roles, retired roles, scope changes — without review, drift sets in.',
      pl: 'Nowe role, wycofane role, zmiany zakresu — bez przeglądu pojawia się dryf.',
    } },

  // ── Pay equity (8) ────────────────────────────────────────────────────────
  { id: 'pay-001', pillar: 'pay_equity', weight: 3, ref: 'EUPTD Art. 9',
    question: {
      en: 'Have you completed a pay-gap analysis at least once in the past 12 months?',
      pl: 'Czy przeprowadzili Państwo analizę luki płacowej w ciągu ostatnich 12 miesięcy?',
    },
    hint: {
      en: 'Required reporting starts in 2027 based on 2026 data — start now.',
      pl: 'Obowiązkowe raportowanie startuje w 2027 r. na danych z 2026 r. — zacząć trzeba teraz.',
    } },
  { id: 'pay-002', pillar: 'pay_equity', weight: 3,
    question: {
      en: 'Have you grouped jobs into pay bands of "equal value"?',
      pl: 'Czy pogrupowali Państwo stanowiska w pasma płacowe „równej wartości"?',
    },
    hint: {
      en: 'Equal-value clusters per Article 4(4). Single-source comparability test (Tesco C-624/19).',
      pl: 'Klastry równej wartości zgodnie z Art. 4(4). Test pojedynczego źródła (Tesco C-624/19).',
    },
    tool: { href: '/pay-groups', label: { en: 'Pay groups', pl: 'Grupy płacowe' } } },
  { id: 'pay-003', pillar: 'pay_equity', weight: 3, ref: 'EUPTD Art. 9',
    question: {
      en: 'Can you explain any gender pay gap > 5% within an equal-value cluster?',
      pl: 'Czy są Państwo w stanie wyjaśnić jakąkolwiek lukę płacową > 5% w klastrze równej wartości?',
    },
    hint: {
      en: 'EUPTD requires a documented justification + remediation plan above 5%.',
      pl: 'EUPTD wymaga udokumentowanego uzasadnienia + planu naprawczego powyżej 5%.',
    } },
  { id: 'pay-004', pillar: 'pay_equity', weight: 2,
    question: {
      en: 'Do you include all reward components (base, bonus, pension, allowances, benefits) in pay-equity analysis?',
      pl: 'Czy uwzględniają Państwo wszystkie składniki wynagrodzenia (podstawa, premia, emerytura, dodatki, świadczenia) w analizie?',
    },
    hint: {
      en: 'EUPTD definition of "pay" is broad — bonuses-excluded analysis (Birmingham line) does not pass.',
      pl: 'Definicja „wynagrodzenia" w EUPTD jest szeroka — analiza bez premii (linia Birmingham) nie wystarczy.',
    } },
  { id: 'pay-005', pillar: 'pay_equity', weight: 2,
    question: {
      en: 'Do you publish salary ranges in all job advertisements?',
      pl: 'Czy publikują Państwo widełki wynagrodzeń we wszystkich ogłoszeniach o pracę?',
    },
    hint: {
      en: 'EUPTD Art. 5 — pre-employment transparency. Today: 60% of employers; target: 94%.',
      pl: 'EUPTD Art. 5 — przejrzystość przed zatrudnieniem. Dziś: 60% pracodawców; cel: 94%.',
    } },
  { id: 'pay-006', pillar: 'pay_equity', weight: 2,
    question: {
      en: 'Have you established starting-salary policies that prevent prior-pay anchoring?',
      pl: 'Czy ustanowili Państwo politykę wynagrodzeń początkowych, która zapobiega zakotwiczaniu na poprzednim wynagrodzeniu?',
    },
    hint: {
      en: 'Asking about salary history perpetuates the gap. Many EU countries now ban it.',
      pl: 'Pytanie o historię wynagrodzeń utrwala lukę. Wiele krajów UE już tego zakazuje.',
    } },
  { id: 'pay-007', pillar: 'pay_equity', weight: 1,
    question: {
      en: 'Are bonus and variable-pay decisions documented with objective criteria?',
      pl: 'Czy decyzje dotyczące premii i wynagrodzenia zmiennego są udokumentowane obiektywnymi kryteriami?',
    },
    hint: {
      en: 'Variable pay is the most common source of unexplained gaps.',
      pl: 'Wynagrodzenie zmienne to najczęstsze źródło niewyjaśnionych luk.',
    } },
  { id: 'pay-008', pillar: 'pay_equity', weight: 1,
    question: {
      en: 'Do you have a budget set aside for pay corrections?',
      pl: 'Czy wydzielili Państwo budżet na korekty wynagrodzeń?',
    },
    hint: {
      en: 'Audits without a fix budget are theatre. Plan ~0.5–1.5% of payroll.',
      pl: 'Audyt bez budżetu na korektę to teatr. Zaplanować ~0,5–1,5% płac.',
    } },

  // ── Policy (7) ────────────────────────────────────────────────────────────
  { id: 'pol-001', pillar: 'policy', weight: 3, ref: 'EUPTD Art. 7',
    question: {
      en: 'Do your policies expressly permit employees to discuss pay?',
      pl: 'Czy Państwa polityka wyraźnie pozwala pracownikom omawiać wynagrodzenia?',
    },
    hint: {
      en: 'EUPTD Art. 7 prohibits pay-secrecy clauses. Audit and remove any.',
      pl: 'EUPTD Art. 7 zakazuje klauzul tajności wynagrodzeń. Sprawdzić i usunąć.',
    } },
  { id: 'pol-002', pillar: 'policy', weight: 3, ref: 'EUPTD Art. 7',
    question: {
      en: 'Can employees request information on pay levels for their role and equal-value roles?',
      pl: 'Czy pracownicy mogą żądać informacji o poziomach wynagrodzeń dla ich roli i ról o równej wartości?',
    },
    hint: {
      en: 'Right of request applies regardless of company size. Have a documented response process.',
      pl: 'Prawo do informacji obowiązuje niezależnie od wielkości firmy. Udokumentować proces odpowiedzi.',
    } },
  { id: 'pol-003', pillar: 'policy', weight: 2,
    question: {
      en: 'Are progression criteria documented and gender-neutral?',
      pl: 'Czy kryteria awansu są udokumentowane i neutralne pod względem płci?',
    },
    hint: {
      en: 'EUPTD Art. 6 — career progression criteria must be transparent and objective.',
      pl: 'EUPTD Art. 6 — kryteria awansu muszą być przejrzyste i obiektywne.',
    } },
  { id: 'pol-004', pillar: 'policy', weight: 2,
    question: {
      en: 'Do you have a documented remediation policy for unjustified pay gaps?',
      pl: 'Czy istnieje udokumentowana polityka naprawcza dla nieuzasadnionych luk płacowych?',
    },
    hint: {
      en: 'Required when any cluster shows a gap > 5%.',
      pl: 'Wymagana, gdy jakikolwiek klaster wykazuje lukę > 5%.',
    } },
  { id: 'pol-005', pillar: 'policy', weight: 2,
    question: {
      en: 'Is your hiring process documented to prevent salary-history bias?',
      pl: 'Czy proces rekrutacji jest udokumentowany, aby zapobiec uprzedzeniom związanym z historią wynagrodzeń?',
    },
    hint: {
      en: 'Forbid candidate salary-history questions. Anchor offers to range, not previous pay.',
      pl: 'Zakazać pytań o historię wynagrodzeń kandydatów. Kotwiczyć oferty na widełkach, nie poprzedniej pensji.',
    } },
  { id: 'pol-006', pillar: 'policy', weight: 1,
    question: {
      en: 'Do JDs use gender-neutral language (titles paired or neutral, no biased adjectives)?',
      pl: 'Czy opisy stanowisk używają neutralnej językowo formy (tytuły sparowane lub neutralne, bez nacechowanych przymiotników)?',
    },
    hint: {
      en: 'Check via the bias scanner. PL: "specjalista / specjalistka", "osoba na stanowisku".',
      pl: 'Sprawdzać skanerem uprzedzeń. PL: „specjalista / specjalistka", „osoba na stanowisku".',
    },
    tool: { href: '/v5/bias-check', label: { en: 'Bias check', pl: 'Skaner uprzedzeń' } } },
  { id: 'pol-007', pillar: 'policy', weight: 1,
    question: {
      en: 'Have you communicated the new EUPTD timeline to managers and HRBPs?',
      pl: 'Czy poinformowali Państwo menedżerów i HR Business Partnerów o nowym harmonogramie EUPTD?',
    },
    hint: {
      en: 'June 2026 directive in force; first reporting 2027 based on 2026 data.',
      pl: 'Czerwiec 2026: dyrektywa w mocy; pierwsze raportowanie 2027 na danych z 2026 r.',
    } },

  // ── People & culture (7) ──────────────────────────────────────────────────
  { id: 'cul-001', pillar: 'culture', weight: 3,
    question: {
      en: 'Do leaders openly discuss pay philosophy with their teams?',
      pl: 'Czy liderzy otwarcie rozmawiają z zespołami o filozofii wynagrodzeń?',
    },
    hint: {
      en: 'Mercer 2024: ~50% of orgs see employee-satisfaction lift from transparent pay talks.',
      pl: 'Mercer 2024: ~50% organizacji widzi wzrost satysfakcji dzięki przejrzystym rozmowom o płacach.',
    } },
  { id: 'cul-002', pillar: 'culture', weight: 3,
    question: {
      en: 'Are managers trained on conducting pay conversations?',
      pl: 'Czy menedżerowie są przeszkoleni w prowadzeniu rozmów o wynagrodzeniach?',
    },
    hint: {
      en: 'Required: how to explain a range, how to defend a level, how to flag a gap upstream.',
      pl: 'Wymagane: jak wytłumaczyć widełki, jak obronić poziom, jak zgłosić lukę wyżej.',
    } },
  { id: 'cul-003', pillar: 'culture', weight: 2,
    question: {
      en: 'Are pay-related decisions audited for bias regularly?',
      pl: 'Czy decyzje dotyczące wynagrodzeń są regularnie audytowane pod kątem uprzedzeń?',
    },
    hint: {
      en: 'Promotions, bonuses, salary reviews — all should run through a fairness lens.',
      pl: 'Awanse, premie, przeglądy wynagrodzeń — wszystkie powinny przechodzić przez filtr uczciwości.',
    } },
  { id: 'cul-004', pillar: 'culture', weight: 2,
    question: {
      en: 'Do candidates see clear salary ranges before / during interviews?',
      pl: 'Czy kandydaci widzą jasne widełki płacowe przed / w trakcie rozmów kwalifikacyjnych?',
    },
    hint: {
      en: '70% of employers (Mercer) agree candidates expect transparency — more than current employees.',
      pl: '70% pracodawców (Mercer): kandydaci oczekują przejrzystości — bardziej niż obecni pracownicy.',
    } },
  { id: 'cul-005', pillar: 'culture', weight: 2,
    question: {
      en: 'Do you have an internal channel for pay-fairness concerns?',
      pl: 'Czy istnieje wewnętrzny kanał zgłaszania problemów dotyczących równości wynagrodzeń?',
    },
    hint: {
      en: 'EUPTD shifts the burden of proof — channels matter for early detection.',
      pl: 'EUPTD przerzuca ciężar dowodu — kanały zgłaszania ważne dla wczesnego wykrywania.',
    } },
  { id: 'cul-006', pillar: 'culture', weight: 1,
    question: {
      en: 'Are pay-equity progress metrics shared with the workforce or in the annual report?',
      pl: 'Czy postępy w zakresie równości wynagrodzeń są dzielone z pracownikami lub w raporcie rocznym?',
    },
    hint: {
      en: 'Public commitment compounds with reporting deadlines from 2027.',
      pl: 'Publiczne zobowiązanie wzmacnia się wraz z terminami raportowania od 2027 r.',
    } },
  { id: 'cul-007', pillar: 'culture', weight: 1,
    question: {
      en: 'Is pay equity tied to executive performance objectives?',
      pl: 'Czy równość wynagrodzeń jest powiązana z celami wynikowymi kadry zarządzającej?',
    },
    hint: {
      en: 'What gets measured at C-level moves. Without a KPI, gaps persist.',
      pl: 'Co mierzone na poziomie zarządu, to się zmienia. Bez KPI luki utrzymują się.',
    } },
];

export type Answer = 'yes' | 'partial' | 'no' | 'na';

const ANSWER_SCORE: Record<Answer, number | null> = {
  yes: 100,
  partial: 50,
  no: 0,
  na: null,        // excluded from denominator
};

export interface PillarRollup {
  pillar: Pillar;
  total: number;
  answered: number;
  yes: number;
  partial: number;
  no: number;
  na: number;
  score: number;        // 0..100, weighted
  status: 'strong' | 'partial' | 'weak' | 'unanswered';
}

export function rollupByPillar(answers: Record<string, Answer>): PillarRollup[] {
  const out: PillarRollup[] = [];
  for (const pillar of Object.keys(PILLAR_META) as Pillar[]) {
    const items = CHECKLIST.filter((i) => i.pillar === pillar);
    let weightedSum = 0;
    let weightedDenom = 0;
    const counts = { yes: 0, partial: 0, no: 0, na: 0, answered: 0 };
    for (const it of items) {
      const a = answers[it.id];
      if (!a) continue;
      counts.answered++;
      counts[a]++;
      const score = ANSWER_SCORE[a];
      if (score === null) continue;
      weightedSum += score * it.weight;
      weightedDenom += 100 * it.weight;
    }
    const score = weightedDenom > 0 ? Math.round((weightedSum / weightedDenom) * 100) : 0;
    const status: PillarRollup['status'] =
      counts.answered === 0 ? 'unanswered' :
      score >= 75 ? 'strong' :
      score >= 50 ? 'partial' :
      'weak';
    out.push({
      pillar, total: items.length, ...counts, score, status,
    });
  }
  return out;
}

export function overallScore(answers: Record<string, Answer>): number {
  const rollups = rollupByPillar(answers);
  const answered = rollups.filter((r) => r.status !== 'unanswered');
  if (answered.length === 0) return 0;
  return Math.round(answered.reduce((a, b) => a + b.score, 0) / answered.length);
}

export function deadline2027Status(): { daysToReporting: number; daysToDirectiveInForce: number } {
  const now = new Date();
  const directive = new Date('2026-06-07T00:00:00Z');
  const reporting = new Date('2027-06-07T00:00:00Z');
  const day = 24 * 60 * 60 * 1000;
  return {
    daysToDirectiveInForce: Math.ceil((directive.getTime() - now.getTime()) / day),
    daysToReporting: Math.ceil((reporting.getTime() - now.getTime()) / day),
  };
}

// ── Industry benchmarks (Mercer 2024-2025) ───────────────────────────────────
export interface Benchmark {
  id: string;
  label: { en: string; pl: string };
  values: Array<{ region: string; pct: number }>;
  source: { en: string; pl: string };
}

export const BENCHMARKS: Benchmark[] = [
  {
    id: 'strategy_implemented',
    label: {
      en: 'Pay-transparency strategy implemented',
      pl: 'Wdrożona strategia przejrzystości wynagrodzeń',
    },
    values: [
      { region: 'EU continental', pct: 7 },
      { region: 'Nordics', pct: 5 },
      { region: 'UK / Ireland', pct: 1 },
    ],
    source: { en: 'Mercer Global Talent Trends 2024-2025', pl: 'Mercer Global Talent Trends 2024-2025' },
  },
  {
    id: 'compliance_driver',
    label: {
      en: 'Compliance is the key driver',
      pl: 'Zgodność z przepisami głównym motywatorem',
    },
    values: [
      { region: 'EU continental', pct: 75 },
      { region: 'Nordics', pct: 83 },
      { region: 'UK / Ireland', pct: 87 },
    ],
    source: { en: 'Mercer Global Talent Trends 2024-2025', pl: 'Mercer Global Talent Trends 2024-2025' },
  },
  {
    id: 'satisfaction_lift',
    label: {
      en: 'Orgs see employee-satisfaction lift from transparency',
      pl: 'Organizacje widzące wzrost satysfakcji dzięki przejrzystości',
    },
    values: [{ region: 'Global', pct: 50 }],
    source: { en: 'Mercer Global Talent Trends 2024-2025', pl: 'Mercer Global Talent Trends 2024-2025' },
  },
  {
    id: 'candidate_expectation',
    label: {
      en: 'Employers agreeing candidates expect transparency',
      pl: 'Pracodawcy zgadzający się, że kandydaci oczekują przejrzystości',
    },
    values: [{ region: 'Global', pct: 70 }],
    source: { en: 'Mercer Global Talent Trends 2024-2025', pl: 'Mercer Global Talent Trends 2024-2025' },
  },
  {
    id: 'salary_range_target',
    label: {
      en: 'Salary-range disclosure at hire (now → 2-year target)',
      pl: 'Ujawnianie widełek przy zatrudnieniu (dziś → cel za 2 lata)',
    },
    values: [{ region: 'Today', pct: 60 }, { region: 'Target', pct: 94 }],
    source: { en: 'Mercer Global Talent Trends 2024-2025', pl: 'Mercer Global Talent Trends 2024-2025' },
  },
];

// ── Cadence / staleness ──────────────────────────────────────────────────────
export const STALENESS_DAYS = 90;

export function isStale(updatedAt: string | Date | null | undefined): boolean {
  if (!updatedAt) return false;
  const d = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
  if (Number.isNaN(d.getTime())) return false;
  const ageDays = (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000);
  return ageDays >= STALENESS_DAYS;
}

export function ageInDays(updatedAt: string | Date | null | undefined): number | null {
  if (!updatedAt) return null;
  const d = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}
