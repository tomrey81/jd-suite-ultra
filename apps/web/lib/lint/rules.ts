/**
 * JDGC v1.5 Deterministic Lint Engine
 * 25 rules · 3 categories · weighted scoring (30% / 35% / 35%)
 *
 * Category weights
 *   Structure  30%
 *   Bias       35%
 *   EUPTD      35%
 */

export type Severity = 'info' | 'warn' | 'error';
export type Category = 'structure' | 'bias' | 'euptd';

export interface Finding {
  ruleId: string;
  category: Category;
  severity: Severity;
  message: string;
  suggestion?: string;
  span?: { start: number; end: number; excerpt: string };
}

export interface RuleDef {
  id: string;
  category: Category;
  weight: number; // 0..1 within its category
  label: string;
  description: string;
  check: (text: string, fields?: Record<string, unknown>) => Finding[];
}

// ────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────
const wc = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const has = (t: string, re: RegExp) => re.test(t);
const findAll = (t: string, re: RegExp) => {
  const hits: { start: number; end: number; excerpt: string }[] = [];
  let m: RegExpExecArray | null;
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = g.exec(t)) !== null) {
    hits.push({ start: m.index, end: m.index + m[0].length, excerpt: m[0] });
    if (m.index === g.lastIndex) g.lastIndex++;
  }
  return hits;
};

// ────────────────────────────────────────────────────────────
// STRUCTURE · 8 rules
// ────────────────────────────────────────────────────────────
const STRUCTURE: RuleDef[] = [
  {
    id: 'S01',
    category: 'structure',
    weight: 0.15,
    label: 'Has job title',
    description: 'A clear, single job title must be present.',
    check: (t, f) => {
      const title = String(f?.jobTitle || '').trim();
      if (!title) return [{ ruleId: 'S01', category: 'structure', severity: 'error', message: 'Missing job title', suggestion: 'Add a concise job title (2–6 words).' }];
      if (title.length > 80) return [{ ruleId: 'S01', category: 'structure', severity: 'warn', message: 'Job title too long', suggestion: 'Keep title under 80 characters.' }];
      return [];
    },
  },
  {
    id: 'S02',
    category: 'structure',
    weight: 0.14,
    label: 'Has job purpose',
    description: 'A 1–3 sentence job purpose statement is present.',
    check: (t, f) => {
      const p = String(f?.jobPurpose || '').trim();
      if (!p) return [{ ruleId: 'S02', category: 'structure', severity: 'error', message: 'Missing job purpose' }];
      if (wc(p) < 15) return [{ ruleId: 'S02', category: 'structure', severity: 'warn', message: 'Job purpose too short', suggestion: 'Expand to 1–3 sentences (~15–60 words).' }];
      if (wc(p) > 80) return [{ ruleId: 'S02', category: 'structure', severity: 'warn', message: 'Job purpose too long' }];
      return [];
    },
  },
  {
    id: 'S03',
    category: 'structure',
    weight: 0.15,
    label: 'Has responsibilities list',
    description: 'Responsibilities are present and enumerated (≥3 items).',
    check: (t, f) => {
      const r = String(f?.responsibilities || t || '');
      const bullets = r.split(/\n|•|·|- |\d+\.\s+/).map(s => s.trim()).filter(Boolean);
      if (bullets.length < 3) return [{ ruleId: 'S03', category: 'structure', severity: 'error', message: 'Fewer than 3 responsibilities', suggestion: 'Enumerate at least 3 primary responsibilities.' }];
      if (bullets.length > 15) return [{ ruleId: 'S03', category: 'structure', severity: 'warn', message: 'Too many responsibilities (>15) — consider consolidating.' }];
      return [];
    },
  },
  {
    id: 'S04',
    category: 'structure',
    weight: 0.13,
    label: 'Has minimum education',
    description: 'Explicit minimum education requirement.',
    check: (t, f) => {
      const v = String(f?.minEducation || '').trim();
      if (!v) return [{ ruleId: 'S04', category: 'structure', severity: 'warn', message: 'Missing minimum education' }];
      return [];
    },
  },
  {
    id: 'S05',
    category: 'structure',
    weight: 0.12,
    label: 'Has minimum experience',
    description: 'Years or type of experience required.',
    check: (t, f) => {
      const v = String(f?.minExperience || '').trim();
      if (!v) return [{ ruleId: 'S05', category: 'structure', severity: 'warn', message: 'Missing minimum experience' }];
      return [];
    },
  },
  {
    id: 'S06',
    category: 'structure',
    weight: 0.11,
    label: 'Has reporting line / org unit',
    description: 'Org unit or reporting relationship is described.',
    check: (t, f) => {
      const v = String(f?.orgUnit || '').trim();
      if (!v) return [{ ruleId: 'S06', category: 'structure', severity: 'warn', message: 'Missing org unit / reporting line' }];
      return [];
    },
  },
  {
    id: 'S07',
    category: 'structure',
    weight: 0.10,
    label: 'Reasonable length',
    description: 'Full JD is between 150 and 1200 words.',
    check: (t) => {
      const n = wc(t);
      if (n < 150) return [{ ruleId: 'S07', category: 'structure', severity: 'warn', message: `JD too short (${n} words)`, suggestion: 'Aim for 250–800 words.' }];
      if (n > 1200) return [{ ruleId: 'S07', category: 'structure', severity: 'warn', message: `JD too long (${n} words)`, suggestion: 'Trim to under 1200 words.' }];
      return [];
    },
  },
  {
    id: 'S08',
    category: 'structure',
    weight: 0.10,
    label: 'No raw HTML / markup',
    description: 'Body should not contain HTML tags.',
    check: (t) => {
      const hits = findAll(t, /<\/?[a-z][^>]*>/gi);
      if (hits.length > 0) return [{ ruleId: 'S08', category: 'structure', severity: 'warn', message: `${hits.length} HTML tag(s) detected`, suggestion: 'Strip markup before import.', span: hits[0] }];
      return [];
    },
  },
];

