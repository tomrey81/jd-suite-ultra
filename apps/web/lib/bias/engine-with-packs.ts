/**
 * P0f — analyseBias() variant that overlays opt-in policy packs.
 *
 * Wraps the core engine without modifying it: runs the standard analysis,
 * then merges in additional pack lexicon matches and pack-specific checks.
 */

import { analyseBias } from './engine';
import {
  packLexiconOverlay,
  runPackChecks,
  type PackId,
} from './policy-packs';
import type { BiasFlag, BiasReport, Language, LexiconEntry } from './types';

function compileWordOrRegex(entry: LexiconEntry): RegExp | null {
  try {
    if (entry.patternType === 'regex') {
      return new RegExp(entry.pattern, 'gi');
    }
    const esc = entry.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${esc}\\b`, 'gi');
  } catch {
    return null;
  }
}

function lexicalOverlayFlags(text: string, overlay: LexiconEntry[]): BiasFlag[] {
  const out: BiasFlag[] = [];
  for (const entry of overlay) {
    const re = compileWordOrRegex(entry);
    if (!re) continue;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out.push({
        layer: 'lexical',
        category: entry.codeType,
        severity: entry.severity,
        start: m.index,
        end: m.index + m[0].length,
        matched: m[0],
        pattern: entry.pattern,
        notes: entry.notes,
        source: entry.source,
        remediation:
          entry.codeType === 'agentic'
            ? 'Pack flag — replace with neutral or balanced phrasing.'
            : 'Communal phrasing — usually fine; review only if over-represented.',
      });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return out;
}

export interface BiasReportWithPacks extends BiasReport {
  enabledPacks: PackId[];
  packFlagCount: number;
}

export function analyseBiasWithPacks(
  text: string,
  language: Language,
  packs: PackId[] = [],
): BiasReportWithPacks {
  const base = analyseBias(text, language);
  if (packs.length === 0) {
    return { ...base, enabledPacks: [], packFlagCount: 0 };
  }
  const overlay = packLexiconOverlay(packs, language);
  const overlayFlags = lexicalOverlayFlags(text, overlay);
  const checkFlags = runPackChecks(packs, text, language, base);
  const merged = [...base.flags, ...overlayFlags, ...checkFlags].sort(
    (a, b) => a.start - b.start,
  );
  return {
    ...base,
    flags: merged,
    enabledPacks: packs,
    packFlagCount: overlayFlags.length + checkFlags.length,
  };
}
