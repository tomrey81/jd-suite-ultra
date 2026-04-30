/**
 * Synthesized theme music — Web Audio API only, no external files, no copyright.
 *
 * Each theme is encoded as a sequence of notes. We keep them short (8–20 seconds),
 * recognisable, and public-domain or original.
 */

// Note frequencies (A4 = 440 Hz) — equal temperament
const NOTE: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
};

interface ThemeNote {
  /** Note name like "C4", "E5", or "rest" */
  note: string;
  /** Duration in beats */
  beats: number;
}

export interface Theme {
  id: string;
  name: string;
  composer: string;
  description: string;
  /** Beats per minute */
  tempo: number;
  /** Public domain / original */
  source: 'public_domain' | 'original';
  notes: ThemeNote[];
}

// ── Ode to Joy (Beethoven, Symphony No. 9, 1824 — public domain) ──
const ODE_TO_JOY: ThemeNote[] = [
  { note: 'E4', beats: 1 }, { note: 'E4', beats: 1 }, { note: 'F4', beats: 1 }, { note: 'G4', beats: 1 },
  { note: 'G4', beats: 1 }, { note: 'F4', beats: 1 }, { note: 'E4', beats: 1 }, { note: 'D4', beats: 1 },
  { note: 'C4', beats: 1 }, { note: 'C4', beats: 1 }, { note: 'D4', beats: 1 }, { note: 'E4', beats: 1 },
  { note: 'E4', beats: 1.5 }, { note: 'D4', beats: 0.5 }, { note: 'D4', beats: 2 },
  { note: 'E4', beats: 1 }, { note: 'E4', beats: 1 }, { note: 'F4', beats: 1 }, { note: 'G4', beats: 1 },
  { note: 'G4', beats: 1 }, { note: 'F4', beats: 1 }, { note: 'E4', beats: 1 }, { note: 'D4', beats: 1 },
  { note: 'C4', beats: 1 }, { note: 'C4', beats: 1 }, { note: 'D4', beats: 1 }, { note: 'E4', beats: 1 },
  { note: 'D4', beats: 1.5 }, { note: 'C4', beats: 0.5 }, { note: 'C4', beats: 2 },
];

// ── Eine kleine Nachtmusik opening (Mozart, 1787 — public domain) ──
const EINE_KLEINE: ThemeNote[] = [
  { note: 'G4', beats: 0.5 }, { note: 'D4', beats: 0.5 }, { note: 'G4', beats: 0.5 }, { note: 'D4', beats: 0.5 },
  { note: 'G4', beats: 0.25 }, { note: 'D4', beats: 0.25 }, { note: 'G4', beats: 0.25 }, { note: 'B4', beats: 0.25 }, { note: 'D5', beats: 1 },
  { note: 'C5', beats: 0.5 }, { note: 'A4', beats: 0.5 }, { note: 'C5', beats: 0.5 }, { note: 'A4', beats: 0.5 },
  { note: 'C5', beats: 0.25 }, { note: 'A4', beats: 0.25 }, { note: 'C5', beats: 0.25 }, { note: 'F5', beats: 0.25 }, { note: 'A5', beats: 1 },
];

// ── In the Hall of the Mountain King (Grieg, 1875 — public domain) ──
const MOUNTAIN_KING: ThemeNote[] = [
  { note: 'B3', beats: 0.5 }, { note: 'C4', beats: 0.5 }, { note: 'D4', beats: 0.5 }, { note: 'E4', beats: 0.5 },
  { note: 'F4', beats: 0.5 }, { note: 'D4', beats: 0.5 }, { note: 'F4', beats: 1 },
  { note: 'E4', beats: 0.5 }, { note: 'C4', beats: 0.5 }, { note: 'E4', beats: 1 },
  { note: 'B3', beats: 0.5 }, { note: 'C4', beats: 0.5 }, { note: 'D4', beats: 0.5 }, { note: 'E4', beats: 0.5 },
  { note: 'F4', beats: 0.5 }, { note: 'D4', beats: 0.5 }, { note: 'F4', beats: 0.5 }, { note: 'E4', beats: 0.5 },
];

