// ── JD Studio — Audio Constants ────────────────────────────────────────────
// Pure constants — no browser API dependencies. Safe to import server-side.

export const SCALES: Record<string, number[]> = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues:      [0, 3, 5, 6, 7, 10],
  chromatic:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const ROOTS: Record<string, number> = {
  C: 261.63,
  D: 293.66,
  E: 329.63,
  F: 349.23,
  G: 392.00,
  A: 440.00,
  B: 493.88,
};

export const DEFAULT_SCALE: keyof typeof SCALES = 'major';
export const DEFAULT_ROOT: keyof typeof ROOTS = 'C';

export const INSTRUMENT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  piano:   { label: 'Piano',   icon: '🎹', color: '#B5A089' },
  strings: { label: 'Strings', icon: '🎻', color: '#4A7A50' },
  guitar:  { label: 'Guitar',  icon: '🎸', color: '#4A5E7A' },
  flute:   { label: 'Flute',   icon: '🪈', color: '#8A7560' },
  organ:   { label: 'Organ',   icon: '🎹', color: '#5C4D3A' },
  bells:   { label: 'Bells',   icon: '🔔', color: '#F6F4EF' },
  cello:   { label: 'Cello',   icon: '🎻', color: '#6A8A7A' },
};
