'use client';

import { useRef, useCallback } from 'react';
import { SCALES, ROOTS } from '@/lib/audio-constants';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PlayOptions {
  instrument?: string;
  scaleKey?: string;
  rootNote?: string;
  speed?: number;      // 0–100 (maps to ms-per-note: 100=very slow, 0=very fast)
  noteDur?: number;    // note sustain in seconds
  volume?: number;     // 0–1
  chordMode?: boolean;
  onProgress?: (frac: number) => void;
  onNote?: (freq: number, midi: number) => void;
  onDone?: () => void;
}

// ── MIDI → frequency ────────────────────────────────────────────────────────

function midiToFreq(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function charToNotes(
  code: number,
  scaleArr: number[],
  rootFreq: number,
  chord: boolean,
): { freqs: number[]; vel: number; midi: number } {
  const deg = code % scaleArr.length;
  const oct = Math.floor(code / scaleArr.length) % 3;
  const semi = Math.log2(rootFreq / 261.63) * 12 + 60;
  const midi = semi + scaleArr[deg] + oct * 12;
  const freq = midiToFreq(midi);
  const vel = 0.4 + ((code % 7) / 6) * 0.6;

  let freqs = [freq];
  if (chord) {
    const t3 = scaleArr[(deg + 2) % scaleArr.length];
    const fi = scaleArr[(deg + 4) % scaleArr.length];
    freqs = [freq, midiToFreq(semi + t3 + oct * 12), midiToFreq(semi + fi + oct * 12)];
  }

  return { freqs, vel, midi };
}

// ── Instrument synthesis ────────────────────────────────────────────────────

function playPiano(ctx: AudioContext, dest: AudioNode, freq: number, vel: number, t: number, dur: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel * 0.6, t + 0.008);
  g.gain.exponentialRampToValueAtTime(vel * 0.35, t + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.12);

  [1, 2, 3, 4.2, 6].forEach((m, i) => {
    const amp = [1, 0.6, 0.35, 0.15, 0.08][i];
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * m;
    const og = ctx.createGain();
    og.gain.value = amp;
    o.connect(og);
    og.connect(g);
    o.start(t);
    o.stop(t + dur + 0.2);
  });

  g.connect(dest);
}

function playStrings(ctx: AudioContext, dest: AudioNode, freq: number, vel: number, t: number, dur: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.09);
  g.gain.setValueAtTime(vel * 0.5, t + dur - 0.06);
  g.gain.linearRampToValueAtTime(0, t + dur + 0.06);

  [1, 2, 3].forEach((m, i) => {
    const amp = [1, 0.4, 0.15][i];
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq * m;
    const og = ctx.createGain();
    og.gain.value = amp * 0.15;
    o.connect(og);
    og.connect(g);
    o.start(t);
    o.stop(t + dur + 0.12);
  });

  g.connect(dest);
}

function playFlute(ctx: AudioContext, dest: AudioNode, freq: number, vel: number, t: number, dur: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel * 0.4, t + 0.06);
  g.gain.setValueAtTime(vel * 0.4, t + dur - 0.04);
  g.gain.linearRampToValueAtTime(0, t + dur + 0.05);

  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  const noise = ctx.createOscillator();
  noise.type = 'sawtooth';
  noise.frequency.value = freq * 4.1;
  const noiseG = ctx.createGain();
  noiseG.gain.value = 0.03;
  noise.connect(noiseG);
  noiseG.connect(g);
  o.connect(g);
  g.connect(dest);
  o.start(t); o.stop(t + dur + 0.1);
  noise.start(t); noise.stop(t + dur + 0.1);
}

function playBell(ctx: AudioContext, dest: AudioNode, freq: number, vel: number, t: number, dur: number) {
  [1, 2.756, 5.404, 8.933].forEach((m, i) => {
    const amp = [1, 0.5, 0.25, 0.1][i];
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * m;
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp * vel * 0.4, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.5 + i * 0.3);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 1.2);
  });
}

function playCello(ctx: AudioContext, dest: AudioNode, freq: number, vel: number, t: number, dur: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel * 0.55, t + 0.12);
  g.gain.setValueAtTime(vel * 0.55, t + dur - 0.05);
  g.gain.linearRampToValueAtTime(0, t + dur + 0.08);

  [1, 2, 3, 4].forEach((m, i) => {
    const amp = [1, 0.5, 0.3, 0.15][i];
    const o = ctx.createOscillator();
    o.type = i === 0 ? 'sawtooth' : 'sine';
    o.frequency.value = freq * m;
    const og = ctx.createGain();
    og.gain.value = amp * 0.2;
    o.connect(og); og.connect(g);
    o.start(t); o.stop(t + dur + 0.15);
  });

  g.connect(dest);
}

