// ── JD Suite — Studio Engine ───────────────────────────────────────────────
// Procedural audio synthesis via Web Audio API.
// All instruments, nature sounds, and animal sounds are zero-sample, purely procedural.
//
// This module exposes play functions that accept an AudioContext (or OfflineAudioContext)
// and a destination node, making them usable for both real-time playback and offline WAV render.

// ── MIDI Utilities ─────────────────────────────────────────────────────────

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export const SCALES: Record<string, number[]> = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues:      [0, 3, 5, 6, 7, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  chromatic:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const ROOTS: Record<string, number> = {
  C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392.00, A: 440.00, B: 493.88,
};

// JD language to root key mapping (psychoacoustically calibrated)
export const LANGUAGE_ROOTS: Record<string, string> = {
  PL: 'D', // D minor: gravity, formality
  EN: 'C', // C major: neutral default
  ES: 'G', // G major: warmth, openness
};

export interface CharEvent {
  deg: number;
  oct: number;
  midi: number;
  freq: number;
  vel: number;
}

export function charToEvent(code: number, scale: number[], rootFreq: number): CharEvent {
  const deg = code % scale.length;
  const oct = Math.floor(code / scale.length) % 3;
  const semi = Math.log2(rootFreq / 261.63) * 12 + 60;
  const midi = semi + scale[deg] + oct * 12;
  const freq = midiToFreq(midi);
  const vel = 0.4 + ((code % 7) / 6) * 0.6;
  return { deg, oct, midi, freq, vel };
}

// ── Type for play functions ────────────────────────────────────────────────

type Ctx = AudioContext | OfflineAudioContext;
type PlayFn = (ctx: Ctx, dest: AudioNode, freq: number, vel: number, t: number, dur: number) => void;

// ── INSTRUMENTS (7, recycled from Sonifikator v8) ──────────────────────────

function playPiano(ctx: Ctx, d: AudioNode, f: number, v: number, t: number, dur: number) {
  [1, 2, 3, 4, 5].forEach((h, i) => {
    const amp = [1, 0.5, 0.25, 0.15, 0.08][i];
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f * h;
    const hD = dur / (1 + i * 0.25);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp * v * 0.25, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + hD);
    o.connect(g); g.connect(d);
    o.start(t); o.stop(t + hD + 0.05);
  });
}

function playStrings(ctx: Ctx, d: AudioNode, f: number, v: number, t: number, dur: number) {
  [-5, 0, 5].forEach((det) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const ff = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = det;
    ff.type = 'lowpass';
    ff.frequency.value = f * 4;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v * 0.08, t + 0.1);
    g.gain.setValueAtTime(v * 0.08, t + dur - 0.05);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(ff); ff.connect(g); g.connect(d);
    o.start(t); o.stop(t + dur + 0.1);
  });
}

function playFlute(ctx: Ctx, d: AudioNode, f: number, v: number, t: number, dur: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = f;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v * 0.18, t + 0.04);
  g.gain.setValueAtTime(v * 0.18, t + dur - 0.04);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g); g.connect(d);
  o.start(t); o.stop(t + dur + 0.05);
}

function playGuitar(ctx: Ctx, d: AudioNode, f: number, v: number, t: number, dur: number) {
  // Karplus-Strong physical modelling
  const sr = ctx.sampleRate;
  const per = Math.round(sr / f);
  const kL = per * 3;
  const kB = ctx.createBuffer(1, kL, sr);
  const kd = kB.getChannelData(0);
  for (let i = 0; i < per; i++) kd[i] = Math.random() * 2 - 1;
  for (let i = per; i < kL; i++) kd[i] = (kd[i - per] + kd[i - per + 1]) * 0.498;
  const ks = ctx.createBufferSource();
  const kg = ctx.createGain();
  kg.gain.setValueAtTime(v * 0.45, t);
  kg.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(dur, 2.5));
  ks.buffer = kB;
  ks.loop = true;
  ks.loopEnd = kL / sr;
  ks.connect(kg); kg.connect(d);
  ks.start(t); ks.stop(t + Math.min(dur, 2.5) + 0.05);
}

