/**
 * Client-side telemetry store — privacy-first (localStorage, never sent to server).
 * Keeps the last 500 events across browser sessions.
 * Used by Analyser, Editor, Compare and Studio.
 */

export type TelemetryKind =
  | 'lint'        // /api/lint
  | 'rewrite'     // /api/rewrite
  | 'compare'     // compare/text
  | 'studio'      // play / render in studio
  | 'notion-sync' // push to Notion
  | 'session-end';

export interface TelemetryEvent {
  id: string;
  ts: number;               // ms since epoch
  kind: TelemetryKind;
  jobTitle?: string;
  score?: number;
  grade?: string;
  delta?: number;
  meta?: Record<string, string | number | boolean | null>;
}

const KEY = 'jdgc_telemetry_v1';
const MAX = 500;

function read(): TelemetryEvent[] {
  if (typeof window === 'undefined') return [];
  try { const raw = window.localStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}

function write(list: TelemetryEvent[]) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX))); } catch { /* quota */ }
}

export function logEvent(ev: Omit<TelemetryEvent, 'id' | 'ts'>): TelemetryEvent {
  const full: TelemetryEvent = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    ...ev,
  };
  const list = read();
  list.push(full);
  write(list);
  return full;
}

export function getEvents(filter?: Partial<Pick<TelemetryEvent, 'kind' | 'jobTitle'>>): TelemetryEvent[] {
  const list = read();
  if (!filter) return list.slice().reverse();
  return list
    .filter(e =>
      (!filter.kind || e.kind === filter.kind) &&
      (!filter.jobTitle || e.jobTitle === filter.jobTitle)
    )
    .reverse();
}

export function clearEvents() { write([]); }

export function summary() {
  const list = read();
  const byKind: Record<string, number> = {};
  let lintCount = 0, lintSum = 0;
  for (const e of list) {
    byKind[e.kind] = (byKind[e.kind] || 0) + 1;
    if (e.kind === 'lint' && typeof e.score === 'number') { lintCount++; lintSum += e.score; }
  }
  return {
    total: list.length,
    byKind,
    avgLintScore: lintCount ? Math.round(lintSum / lintCount) : null,
    oldest: list[0]?.ts || null,
    newest: list[list.length - 1]?.ts || null,
  };
}