type PlayFn = (ctx: AudioContext, dest: AudioNode, freq: number, vel: number, t: number, dur: number) => void;

const INSTRUMENTS: Record<string, PlayFn> = {
  piano:   playPiano,
  strings: playStrings,
  guitar:  playStrings, // simplified alias
  flute:   playFlute,
  organ:   playStrings, // simplified alias
  bells:   playBell,
  cello:   playCello,
};

// ── WAV encoding (no external packages) ────────────────────────────────────

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(buffer.numberOfChannels, 2);
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const numSamples = buffer.length;
  const blockAlign = numChannels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataBytes = numSamples * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(arrayBuffer);

  const ws = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  ws(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ws(8, 'WAVE');
  ws(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  ws(36, 'data');
  view.setUint32(40, dataBytes, true);

  let off = 44;
  const channels = Array.from({ length: numChannels }, (_, ch) => buffer.getChannelData(ch));

  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(off, s < 0 ? s * 32768 : s * 32767, true);
      off += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const getCtx = useCallback((): AudioContext => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const stopPlayback = useCallback(() => {
    stopRef.current = true;
    for (const t of timeoutsRef.current) clearTimeout(t);
    timeoutsRef.current = [];
  }, []);

  const sonify = useCallback(
    (text: string, opts: PlayOptions = {}) => {
      if (!text?.trim()) return;

      const {
        instrument = 'piano',
        scaleKey = 'major',
        rootNote = 'C',
        speed = 50,
        noteDur = 0.18,
        volume = 0.8,
        chordMode = false,
        onProgress,
        onNote,
        onDone,
      } = opts;

      const ctx = getCtx();
      const dest = ctx.destination;
      const scaleArr = SCALES[scaleKey] ?? SCALES.major;
      const rootFreq = ROOTS[rootNote] ?? 440;
      const playFn = INSTRUMENTS[instrument] ?? INSTRUMENTS.piano;
      const msPerNote = Math.max(50, 400 - speed * 3.5);

      stopRef.current = false;
      timeoutsRef.current = [];

      const chars = Array.from(text);
      const total = chars.length;

      chars.forEach((c, i) => {
        const handle = setTimeout(() => {
          if (stopRef.current) return;

          const { freqs, vel } = charToNotes(c.charCodeAt(0), scaleArr, rootFreq, chordMode);
          const t = ctx.currentTime;

          for (const freq of freqs) {
            playFn(ctx, dest, freq, vel * volume, t, noteDur);
          }

          onNote?.(freqs[0], 0);
          onProgress?.((i + 1) / total);

          if (i === total - 1) {
            const doneHandle = setTimeout(() => onDone?.(), noteDur * 1000 + 100);
            timeoutsRef.current.push(doneHandle);
          }
        }, i * msPerNote);

        timeoutsRef.current.push(handle);
      });
    },
    [getCtx],
  );

  /**
   * Render the sonification to a WAV Blob using OfflineAudioContext.
   * Does NOT play audio — renders silently at full speed.
   * Safe to call while main AudioContext is playing.
   */
  const renderWav = useCallback(
    async (text: string, opts: PlayOptions = {}): Promise<Blob> => {
      if (!text?.trim()) throw new Error('No text to render');

      const {
        instrument = 'piano',
        scaleKey = 'major',
        rootNote = 'C',
        speed = 50,
        noteDur = 0.18,
        volume = 0.8,
        chordMode = false,
      } = opts;

      const SR = 44100;
      const scaleArr = SCALES[scaleKey] ?? SCALES.major;
      const rootFreq = ROOTS[rootNote] ?? 440;
      const playFn = INSTRUMENTS[instrument] ?? INSTRUMENTS.piano;
      const msPerNote = Math.max(50, 400 - speed * 3.5);
      const chars = Array.from(text);
      const totalDur = (chars.length * msPerNote) / 1000 + noteDur + 0.8;

      const offline = new OfflineAudioContext(2, Math.ceil(SR * totalDur), SR);

      chars.forEach((c, i) => {
        const { freqs, vel } = charToNotes(c.charCodeAt(0), scaleArr, rootFreq, chordMode);
        const t = (i * msPerNote) / 1000;
        for (const freq of freqs) {
          // Re-implement in offline context — closure captures offline ctx
          playFn(offline as unknown as AudioContext, offline.destination, freq, vel * volume, t, noteDur);
        }
      });

      const renderedBuffer = await offline.startRendering();
      return audioBufferToWav(renderedBuffer);
    },
    [],
  );

  return { sonify, stopPlayback, renderWav, getCtx };
}