function playBell(ctx: Ctx, d: AudioNode, f: number, v: number, t: number, dur: number) {
  [1, 2.756, 5.404, 8.933, 13.34].forEach((p, i) => {
    const amp = [1, 0.55, 0.30, 0.18, 0.08][i];
    const dec = dur * (1 - 0.14 * i);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f * p;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp * v * 0.18, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g); g.connect(d);
    o.start(t); o.stop(t + dec + 0.04);
  });
}

function playOrgan(ctx: Ctx, d: AudioNode, f: number, v: number, t: number, dur: number) {
  [0.5, 1, 1.5, 2, 3, 4].forEach((m, i) => {
    const amp = [0.4, 1, 0.6, 0.7, 0.4, 0.3][i];
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f * m;
    g.gain.setValueAtTime(amp * v * 0.07, t + 0.002);
    g.gain.setValueAtTime(amp * v * 0.07, t + dur - 0.008);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(d);
    o.start(t); o.stop(t + dur + 0.04);
  });
}

function playCello(ctx: Ctx, d: AudioNode, f: number, v: number, t: number, dur: number) {
  [0, 0.003].forEach((det) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f1 = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.value = f * (1 + det);
    f1.type = 'peaking';
    f1.frequency.value = 250;
    f1.gain.value = 6;
    f1.Q.value = 2;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v * 0.1, t + 0.09);
    g.gain.setValueAtTime(v * 0.1, t + dur - 0.06);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(f1); f1.connect(g); g.connect(d);
    o.start(t); o.stop(t + dur + 0.1);
  });
}

export interface InstrumentDef {
  label: string;
  icon: string;
  color: string;
  play: PlayFn;
  chordable: boolean;
}

export const INSTRUMENTS: Record<string, InstrumentDef> = {
  piano:   { label: 'Piano',   icon: '🎹', color: '#B5A089', play: playPiano,   chordable: true },
  strings: { label: 'Strings', icon: '🎻', color: '#4A7A50', play: playStrings, chordable: true },
  guitar:  { label: 'Guitar',  icon: '🎸', color: '#4A5E7A', play: playGuitar,  chordable: true },
  flute:   { label: 'Flute',   icon: '🪈', color: '#7A7A6A', play: playFlute,   chordable: false },
  organ:   { label: 'Organ',   icon: '🎹', color: '#7A4A4A', play: playOrgan,   chordable: true },
  bells:   { label: 'Bells',   icon: '🔔', color: '#E8E4DC', play: playBell,    chordable: false },
  cello:   { label: 'Cello',   icon: '🎻', color: '#6A8A7A', play: playCello,   chordable: true },
};

// ── NATURE SOUNDS (extended from 6 to 16) ──────────────────────────────────

type NaturePlayFn = (ctx: Ctx, d: AudioNode, vol: number, dur: number) => void;

export interface NatureSoundDef {
  label: string;
  icon: string;
  color: string;
  play: NaturePlayFn;
}

function playWind(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const dd = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    dd[i] = (b0 + b1 + b2 + b3 + b4 + b5 + w * 0.5362) * 0.11;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 450; f.Q.value = 0.3;
  const g = ctx.createGain();
  const t2 = ctx.currentTime;
  g.gain.setValueAtTime(0, t2);
  g.gain.linearRampToValueAtTime(vol * 0.5, t2 + 0.8);
  g.gain.setValueAtTime(vol * 0.5, t2 + dur - 0.5);
  g.gain.linearRampToValueAtTime(0, t2 + dur);
  src.connect(f); f.connect(g); g.connect(d);
  src.start(t2);
}