// ── Pachelbel's Canon — opening bass line (Pachelbel, ~1680 — public domain) ──
const PACHELBEL: ThemeNote[] = [
  { note: 'D4', beats: 1 }, { note: 'A3', beats: 1 }, { note: 'B3', beats: 1 }, { note: 'F4', beats: 1 },
  { note: 'G4', beats: 1 }, { note: 'D4', beats: 1 }, { note: 'G4', beats: 1 }, { note: 'A4', beats: 1 },
  { note: 'D4', beats: 1 }, { note: 'A3', beats: 1 }, { note: 'B3', beats: 1 }, { note: 'F4', beats: 1 },
  { note: 'G4', beats: 1 }, { note: 'D4', beats: 1 }, { note: 'G4', beats: 1 }, { note: 'A4', beats: 1 },
];

// ── William Tell Overture, gallop motif (Rossini, 1829 — public domain) ──
const WILLIAM_TELL: ThemeNote[] = [
  { note: 'E4', beats: 0.25 }, { note: 'E4', beats: 0.25 }, { note: 'E4', beats: 0.5 },
  { note: 'E4', beats: 0.25 }, { note: 'E4', beats: 0.25 }, { note: 'E4', beats: 0.5 },
  { note: 'E4', beats: 0.25 }, { note: 'G4', beats: 0.25 }, { note: 'C5', beats: 0.5 }, { note: 'E4', beats: 0.5 }, { note: 'G4', beats: 1 },
  { note: 'D4', beats: 0.25 }, { note: 'D4', beats: 0.25 }, { note: 'D4', beats: 0.5 },
  { note: 'D4', beats: 0.25 }, { note: 'D4', beats: 0.25 }, { note: 'D4', beats: 0.5 },
];

// ── Greensleeves opening (anon., 16th century — public domain) ──
const GREENSLEEVES: ThemeNote[] = [
  { note: 'A3', beats: 1.5 }, { note: 'C4', beats: 0.5 }, { note: 'D4', beats: 1 }, { note: 'E4', beats: 1.5 },
  { note: 'F4', beats: 0.5 }, { note: 'E4', beats: 1 }, { note: 'D4', beats: 1.5 }, { note: 'B3', beats: 0.5 },
  { note: 'G3', beats: 1 }, { note: 'A3', beats: 1.5 }, { note: 'B3', beats: 0.5 }, { note: 'C4', beats: 1 }, { note: 'A3', beats: 2 },
];

// ── Original "Boardroom Fanfare" — short triumphant flourish ──
const FANFARE: ThemeNote[] = [
  { note: 'C4', beats: 0.5 }, { note: 'E4', beats: 0.5 }, { note: 'G4', beats: 0.5 }, { note: 'C5', beats: 1.5 },
  { note: 'B4', beats: 0.25 }, { note: 'C5', beats: 0.75 }, { note: 'D5', beats: 0.5 }, { note: 'E5', beats: 1 },
  { note: 'D5', beats: 0.5 }, { note: 'C5', beats: 0.5 }, { note: 'G4', beats: 1 }, { note: 'C5', beats: 2 },
];

// ── Original "Calm Reflection" — soft introspective theme ──
const CALM_REFLECTION: ThemeNote[] = [
  { note: 'A3', beats: 1 }, { note: 'C4', beats: 1 }, { note: 'E4', beats: 1.5 }, { note: 'D4', beats: 0.5 },
  { note: 'C4', beats: 1 }, { note: 'B3', beats: 1 }, { note: 'A3', beats: 2 },
  { note: 'A3', beats: 1 }, { note: 'C4', beats: 1 }, { note: 'F4', beats: 1.5 }, { note: 'E4', beats: 0.5 },
  { note: 'D4', beats: 1 }, { note: 'C4', beats: 1 }, { note: 'A3', beats: 2 },
];

