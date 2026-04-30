// JD Suite v5 — lexicon loader. Reads inlined CSV strings (Vercel-safe).
// CSV source-of-truth lives in lib/bias/lexicon/*.csv for human review.
// Per spec §9.3.

import { LEXICON_DATA } from './lexicon-data';
import type { Language, LexiconCategory, LexiconEntry, TitlePair, Severity, PatternType } from './types';

interface LoadedLexicon {
  agentic: LexiconEntry[];
  communal: LexiconEntry[];
  titlePairs: TitlePair[];
}

const cache = new Map<Language, LoadedLexicon>();

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length !== headers.length) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cols[idx]; });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function loadLexiconFor(language: Language): LoadedLexicon {
  const cached = cache.get(language);
  if (cached) return cached;

  const blob = LEXICON_DATA[language] || { agentic: '', communal: '', title_pairs: '' };
  const agenticRaw = parseCSV(blob.agentic || '');
  const communalRaw = parseCSV(blob.communal || '');
  const titleRaw = parseCSV(blob.title_pairs || '');

  const toEntry = (r: Record<string, string>, fallbackCat: LexiconCategory): LexiconEntry => ({
    language: r.language as Language,
    codeType: (r.code_type as LexiconCategory) || fallbackCat,
    patternType: (r.pattern_type as PatternType) || 'word',
    pattern: r.pattern,
    severity: (r.severity as Severity) || 'low',
    notes: r.notes || '',
    source: r.source || 'unknown',
    version: r.version || '1.0',
  });

  const result: LoadedLexicon = {
    agentic: agenticRaw.filter((r) => r.pattern).map((r) => toEntry(r, 'agentic')),
    communal: communalRaw.filter((r) => r.pattern).map((r) => toEntry(r, 'communal')),
    titlePairs: titleRaw.filter((r) => r.masculine || r.feminine).map((r) => ({
      language: r.language as Language,
      masculine: r.masculine,
      feminine: r.feminine,
      neutral: r.neutral || '',
      severityIfSingular: (r.severity_if_singular as Severity) || 'medium',
      notes: r.notes || '',
    })),
  };
  cache.set(language, result);
  return result;
}

export function getLexicon(language: Language): LoadedLexicon {
  return loadLexiconFor(language);
}

export function lexiconVersion(language: Language): string {
  const lex = loadLexiconFor(language);
  const versions = [
    ...lex.agentic.map((e) => e.version),
    ...lex.communal.map((e) => e.version),
  ];
  const counts = `${lex.agentic.length}+${lex.communal.length}+${lex.titlePairs.length}`;
  return `${language}:${[...new Set(versions)].join(',')}:${counts}`;
}