function playWaves(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  const t2 = ctx.currentTime;
  const sr = ctx.sampleRate;
  for (let w = 0; w < 3; w++) {
    const len = Math.ceil(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0;
    for (let i = 0; i < len; i++) {
      const x = Math.random() * 2 - 1;
      b0 = 0.97 * b0 + x * 0.1;
      b1 = 0.92 * b1 + b0 * 0.1;
      data[i] = b1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 600 + w * 200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.08, t2);
    src.connect(f); f.connect(g); g.connect(d);
    src.start(t2 + w * 0.3);
  }
}

function playRain(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  const t2 = ctx.currentTime;
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  [2000, 3500, 5000].forEach((fc) => {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = fc; f.Q.value = 0.3;
    const g = ctx.createGain();
    g.gain.value = vol * 0.12;
    src.connect(f); f.connect(g); g.connect(d);
  });
  src.start(t2);
}

function playThunder(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  const t2 = ctx.currentTime;
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let v2 = 0;
  for (let i = 0; i < len; i++) {
    v2 = v2 * 0.998 + (Math.random() * 2 - 1) * 0.002;
    data[i] = v2;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t2);
  g.gain.linearRampToValueAtTime(vol, t2 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t2 + dur);
  src.connect(f); f.connect(g); g.connect(d);
  src.start(t2);
}

function playForest(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  const t2 = ctx.currentTime;
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let b0 = 0, b1 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.95 * b0 + w * 0.08;
    b1 = 0.98 * b1 + b0 * 0.05;
    data[i] = b1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.value = vol * 0.4;
  src.connect(f); f.connect(g); g.connect(d);
  src.start(t2);
}

function playGeyser(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  const t2 = ctx.currentTime;
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let prev = 0;
  for (let i = 0; i < len; i++) {
    prev = prev * 0.99 + (Math.random() * 2 - 1) * 0.01;
    data[i] = prev;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 120;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t2);
  g.gain.linearRampToValueAtTime(vol * 0.8, t2 + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.001, t2 + dur);
  src.connect(f); f.connect(g); g.connect(d);
  src.start(t2);
}

// New nature sounds (extended from 6 to 16)

function playStorm(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  // Layered wind + thunder bursts
  playWind(ctx, d, vol * 0.7, dur);
  const t2 = ctx.currentTime;
  // Random thunder strikes
  for (let i = 0; i < 3; i++) {
    const delay = dur * 0.2 + Math.random() * dur * 0.6;
    setTimeout(() => playThunder(ctx, d, vol * 0.8, 1.5), delay * 1000);
  }
}

function playFire(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  const t2 = ctx.currentTime;
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(i / sr * 3));
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol * 0.3, t2);
  g.gain.setValueAtTime(vol * 0.3, t2 + dur - 0.3);
  g.gain.linearRampToValueAtTime(0, t2 + dur);
  src.connect(f); f.connect(g); g.connect(d);
  src.start(t2);
}

function playEarthquake(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  const t2 = ctx.currentTime;
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let v2 = 0;
  for (let i = 0; i < len; i++) {
    v2 = v2 * 0.999 + (Math.random() * 2 - 1) * 0.001;
    data[i] = v2 * Math.sin(i / sr * 8);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 60;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t2);
  g.gain.linearRampToValueAtTime(vol * 0.9, t2 + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.001, t2 + dur);
  src.connect(f); f.connect(g); g.connect(d);
  src.start(t2);
}

function playCracklingEmbers(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  const t2 = ctx.currentTime;
  // Random short bursts of filtered noise
  for (let i = 0; i < Math.floor(dur * 8); i++) {
    const start = t2 + Math.random() * dur;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 3000 + Math.random() * 4000;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol * 0.15, start + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.03 + Math.random() * 0.05);
    o.connect(g); g.connect(d);
    o.start(start); o.stop(start + 0.1);
  }
}