// ────────────────────────────────────────────────────────────
// BIAS · 9 rules
// ────────────────────────────────────────────────────────────
const GENDERED_MASC = [
  'rockstar', 'ninja', 'guru', 'wizard', 'dominant', 'aggressive', 'assertive',
  'competitive', 'fearless', 'decisive', 'confident', 'he/him', 'his '
];
const GENDERED_FEM = [
  'nurturing', 'supportive', 'empathetic', 'caring', 'sympathetic',
  'she/her', 'her '
];
const AGE_CODED = ['young', 'youthful', 'recent graduate', 'digital native', 'energetic team', 'fresh perspective'];
const NATIVE_SPEAKER = /\bnative\s+(speaker|english|german|polish)\b/i;
const CORPORATE_JARGON = ['synergize', 'rockstar', 'ninja', 'guru', 'hit the ground running', 'wear many hats', 'work hard play hard'];
const ABLEIST = ['able-bodied', 'walk the floor', 'stand for long periods without accommodation', 'lift without assistance'];

const BIAS: RuleDef[] = [
  {
    id: 'B01',
    category: 'bias',
    weight: 0.14,
    label: 'Masculine-coded words',
    description: 'Detects words shown to skew male applicant interest.',
    check: (t) => {
      const hits: Finding[] = [];
      const lower = t.toLowerCase();
      for (const w of GENDERED_MASC) {
        if (lower.includes(w)) {
          const idx = lower.indexOf(w);
          hits.push({ ruleId: 'B01', category: 'bias', severity: 'warn', message: `Masculine-coded: "${w}"`, suggestion: 'Replace with neutral language.', span: { start: idx, end: idx + w.length, excerpt: t.substr(idx, w.length) } });
        }
      }
      return hits;
    },
  },
  {
    id: 'B02',
    category: 'bias',
    weight: 0.12,
    label: 'Feminine-coded words',
    description: 'Detects words that may skew female applicant interest.',
    check: (t) => {
      const hits: Finding[] = [];
      const lower = t.toLowerCase();
      for (const w of GENDERED_FEM) {
        if (lower.includes(w)) {
          const idx = lower.indexOf(w);
          hits.push({ ruleId: 'B02', category: 'bias', severity: 'info', message: `Feminine-coded: "${w}"`, suggestion: 'Balance with neutral language.', span: { start: idx, end: idx + w.length, excerpt: t.substr(idx, w.length) } });
        }
      }
      return hits;
    },
  },
  {
    id: 'B03',
    category: 'bias',
    weight: 0.13,
    label: 'Age-coded language',
    description: 'Phrases suggesting age preference.',
    check: (t) => {
      const hits: Finding[] = [];
      const lower = t.toLowerCase();
      for (const w of AGE_CODED) {
        if (lower.includes(w)) {
          const idx = lower.indexOf(w);
          hits.push({ ruleId: 'B03', category: 'bias', severity: 'error', message: `Age-coded: "${w}"`, suggestion: 'Remove age-related language.', span: { start: idx, end: idx + w.length, excerpt: t.substr(idx, w.length) } });
        }
      }
      return hits;
    },
  },
  {
    id: 'B04',
    category: 'bias',
    weight: 0.12,
    label: 'Native-speaker requirement',
    description: 'Avoid "native speaker" — use proficiency levels instead.',
    check: (t) => {
      const m = t.match(NATIVE_SPEAKER);
      if (m) {
        const idx = t.toLowerCase().search(NATIVE_SPEAKER);
        return [{ ruleId: 'B04', category: 'bias', severity: 'error', message: 'Native-speaker requirement detected', suggestion: 'Use CEFR level (e.g., C1 / Proficient).', span: { start: idx, end: idx + m[0].length, excerpt: m[0] } }];
      }
      return [];
    },
  },
  {
    id: 'B05',
    category: 'bias',
    weight: 0.10,
    label: 'Corporate jargon',
    description: 'Vague or performative jargon.',
    check: (t) => {
      const hits: Finding[] = [];
      const lower = t.toLowerCase();
      for (const w of CORPORATE_JARGON) {
        if (lower.includes(w)) hits.push({ ruleId: 'B05', category: 'bias', severity: 'info', message: `Jargon: "${w}"`, suggestion: 'Use plain language.' });
      }
      return hits;
    },
  },
  {
    id: 'B06',
    category: 'bias',
    weight: 0.11,
    label: 'Ableist language',
    description: 'Language that may exclude disabled applicants.',
    check: (t) => {
      const hits: Finding[] = [];
      const lower = t.toLowerCase();
      for (const w of ABLEIST) {
        if (lower.includes(w)) hits.push({ ruleId: 'B06', category: 'bias', severity: 'error', message: `Ableist phrase: "${w}"`, suggestion: 'Reframe with functional requirements + reasonable accommodation.' });
      }
      return hits;
    },
  },
  {
    id: 'B07',
    category: 'bias',
    weight: 0.10,
    label: 'Gendered pronouns in body',
    description: 'Detects "he/she" / "he or she" usage.',
    check: (t) => {
      const re = /\b(he\/she|he or she|she or he|s\/he)\b/gi;
      const hits = findAll(t, re);
      return hits.map(h => ({ ruleId: 'B07', category: 'bias' as const, severity: 'warn' as const, message: `Gendered pronoun: "${h.excerpt}"`, suggestion: 'Use "they" or rewrite.', span: h }));
    },
  },
  {
    id: 'B08',
    category: 'bias',
    weight: 0.09,
    label: 'Unnecessary degree requirements',
    description: 'Flags PhD/Master requirements where skills may suffice.',
    check: (t, f) => {
      const edu = String(f?.minEducation || '').toLowerCase();
      if (/phd|doctorate|doktor/.test(edu)) return [{ ruleId: 'B08', category: 'bias', severity: 'info', message: 'PhD required — confirm essential.', suggestion: 'Consider "PhD or equivalent experience".' }];
      return [];
    },
  },
  {
    id: 'B09',
    category: 'bias',
    weight: 0.09,
    label: 'Excessive years of experience',
    description: 'Detects ">10 years" or similar.',
    check: (t, f) => {
      const exp = String(f?.minExperience || t || '');
      const m = exp.match(/(\d+)\s*\+?\s*(years|lat)/i);
      if (m && parseInt(m[1], 10) > 10) return [{ ruleId: 'B09', category: 'bias', severity: 'warn', message: `${m[1]}+ years required`, suggestion: 'Re-evaluate whether >10 years is truly essential.' }];
      return [];
    },
  },
];

