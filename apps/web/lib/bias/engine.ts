// JD Suite v5 — bias engine. Spec §9 + §11.

import { getLexicon } from './loader';
import type { BiasFlag, BiasReport, Language, LexiconCategory, LexiconEntry } from './types';

const REGEX_FLAGS = 'gi';

interface CompiledEntry {
  entry: LexiconEntry;
  regex: RegExp;
}

const compiledCache = new Map<string, CompiledEntry[]>();

function compile(entries: LexiconEntry[], lang: Language, cat: LexiconCategory): CompiledEntry[] {
  const key = `${lang}:${cat}:${entries.length}`;
  const cached = compiledCache.get(key);
  if (cached) return cached;

  const out: CompiledEntry[] = [];
  for (const e of entries) {
    try {
      let re: RegExp;
      if (e.patternType === 'regex') {
        re = new RegExp(e.pattern, REGEX_FLAGS);
      } else {
        // word: escape + word boundary
        const esc = e.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        re = new RegExp(`\\b${esc}\\b`, REGEX_FLAGS);
      }
      out.push({ entry: e, regex: re });
    } catch {
      // bad regex — skip silently rather than crash the whole linter
    }
  }
  compiledCache.set(key, out);
  return out;
}

function findFlags(text: string, compiled: CompiledEntry[], cat: LexiconCategory): BiasFlag[] {
  const out: BiasFlag[] = [];
  for (const { entry, regex } of compiled) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      out.push({
        layer: 'lexical',
        category: cat,
        severity: entry.severity,
        start: m.index,
        end: m.index + m[0].length,
        matched: m[0],
        pattern: entry.pattern,
        notes: entry.notes,
        source: entry.source,
        remediation: cat === 'agentic'
          ? 'Pair with a communal term, soften, or remove if not essential.'
          : 'Balanced communal language — usually fine, review only if over-represented.',
      });
      // Avoid zero-width infinite loops on dodgy patterns.
      if (m[0].length === 0) regex.lastIndex++;
    }
  }
  return out;
}

// Layer 2: title-pair check. If a Polish title appears as masculine-only or feminine-only,
// flag it (per spec §11.2).
function findTitleFlags(text: string, language: Language): BiasFlag[] {
  const lex = getLexicon(language);
  const out: BiasFlag[] = [];
  for (const tp of lex.titlePairs) {
    const masc = new RegExp(`\\b${escapeRe(tp.masculine)}\\b`, 'gi');
    const fem = new RegExp(`\\b${escapeRe(tp.feminine)}\\b`, 'gi');
    let mascHits: RegExpExecArray[] = [];
    let femHits: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = masc.exec(text)) !== null) mascHits.push(m);
    while ((m = fem.exec(text)) !== null) femHits.push(m);

    if (mascHits.length > 0 && femHits.length === 0) {
      for (const hit of mascHits) {
        out.push({
          layer: 'title',
          category: 'title-singular',
          severity: tp.severityIfSingular,
          start: hit.index,
          end: hit.index + hit[0].length,
          matched: hit[0],
          pattern: tp.masculine,
          notes: `Singular masculine form. Pair with "${tp.feminine}" or use neutral "${tp.neutral}". ${tp.notes}`,
          source: 'pracuj.pl słownik / EIGE',
          remediation: `Use "${tp.masculine} / ${tp.feminine}" or "${tp.neutral}".`,
        });
      }
    } else if (femHits.length > 0 && mascHits.length === 0) {
      for (const hit of femHits) {
        out.push({
          layer: 'title',
          category: 'title-singular',
          severity: tp.severityIfSingular,
          start: hit.index,
          end: hit.index + hit[0].length,
          matched: hit[0],
          pattern: tp.feminine,
          notes: `Singular feminine form. Pair with "${tp.masculine}" or use neutral "${tp.neutral}". ${tp.notes}`,
          source: 'pracuj.pl słownik / EIGE',
          remediation: `Use "${tp.masculine} / ${tp.feminine}" or "${tp.neutral}".`,
        });
      }
    }
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Layer 3 (structural, basic): does the text mention each effort axis (E1/E2/E3)?
function eigeCoverage(text: string, language: Language): BiasReport['eigeCoverage'] {
  const lower = text.toLowerCase();
  const cognitiveTerms = language === 'pl'
    ? ['analiz', 'wnioskowa', 'rozwiąz', 'decyzj', 'kognityw', 'ocenia', 'planowa']
    : ['analy', 'reason', 'cognit', 'judg', 'decision', 'plan', 'problem-solv'];
  const emotionalTerms = language === 'pl'
    ? ['emocj', 'empat', 'troska', 'opieku', 'wspar', 'cierpliw', 'klient', 'pacjent', 'ucze', 'pielęg']
    : ['emotion', 'empath', 'care', 'caring', 'support', 'patient', 'client-facing', 'pupil', 'student'];
  const physicalTerms = language === 'pl'
    ? ['fizyczn', 'dźwiga', 'podnoszenie', 'wysiłek fizyczn', 'manualn', 'stanie', 'siedze']
    : ['physical', 'lift', 'manual', 'standing', 'sitting', 'walking', 'kg', 'lbs', 'mobility'];

  const hits = (terms: string[]) => terms.some((t) => lower.includes(t));
  return {
    cognitive: hits(cognitiveTerms),
    emotional: hits(emotionalTerms),
    physical: hits(physicalTerms),
  };
}