function playBrook(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  const t2 = ctx.currentTime;
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let b0 = 0;
  for (let i = 0; i < len; i++) {
    b0 = 0.96 * b0 + (Math.random() * 2 - 1) * 0.04;
    data[i] = b0 * (1 + 0.3 * Math.sin(i / sr * 2.5));
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 0.4;
  const g = ctx.createGain();
  g.gain.value = vol * 0.25;
  src.connect(f); f.connect(g); g.connect(d);
  src.start(t2);
}

function playOceanDepth(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  const t2 = ctx.currentTime;
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let b0 = 0, b1 = 0;
  for (let i = 0; i < len; i++) {
    b0 = 0.999 * b0 + (Math.random() * 2 - 1) * 0.001;
    b1 = 0.995 * b1 + b0 * 0.005;
    data[i] = b1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 200;
  const g = ctx.createGain();
  g.gain.value = vol * 0.6;
  src.connect(f); f.connect(g); g.connect(d);
  src.start(t2);
}

function playDistantThunder(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  const t2 = ctx.currentTime;
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let v2 = 0;
  for (let i = 0; i < len; i++) {
    v2 = v2 * 0.9995 + (Math.random() * 2 - 1) * 0.0005;
    data[i] = v2;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 100;
  const rv = ctx.createBiquadFilter();
  rv.type = 'lowpass'; rv.frequency.value = 400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t2);
  g.gain.linearRampToValueAtTime(vol * 0.4, t2 + 0.5);
  g.gain.exponentialRampToValueAtTime(0.001, t2 + dur);
  src.connect(f); f.connect(rv); rv.connect(g); g.connect(d);
  src.start(t2);
}

function playLightRain(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  const t2 = ctx.currentTime;
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 4000; f.Q.value = 0.2;
  const g = ctx.createGain();
  g.gain.value = vol * 0.06;
  src.connect(f); f.connect(g); g.connect(d);
  src.start(t2);
}

function playHeavyRain(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  playRain(ctx, d, vol * 1.2, dur);
  // Add low rumble
  const t2 = ctx.currentTime;
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 300;
  const g = ctx.createGain();
  g.gain.value = vol * 0.15;
  src.connect(f); f.connect(g); g.connect(d);
  src.start(t2);
}

function playBlizzard(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  playWind(ctx, d, vol * 0.9, dur);
  playLightRain(ctx, d, vol * 0.3, dur);
}

/**
 * Betoniarka (concrete mixer) — slow rotating drum with periodic metallic
 * clanks of aggregate falling against the rim. Three layers: motor rumble,
 * tumbling aggregate noise, and randomly-timed metallic transients.
 */
function playBetoniarka(ctx: Ctx, d: AudioNode, vol: number, dur: number) {
  const t0 = ctx.currentTime;
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);

  // 1. Motor rumble — slow tremolo on low rumble
  const rumbleBuf = ctx.createBuffer(1, len, sr);
  const rumble = rumbleBuf.getChannelData(0);
  let r = 0;
  for (let i = 0; i < len; i++) {
    r = 0.992 * r + (Math.random() * 2 - 1) * 0.008;
    rumble[i] = r * (0.7 + 0.3 * Math.sin((i / sr) * Math.PI * 2 * 0.7));
  }
  const rumbleSrc = ctx.createBufferSource();
  rumbleSrc.buffer = rumbleBuf;
  const rumbleLP = ctx.createBiquadFilter();
  rumbleLP.type = 'lowpass'; rumbleLP.frequency.value = 110; rumbleLP.Q.value = 0.6;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = vol * 0.55;
  rumbleSrc.connect(rumbleLP); rumbleLP.connect(rumbleGain); rumbleGain.connect(d);
  rumbleSrc.start(t0);

  // 2. Tumbling aggregate — band-passed noise modulated by drum rotation
  const tumbleBuf = ctx.createBuffer(1, len, sr);
  const tumble = tumbleBuf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    tumble[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin((i / sr) * Math.PI * 2 * 1.4));
  }
  const tumbleSrc = ctx.createBufferSource();
  tumbleSrc.buffer = tumbleBuf;
  const tumbleBP = ctx.createBiquadFilter();
  tumbleBP.type = 'bandpass'; tumbleBP.frequency.value = 700; tumbleBP.Q.value = 0.8;
  const tumbleGain = ctx.createGain();
  tumbleGain.gain.value = vol * 0.18;
  tumbleSrc.connect(tumbleBP); tumbleBP.connect(tumbleGain); tumbleGain.connect(d);
  tumbleSrc.start(t0);

  // 3. Metallic clanks every ~0.45s (stones hitting the wall)
  const clankCount = Math.max(1, Math.floor(dur / 0.45));
  for (let i = 0; i < clankCount; i++) {
    const ct = t0 + i * 0.45 + Math.random() * 0.18;
    if (ct > t0 + dur) break;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(280 + Math.random() * 160, ct);
    o.frequency.exponentialRampToValueAtTime(140 + Math.random() * 60, ct + 0.18);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ct);
    g.gain.linearRampToValueAtTime(vol * 0.25, ct + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, ct + 0.22);
    o.connect(f); f.connect(g); g.connect(d);
    o.start(ct); o.stop(ct + 0.25);
  }
}