export const THEMES: Theme[] = [
  {
    id: 'ode_to_joy',
    name: 'Ode to Joy',
    composer: 'Beethoven, Symphony No. 9 (1824)',
    description: 'Triumphant European theme — fits approval moments and finalised JDs.',
    tempo: 100,
    source: 'public_domain',
    notes: ODE_TO_JOY,
  },
  {
    id: 'eine_kleine',
    name: 'Eine kleine Nachtmusik',
    composer: 'Mozart (1787)',
    description: 'Energetic, sophisticated — opening bars. Fits draft → review transitions.',
    tempo: 130,
    source: 'public_domain',
    notes: EINE_KLEINE,
  },
  {
    id: 'mountain_king',
    name: 'In the Hall of the Mountain King',
    composer: 'Grieg (1875)',
    description: 'Building suspense, staccato — fits restructuring or workforce transitions.',
    tempo: 120,
    source: 'public_domain',
    notes: MOUNTAIN_KING,
  },
  {
    id: 'pachelbel',
    name: 'Pachelbel\u2019s Canon',
    composer: 'Pachelbel (~1680)',
    description: 'Repeating ground bass — meditative, fits long review cycles.',
    tempo: 60,
    source: 'public_domain',
    notes: PACHELBEL,
  },
  {
    id: 'william_tell',
    name: 'William Tell — gallop',
    composer: 'Rossini (1829)',
    description: 'Fast, urgent — fits sprint kickoffs and time-pressured reviews.',
    tempo: 160,
    source: 'public_domain',
    notes: WILLIAM_TELL,
  },
  {
    id: 'greensleeves',
    name: 'Greensleeves',
    composer: 'Anonymous (16th c.)',
    description: 'Reflective ballad — fits long-term archival or end-of-cycle moments.',
    tempo: 80,
    source: 'public_domain',
    notes: GREENSLEEVES,
  },
  {
    id: 'fanfare',
    name: 'Boardroom Fanfare',
    composer: 'Original',
    description: 'Short triumphant flourish — fits approvals and finalisation.',
    tempo: 110,
    source: 'original',
    notes: FANFARE,
  },
  {
    id: 'calm_reflection',
    name: 'Calm Reflection',
    composer: 'Original',
    description: 'Soft introspective theme — fits review and contemplation.',
    tempo: 70,
    source: 'original',
    notes: CALM_REFLECTION,
  },
];

/**
 * Schedule a theme on an AudioContext at a given start time.
 *
 * @param ctx - The AudioContext to schedule on
 * @param theme - The Theme to play
 * @param startTime - When to start (ctx.currentTime + offset)
 * @param destination - Destination node (defaults to ctx.destination)
 * @param volume - 0..1 (default 0.3 — themes should be background-ish)
 * @returns Total duration of the theme in seconds
 */
export function scheduleTheme(
  ctx: AudioContext | OfflineAudioContext,
  theme: Theme,
  startTime: number,
  destination?: AudioNode,
  volume: number = 0.3,
): number {
  const beatDur = 60 / theme.tempo;
  let offset = 0;
  const dest = destination || ctx.destination;

  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(dest);

  // Slight low-pass for warmth — sounds less harsh
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2800;
  filter.Q.value = 0.7;
  filter.connect(masterGain);

  for (const n of theme.notes) {
    const dur = n.beats * beatDur;
    if (n.note !== 'rest') {
      const freq = NOTE[n.note];
      if (freq != null) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        // Add a soft sine partial for richness (one octave up at low gain)
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;

        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(0, startTime + offset);
        noteGain.gain.linearRampToValueAtTime(0.7, startTime + offset + 0.02);
        noteGain.gain.linearRampToValueAtTime(0.5, startTime + offset + dur * 0.5);
        noteGain.gain.linearRampToValueAtTime(0.001, startTime + offset + dur);

        const noteGain2 = ctx.createGain();
        noteGain2.gain.setValueAtTime(0, startTime + offset);
        noteGain2.gain.linearRampToValueAtTime(0.2, startTime + offset + 0.02);
        noteGain2.gain.linearRampToValueAtTime(0.001, startTime + offset + dur);

        osc.connect(noteGain);
        osc2.connect(noteGain2);
        noteGain.connect(filter);
        noteGain2.connect(filter);

        osc.start(startTime + offset);
        osc.stop(startTime + offset + dur);
        osc2.start(startTime + offset);
        osc2.stop(startTime + offset + dur);
      }
    }
    offset += dur;
  }
  return offset;
}

/** Quick play helper — creates a fresh AudioContext, plays the theme, returns the context for stop control. */
export function playThemeQuick(theme: Theme, volume: number = 0.3): { ctx: AudioContext; duration: number } {
  const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new Ctor();
  const duration = scheduleTheme(ctx, theme, ctx.currentTime, undefined, volume);
  return { ctx, duration };
}

export function themeDuration(theme: Theme): number {
  const beatDur = 60 / theme.tempo;
  return theme.notes.reduce((sum, n) => sum + n.beats * beatDur, 0);
}