// Layer 4 (implicit, basic): a few signature patterns from Iceland 2024.
function implicitChecks(
  text: string,
  language: Language,
  agenticCount: number,
  communalCount: number,
  eige: BiasReport['eigeCoverage'],
): BiasReport['implicit'] {
  const lower = text.toLowerCase();

  // Macho leadership: agentic-skewed AND no E2 (emotional)
  const machoLeadership = agenticCount >= 4 &&
    (agenticCount - communalCount) / Math.max(1, agenticCount + communalCount) >= 0.4 &&
    !eige.emotional;

  // "Pink job" undervaluation: caring/clerical title + no E2 visible
  const pinkSignals = language === 'pl'
    ? ['pielęgniark', 'opiekunk', 'nauczyciel', 'sekretark', 'recepcjonist', 'kasjer', 'sprzątacz']
    : ['nurse', 'caregiver', 'caretaker', 'teacher', 'receptionist', 'cashier', 'cleaner', 'social worker'];
  const inPinkFamily = pinkSignals.some((s) => lower.includes(s));
  const pinkJobUndervaluation = inPinkFamily && !eige.emotional;

  // Elektromonter trap (Iceland 2024 §11): physical-effort claim that may not match the actual job.
  const elektromonterTrap = language === 'pl'
    ? lower.includes('elektromonter') && (lower.includes('dźwig') || /\b\d{2,3}\s*kg\b/i.test(text))
    : false;

  return { pinkJobUndervaluation, machoLeadership, elektromonterTrap };
}

export function analyseBias(text: string, language: Language): BiasReport {
  const lex = getLexicon(language);
  const agenticCompiled = compile(lex.agentic, language, 'agentic');
  const communalCompiled = compile(lex.communal, language, 'communal');

  const agenticFlags = findFlags(text, agenticCompiled, 'agentic');
  const communalFlags = findFlags(text, communalCompiled, 'communal');
  const titleFlags = findTitleFlags(text, language);

  const agenticCount = agenticFlags.length;
  const communalCount = communalFlags.length;
  const total = agenticCount + communalCount;
  const skewScore = total === 0 ? 0 : (agenticCount - communalCount) / total;
  const absSkew = Math.abs(skewScore);
  const skewLevel: BiasReport['skewLevel'] =
    absSkew < 0.25 ? 'balanced' : absSkew < 0.5 ? 'soft_warn' : 'hard_warn';

  const eige = eigeCoverage(text, language);
  const implicit = implicitChecks(text, language, agenticCount, communalCount, eige);

  return {
    language,
    inputLength: text.length,
    agenticCount,
    communalCount,
    skewScore: Math.round(skewScore * 100) / 100,
    skewLevel,
    flags: [...agenticFlags, ...communalFlags, ...titleFlags].sort((a, b) => a.start - b.start),
    eigeCoverage: eige,
    implicit,
  };
}