export const NATURE_SOUNDS: Record<string, NatureSoundDef> = {
  wind:            { label: 'Wind',            icon: '💨', color: '#7A8A9A', play: playWind },
  waves:           { label: 'Waves',           icon: '🌊', color: '#5A7A8A', play: playWaves },
  rain:            { label: 'Rain',            icon: '🌧', color: '#6A7A8A', play: playRain },
  thunder:         { label: 'Thunder',         icon: '⛈',  color: '#5A5A7A', play: playThunder },
  storm:           { label: 'Storm',           icon: '🌪', color: '#4A4A6A', play: playStorm },
  fire:            { label: 'Fire',            icon: '🔥', color: '#8A5A3A', play: playFire },
  earthquake:      { label: 'Earthquake',      icon: '🌋', color: '#6A5A4A', play: playEarthquake },
  forest:          { label: 'Forest',          icon: '🌲', color: '#4A7A5A', play: playForest },
  geyser:          { label: 'Geyser',          icon: '♨',  color: '#8A6A5A', play: playGeyser },
  cracklingEmbers: { label: 'Crackling Embers',icon: '🪵', color: '#7A4A3A', play: playCracklingEmbers },
  brook:           { label: 'Brook',           icon: '💧', color: '#5A8A9A', play: playBrook },
  oceanDepth:      { label: 'Ocean Depth',     icon: '🐚', color: '#3A5A7A', play: playOceanDepth },
  distantThunder:  { label: 'Distant Thunder', icon: '🌩', color: '#5A5A6A', play: playDistantThunder },
  lightRain:       { label: 'Light Rain',      icon: '🌦', color: '#7A8A9A', play: playLightRain },
  heavyRain:       { label: 'Heavy Rain',      icon: '⛈',  color: '#4A5A7A', play: playHeavyRain },
  blizzard:        { label: 'Blizzard',        icon: '❄',  color: '#8A9AAA', play: playBlizzard },
  betoniarka:      { label: 'Betoniarka',      icon: '🛞', color: '#7A6A55', play: playBetoniarka },
};

// ── ANIMAL SOUNDS (extended from 12 to 17) ─────────────────────────────────

type AnimalPlayFn = (ctx: Ctx, d: AudioNode, vol: number, t: number) => void;

export interface AnimalSoundDef {
  label: string;
  icon: string;
  color: string;
  play: AnimalPlayFn;
}