// ────────────────────────────────────────────────────────────
// EUPTD · 8 rules  (EU Pay Transparency Directive 2023/970)
// ────────────────────────────────────────────────────────────
const EUPTD: RuleDef[] = [
  {
    id: 'E01',
    category: 'euptd',
    weight: 0.15,
    label: 'Pay range disclosed',
    description: 'EUPTD Art. 5: salary range must be disclosed to candidates.',
    check: (t, f) => {
      const s = JSON.stringify(f || {}) + ' ' + t;
      if (!/€|eur|pln|zł|salary|wynagrodzenie|pay range|compensation/i.test(s)) {
        return [{ ruleId: 'E01', category: 'euptd', severity: 'error', message: 'No salary range detected', suggestion: 'EUPTD requires initial pay range disclosure by 2026-06-07.' }];
      }
      return [];
    },
  },
  {
    id: 'E02',
    category: 'euptd',
    weight: 0.13,
    label: 'Gender-neutral title',
    description: 'Job titles must not be gendered.',
    check: (t, f) => {
      const title = String(f?.jobTitle || '').toLowerCase();
      if (/\b(salesman|saleswoman|chairman|foreman|waitress|stewardess|manageress|mistress)\b/.test(title)) {
        return [{ ruleId: 'E02', category: 'euptd', severity: 'error', message: 'Gendered job title', suggestion: 'Use gender-neutral equivalent (e.g. Salesperson, Chairperson).' }];
      }
      return [];
    },
  },
  {
    id: 'E03',
    category: 'euptd',
    weight: 0.13,
    label: 'Objective, gender-neutral criteria',
    description: 'EUPTD Art. 4: criteria for work value must be objective and gender-neutral.',
    check: (t) => {
      const hits: Finding[] = [];
      const subjective = ['cultural fit', 'team player vibe', 'likeable', 'personality match'];
      for (const s of subjective) {
        if (t.toLowerCase().includes(s)) hits.push({ ruleId: 'E03', category: 'euptd', severity: 'warn', message: `Subjective criterion: "${s}"`, suggestion: 'Replace with measurable competency.' });
      }
      return hits;
    },
  },
  {
    id: 'E04',
    category: 'euptd',
    weight: 0.12,
    label: 'Work value factors present',
    description: 'Skills, effort, responsibility, working conditions (4 factors).',
    check: (t, f) => {
      const s = JSON.stringify(f || {}) + ' ' + t;
      const missing: string[] = [];
      if (!/skill|competenc|knowledge/i.test(s)) missing.push('skills');
      if (!/effort|complexit|problem/i.test(s)) missing.push('effort');
      if (!/responsib|accountab|authorit/i.test(s)) missing.push('responsibility');
      if (!/working condition|environment|physical/i.test(s)) missing.push('working conditions');
      if (missing.length > 0) return [{ ruleId: 'E04', category: 'euptd', severity: 'warn', message: `Missing work-value factor(s): ${missing.join(', ')}`, suggestion: 'EUPTD Art. 4 requires all four factors.' }];
      return [];
    },
  },
  {
    id: 'E05',
    category: 'euptd',
    weight: 0.12,
    label: 'No salary history requirement',
    description: 'EUPTD Art. 5(2): employers may not ask about pay history.',
    check: (t) => {
      if (/salary history|current salary|pay history|previous compensation/i.test(t)) {
        return [{ ruleId: 'E05', category: 'euptd', severity: 'error', message: 'Pay-history request detected', suggestion: 'Remove — prohibited under EUPTD Art. 5(2).' }];
      }
      return [];
    },
  },
  {
    id: 'E06',
    category: 'euptd',
    weight: 0.12,
    label: 'Transparent career progression',
    description: 'EUPTD Art. 6: criteria for progression must be accessible.',
    check: (t, f) => {
      const s = JSON.stringify(f || {}) + ' ' + t;
      if (!/career|progression|promotion|development|grade/i.test(s)) {
        return [{ ruleId: 'E06', category: 'euptd', severity: 'info', message: 'No progression criteria described', suggestion: 'Add career-path or grade-advancement note.' }];
      }
      return [];
    },
  },
  {
    id: 'E07',
    category: 'euptd',
    weight: 0.12,
    label: 'Proposed grade present',
    description: 'Grade or job level must be set for EUPTD pay-group clustering.',
    check: (t, f) => {
      const v = String(f?.proposedGrade || '').trim();
      if (!v) return [{ ruleId: 'E07', category: 'euptd', severity: 'warn', message: 'No proposed grade set', suggestion: 'Set a grade to enable pay-group comparisons.' }];
      return [];
    },
  },
  {
    id: 'E08',
    category: 'euptd',
    weight: 0.11,
    label: 'Language compliance',
    description: 'JD should be in the local language of posting.',
    check: (t, f) => {
      const lang = String(f?.languageReqs || '').toLowerCase();
      if (lang && !/polish|english|german|czech|slovak|hungarian/i.test(lang)) {
        return [{ ruleId: 'E08', category: 'euptd', severity: 'info', message: 'Unusual language requirement', suggestion: 'Confirm local-language version exists.' }];
      }
      return [];
    },
  },
];

// ────────────────────────────────────────────────────────────
// Rule registry
// ────────────────────────────────────────────────────────────
export const RULES: RuleDef[] = [...STRUCTURE, ...BIAS, ...EUPTD];

export function getRules(category?: Category): RuleDef[] {
  return category ? RULES.filter(r => r.category === category) : RULES;
}
