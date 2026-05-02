/**
 * WAV export for the Sonificator orchestra.
 *
 * Uses OfflineAudioContext to render the full mix to a buffer, then
 * encodes it as a standard 16-bit PCM WAV file (no external deps).
 *
 * The engine and themes modules already accept OfflineAudioContext,
 * so we just replicate the playOrchestra scheduling logic here.
 */

import {
  INSTRUMENTS,
  NATURE_SOUNDS,
  ANIMAL_SOUNDS,
  SCALES,
  ROOTS,
  charToEvent,
} from './engine';
import { scheduleTheme, themeDuration, type Theme } from './themes';

export interface ExportTrack {
  jdId: string;
  jobTitle: string;
  soundType: 'instrument' | 'nature' | 'animal';
  soundKey: string;
  vol: number;
  pan: number;
  scaleKey: string;
  rootKey: string;
  muted: boolean;
  solo: boolean;
}

export interface ExportOptions {
  tracks: ExportTrack[];
  theme: Theme | null;
  tempo: number;       // BPM
  themeMix: number;    // 0..1
  masterVol: number;   // 0..1
  sampleRate?: number; // default 44100
  onProgress?: (pct: number) => void;
}

// ── PCM → WAV encoder ────────────────────────────────────────────────────────

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const wavSize = 44 + dataSize;

  const wav = new ArrayBuffer(wavSize);
  const view = new DataView(wav);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);       // chunk size
  view.setUint16(20, 1, true);        // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels + clamp to int16
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = buffer.getChannelData(ch)[i];
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return wav;
}

// ── Scheduling helpers (mirrors playOrchestra in sonificator-view.tsx) ───────

function calcDuration(tracks: ExportTrack[], theme: Theme | null, tempo: number): number {
  const beatDur = 60 / tempo;
  const noteDur = beatDur * 0.85;
  const soloActive = tracks.some((t) => t.solo);
  const audible = (t: ExportTrack) => !t.muted && (soloActive ? t.solo : true);

  let maxTrack = 0;
  tracks.forEach((track, idx) => {
    if (!audible(track)) return;
    const chars = Array.from(track.jobTitle || 'JD');
    const trackOffset = idx * 0.05;
    const dur = chars.length * beatDur + noteDur + trackOffset;
    if (dur > maxTrack) maxTrack = dur;
  });

  const themeDur = theme ? themeDuration(theme) : 0;
  return Math.max(themeDur, maxTrack, 1) + 0.5; // +0.5s tail
}

function scheduleOrchestra(
  ctx: OfflineAudioContext,
  tracks: ExportTrack[],
  theme: Theme | null,
  tempo: number,
  themeMix: number,
  masterVol: number,
): void {
  const now = 0;
  const beatDur = 60 / tempo;
  const noteDur = beatDur * 0.85;

  const master = ctx.createGain();
  master.gain.value = masterVol;
  master.connect(ctx.destination);

  if (theme) scheduleTheme(ctx as unknown as AudioContext, theme, now, master, themeMix);

  const soloActive = tracks.some((t) => t.solo);
  const audible = (t: ExportTrack) => !t.muted && (soloActive ? t.solo : true);

  const instKeys = Object.keys(INSTRUMENTS);
  const natureKeys = Object.keys(NATURE_SOUNDS);
  const animalKeys = Object.keys(ANIMAL_SOUNDS);

  tracks.forEach((track, idx) => {
    if (!audible(track)) return;

    const trackGain = ctx.createGain();
    trackGain.gain.value = track.vol;

    const panNode = ctx.createStereoPanner();
    panNode.pan.value = track.pan;
    trackGain.connect(panNode);
    panNode.connect(master);

    const text = track.jobTitle || 'JD';
    const chars = Array.from(text);
    const trackOffset = idx * 0.05;

    if (track.soundType === 'instrument') {
      const inst = INSTRUMENTS[track.soundKey] || INSTRUMENTS[instKeys[0]];
      const sc = SCALES[track.scaleKey] || SCALES.major;
      const rf = ROOTS[track.rootKey] || 261.63;
      chars.forEach((ch, i) => {
        const ev = charToEvent(ch.charCodeAt(0), sc, rf);
        if (!ev) return;
        const t0 = now + trackOffset + i * beatDur;
        inst.play(ctx as unknown as AudioContext, trackGain, ev.freq, ev.vel || 0.7, t0, noteDur);
      });
    } else {
      const ascii = text.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const freq = 200 + (ascii % 600);
      const t0 = now + trackOffset;
      const dur = Math.min(8, beatDur * Math.max(2, chars.length * 0.4));
      const osc = ctx.createOscillator();
      osc.type = track.soundType === 'nature' ? 'sine' : 'sawtooth';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.3, t0 + 0.1);
      g.gain.linearRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g);
      g.connect(trackGain);
      osc.start(t0);
      osc.stop(t0 + dur);
    }
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ExportResult {
  wav: ArrayBuffer;
  durationSeconds: number;
  filename: string;
}

export async function renderToWav(opts: ExportOptions): Promise<ExportResult> {
  const {
    tracks,
    theme,
    tempo,
    themeMix,
    masterVol,
    sampleRate = 44100,
    onProgress,
  } = opts;

  const duration = calcDuration(tracks, theme, tempo);
  const numChannels = 2;

  const offCtx = new OfflineAudioContext(numChannels, Math.ceil(sampleRate * duration), sampleRate);

  scheduleOrchestra(offCtx, tracks, theme, tempo, themeMix, masterVol);

  onProgress?.(10);

  // Progress simulation — OfflineAudioContext doesn't fire progress events
  let pct = 10;
  const progressInterval = setInterval(() => {
    pct = Math.min(pct + 5, 85);
    onProgress?.(pct);
  }, 200);

  const rendered = await offCtx.startRendering();
  clearInterval(progressInterval);
  onProgress?.(90);

  const wav = audioBufferToWav(rendered);
  onProgress?.(100);

  // Build filename: e.g. "jd-orchestra-2-tracks.wav"
  const trackPart = tracks.length === 1
    ? tracks[0].jobTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 30)
    : `${tracks.length}-tracks`;
  const filename = `jd-orchestra-${trackPart}.wav`;

  return { wav, durationSeconds: duration, filename };
}

export function downloadWav(result: ExportResult) {
  const blob = new Blob([result.wav], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