export const ANIMAL_SOUNDS: Record<string, AnimalSoundDef> = {
  horse: {
    label: 'Horse', icon: '🐴', color: '#8A7A5A',
    play(ctx, d, vol, t) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(800, t); o.frequency.exponentialRampToValueAtTime(200, t + 0.6);
      f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 2;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.connect(f); f.connect(g); g.connect(d); o.start(t); o.stop(t + 0.75);
    },
  },
  chicken: {
    label: 'Chicken', icon: '🐔', color: '#8A8A5A',
    play(ctx, d, vol, t) {
      [0, 0.2, 0.4, 0.7, 0.9].forEach((delay, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = 600 + i * 50 + (Math.random() - 0.5) * 80;
        const st = t + delay;
        g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(vol, st + 0.03); g.gain.exponentialRampToValueAtTime(0.001, st + 0.12);
        o.connect(g); g.connect(d); o.start(st); o.stop(st + 0.15);
      });
    },
  },
  pig: {
    label: 'Pig', icon: '🐷', color: '#9A7A7A',
    play(ctx, d, vol, t) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(150, t); o.frequency.linearRampToValueAtTime(120, t + 0.4);
      f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 3;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(f); f.connect(g); g.connect(d); o.start(t); o.stop(t + 0.55);
    },
  },
  elephant: {
    label: 'Elephant', icon: '🐘', color: '#7A7A7A',
    play(ctx, d, vol, t) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(100, t); o.frequency.linearRampToValueAtTime(300, t + 0.3); o.frequency.linearRampToValueAtTime(150, t + 1.0);
      f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 2;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.1); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
      o.connect(f); f.connect(g); g.connect(d); o.start(t); o.stop(t + 1.2);
    },
  },
  warbler: {
    label: 'Warbler', icon: '🐦', color: '#5A8A5A',
    play(ctx, d, vol, t) {
      [2093, 2349, 2637, 2793, 3136, 2637, 2349, 2093, 1760, 1976].forEach((freq, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        const st = t + i * 0.12;
        g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(vol, st + 0.02); g.gain.exponentialRampToValueAtTime(0.001, st + 0.10);
        o.connect(g); g.connect(d); o.start(st); o.stop(st + 0.14);
      });
    },
  },
  wolf: {
    label: 'Wolf', icon: '🐺', color: '#6A6A7A',
    play(ctx, d, vol, t) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(200, t); o.frequency.linearRampToValueAtTime(600, t + 0.5); o.frequency.linearRampToValueAtTime(400, t + 1.8);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.2); g.gain.setValueAtTime(vol, t + 1.5); g.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
      o.connect(g); g.connect(d); o.start(t); o.stop(t + 2.05);
    },
  },
  dolphin: {
    label: 'Dolphin', icon: '🐬', color: '#5A7A9A',
    play(ctx, d, vol, t) {
      [0, 0.08, 0.14, 0.18].forEach((dt) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 8000 + Math.random() * 4000;
        const st = t + dt;
        g.gain.setValueAtTime(vol, st); g.gain.exponentialRampToValueAtTime(0.001, st + 0.04);
        o.connect(g); g.connect(d); o.start(st); o.stop(st + 0.05);
      });
    },
  },
  frog: {
    label: 'Frog', icon: '🐸', color: '#5A8A6A',
    play(ctx, d, vol, t) {
      [[0, 250], [0.15, 180]].forEach(([delay, freq]) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'triangle'; o.frequency.value = freq;
        f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 4;
        const st = t + delay;
        g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(vol, st + 0.02); g.gain.exponentialRampToValueAtTime(0.001, st + 0.2);
        o.connect(f); f.connect(g); g.connect(d); o.start(st); o.stop(st + 0.25);
      });
    },
  },
  cat: {
    label: 'Cat', icon: '🐱', color: '#8A8A7A',
    play(ctx, d, vol, t) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(250, t); o.frequency.linearRampToValueAtTime(400, t + 0.2); o.frequency.linearRampToValueAtTime(200, t + 0.6);
      f.type = 'bandpass'; f.frequency.setValueAtTime(800, t); f.frequency.linearRampToValueAtTime(600, t + 0.6); f.Q.value = 3;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      o.connect(f); f.connect(g); g.connect(d); o.start(t); o.stop(t + 0.7);
    },
  },
  cricket: {
    label: 'Cricket', icon: '🦗', color: '#6A8A5A',
    play(ctx, d, vol, t) {
      for (let i = 0; i < 6; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square'; o.frequency.value = 4200 + Math.random() * 200;
        const st = t + i * 0.08;
        g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(vol, st + 0.005); g.gain.exponentialRampToValueAtTime(0.001, st + 0.07);
        o.connect(g); g.connect(d); o.start(st); o.stop(st + 0.08);
      }
    },
  },
  crow: {
    label: 'Crow', icon: '🐦', color: '#555555',
    play(ctx, d, vol, t) {
      [0, 0.4, 0.75].forEach((delay) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(400, t + delay); o.frequency.linearRampToValueAtTime(300, t + delay + 0.25);
        f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 3;
        g.gain.setValueAtTime(0, t + delay); g.gain.linearRampToValueAtTime(vol, t + delay + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.3);
        o.connect(f); f.connect(g); g.connect(d); o.start(t + delay); o.stop(t + delay + 0.35);
      });
    },
  },
  hyena: {
    label: 'Hyena', icon: '🦴', color: '#7A7A5A',
    play(ctx, d, vol, t) {
      [0, 0.15, 0.28, 0.39, 0.48].forEach((delay, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = 300 + i * 80;
        const st = t + delay;
        g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(vol * (1 + i * 0.1), st + 0.02); g.gain.exponentialRampToValueAtTime(0.001, st + 0.12);
        o.connect(g); g.connect(d); o.start(st); o.stop(st + 0.15);
      });
    },
  },
  // New animals (extending from 12 to 17)
  whale: {
    label: 'Whale', icon: '🐋', color: '#3A5A8A',
    play(ctx, d, vol, t) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(80, t); o.frequency.linearRampToValueAtTime(200, t + 1.5); o.frequency.linearRampToValueAtTime(100, t + 3.0);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * 0.6, t + 0.5); g.gain.setValueAtTime(vol * 0.6, t + 2.5); g.gain.exponentialRampToValueAtTime(0.001, t + 3.5);
      o.connect(g); g.connect(d); o.start(t); o.stop(t + 3.6);
    },
  },
  wolfPack: {
    label: 'Wolf Pack', icon: '🐺', color: '#5A5A7A',
    play(ctx, d, vol, t) {
      // Multiple wolves at different pitches with staggered entries
      [0, 0.4, 0.8, 1.2].forEach((delay, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth';
        const base = 180 + i * 60;
        const st = t + delay;
        o.frequency.setValueAtTime(base, st); o.frequency.linearRampToValueAtTime(base + 200, st + 0.6); o.frequency.linearRampToValueAtTime(base + 100, st + 1.5);
        g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(vol * 0.3, st + 0.15); g.gain.setValueAtTime(vol * 0.3, st + 1.2); g.gain.exponentialRampToValueAtTime(0.001, st + 1.8);
        o.connect(g); g.connect(d); o.start(st); o.stop(st + 1.85);
      });
    },
  },
  owl: {
    label: 'Owl', icon: '🦉', color: '#6A5A4A',
    play(ctx, d, vol, t) {
      // Two-tone "hoo-hoo"
      [0, 0.5].forEach((delay) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        const st = t + delay;
        o.frequency.setValueAtTime(400, st); o.frequency.exponentialRampToValueAtTime(300, st + 0.3);
        g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(vol * 0.4, st + 0.03); g.gain.exponentialRampToValueAtTime(0.001, st + 0.35);
        o.connect(g); g.connect(d); o.start(st); o.stop(st + 0.4);
      });
    },
  },
  hawk: {
    label: 'Hawk', icon: '🦅', color: '#7A6A5A',
    play(ctx, d, vol, t) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(2000, t); o.frequency.exponentialRampToValueAtTime(800, t + 0.8);
      f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 2;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * 0.5, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
      o.connect(f); f.connect(g); g.connect(d); o.start(t); o.stop(t + 1.05);
    },
  },
};

// ── WAV export utility ─────────────────────────────────────────────────────

export function audioBufToWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels;
  const SR = buf.sampleRate;
  const len = buf.length;
  const pcm = new Int16Array(len * ch);
  for (let c = 0; c < ch; c++) {
    const dd = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      pcm[i * ch + c] = Math.max(-32768, Math.min(32767, Math.round(dd[i] * 32767)));
    }
  }
  const wl = 44 + pcm.byteLength;
  const wb = new ArrayBuffer(wl);
  const v = new DataView(wb);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, wl - 8, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * ch * 2, true); v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, pcm.byteLength, true);
  new Int16Array(wb, 44).set(pcm);
  return new Blob([wb], { type: 'audio/wav' });
}

// ── Offline render helpers ─────────────────────────────────────────────────

export async function renderInstrumentToWav(
  text: string,
  instKey: string,
  scaleKey: string,
  rootKey: string,
  options: { chordMode?: boolean; speed?: number; noteDur?: number; vol?: number } = {},
): Promise<Blob> {
  const { chordMode = false, speed = 55, noteDur = 0.6, vol = 0.75 } = options;
  const chars = Array.from(text || 'JD Suite');
  const SR = 44100;
  const rf = ROOTS[rootKey] || 440;
  const sc = SCALES[scaleKey] || SCALES.major;
  const ms = Math.max(60, 500 - speed * 4) / 1000;
  const totalDur = chars.length * ms + noteDur + 1;
  const offline = new OfflineAudioContext(2, Math.ceil(SR * totalDur), SR);

  const dry = offline.createGain();
  dry.gain.value = 1;
  dry.connect(offline.destination);

  // Reverb impulse
  const rvBuf = offline.createBuffer(2, Math.ceil(SR * 1.5), SR);
  for (let c = 0; c < 2; c++) {
    const dd = rvBuf.getChannelData(c);
    for (let i = 0; i < rvBuf.length; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rvBuf.length, 2.5);
  }
  const rv = offline.createConvolver();
  rv.buffer = rvBuf;
  const rvG = offline.createGain();
  rvG.gain.value = 0.2;
  rv.connect(rvG);
  rvG.connect(offline.destination);

  const inst = INSTRUMENTS[instKey] || INSTRUMENTS.piano;
  const semi = Math.log2(rf / 261.63) * 12 + 60;

  chars.forEach((c, i) => {
    const code = c.charCodeAt(0);
    const deg = code % sc.length;
    const oct = Math.floor(code / sc.length) % 3;
    const midi = semi + sc[deg] + oct * 12;
    const freq = midiToFreq(midi);
    const vel = 0.4 + ((code % 7) / 6) * 0.6;
    const t2 = i * ms;
    inst.play(offline, dry, freq, vel * vol, t2, noteDur);
    inst.play(offline, rv, freq, vel * vol * 0.3, t2, noteDur);
  });

  return audioBufToWav(await offline.startRendering());
}

export async function renderNatureSoundToWav(soundKey: string, vol = 0.5, dur = 4): Promise<Blob> {
  const SR = 44100;
  const offline = new OfflineAudioContext(2, Math.ceil(SR * (dur + 0.5)), SR);
  const d = offline.createGain();
  d.gain.value = 1;
  d.connect(offline.destination);
  const snd = NATURE_SOUNDS[soundKey];
  if (!snd) throw new Error(`Unknown nature sound: ${soundKey}`);
  snd.play(offline, d, vol, dur);
  return audioBufToWav(await offline.startRendering());
}

export async function renderAnimalSoundToWav(soundKey: string, vol = 0.5): Promise<Blob> {
  const SR = 44100;
  const dur = 3;
  const offline = new OfflineAudioContext(2, Math.ceil(SR * dur), SR);
  const d = offline.createGain();
  d.gain.value = 1;
  d.connect(offline.destination);
  const snd = ANIMAL_SOUNDS[soundKey];
  if (!snd) throw new Error(`Unknown animal sound: ${soundKey}`);
  snd.play(offline, d, vol, 0);
  return audioBufToWav(await offline.startRendering());
}
