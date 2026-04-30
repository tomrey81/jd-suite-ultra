'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface Props {
  /** Optional payload to encode (JD ID, version, etc.) */
  payload?: {
    jdId?: string;
    version?: number;
    title?: string;
    completeness?: number;
    biasFlags?: number;
  };
  /** Mode: pleasant audio signature, or technical data signal */
  initialMode?: 'signature' | 'signal';
}

const MAX_DURATION_MS = 15_000;
// Signal mode uses a small set of FSK frequencies for compact payload
const FSK_BASE = 1200;
const FSK_STEP = 200; // 0=1200Hz, 1=1400Hz, ..., 15=4200Hz
const FSK_BITS_PER_TONE = 4;
const FSK_TONE_DURATION = 0.08; // 80ms per nibble

/**
 * Encode a short ASCII payload (max ~24 chars) as 4-bit FSK tones.
 * Each character produces 2 nibbles (8 bits) → 2 tones.
 * 24 chars × 2 tones × 80ms = 3.84s, leaving room for sync + checksum.
 */
function encodePayloadAsTones(payload: string): number[] {
  const truncated = payload.slice(0, 24);
  const nibbles: number[] = [];
  for (const ch of truncated) {
    const code = ch.charCodeAt(0) & 0xff;
    nibbles.push((code >> 4) & 0xf);
    nibbles.push(code & 0xf);
  }
  return nibbles;
}

function checksum(payload: string): number {
  let h = 0;
  for (const ch of payload) h = (h * 31 + ch.charCodeAt(0)) & 0xfff;
  return h;
}

export function SonificationPanel({ payload, initialMode = 'signature' }: Props) {
  const [mode, setMode] = useState<'signature' | 'signal'>(initialMode);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const sourcesRef = useRef<Array<OscillatorNode | AudioBufferSourceNode>>([]);

  useEffect(() => {
    return () => {
      stop();
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureCtx = (): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const stop = useCallback(() => {
    sourcesRef.current.forEach((s) => {
      try { s.stop(); } catch { /* ignore */ }
    });
    sourcesRef.current = [];
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    setPlaying(false);
    setProgress(0);
  }, []);

  /**
   * Pleasant "signature" — short pleasant chord progression mapped to JD attributes.
   * Mappings:
   * - completeness → root note pitch (higher = more complete)
   * - bias flags → minor/major mood (more flags = darker mode)
   * - duration → 6-12 seconds based on data richness
   */
  const playSignature = useCallback(async () => {
    const ctx = ensureCtx();
    if (ctx.state === 'suspended') await ctx.resume();

    const completeness = Math.max(0, Math.min(100, payload?.completeness ?? 50));
    const bias = payload?.biasFlags ?? 0;

    // Root frequency: 220 Hz (low/incomplete) → 440 Hz (high/complete)
    const root = 220 + (completeness / 100) * 220;
    // Major if bias <=2, minor if bias >=3
    const intervals = bias >= 3 ? [1, 1.189, 1.498] : [1, 1.26, 1.498]; // minor vs major triad
    const noteCount = 4;
    const noteDuration = 1.6;
    const totalDuration = noteCount * noteDuration; // 6.4s

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.18;
    masterGain.connect(ctx.destination);

    // Soft reverb-ish: just a slight low-pass filter for warmth
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    filter.Q.value = 0.6;
    filter.connect(masterGain);

    for (let n = 0; n < noteCount; n++) {
      const startT = now + n * noteDuration;
      // Layer: triad
      intervals.forEach((interval, i) => {
        const osc = ctx.createOscillator();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.value = root * interval * (n === noteCount - 1 ? 2 : 1);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, startT);
        gain.gain.linearRampToValueAtTime(0.7 - i * 0.15, startT + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + noteDuration - 0.05);

        osc.connect(gain);
        gain.connect(filter);
        osc.start(startT);
        osc.stop(startT + noteDuration);
        sourcesRef.current.push(osc);
      });
    }

    setPlaying(true);
    setProgress(0);
    const startMs = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startMs;
      const pct = Math.min(100, (elapsed / (totalDuration * 1000)) * 100);
      setProgress(pct);
      if (pct < 100 && playing) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    stopTimerRef.current = window.setTimeout(() => {
      setPlaying(false);
      setProgress(0);
      sourcesRef.current = [];
    }, totalDuration * 1000);
  }, [payload, playing]);

  /**
   * Technical signal mode — encode a compact payload as FSK.
   * Payload format: "JD:<short-id>:<version>:<checksum>"
   * Max ~24 chars → ~4 seconds + leadin/leadout = ~6s total.
   */
  const playSignal = useCallback(async () => {
    const ctx = ensureCtx();
    if (ctx.state === 'suspended') await ctx.resume();

    const shortId = (payload?.jdId || 'demo').slice(0, 8);
    const ver = payload?.version ?? 1;
    const data = `JD:${shortId}:v${ver}`.slice(0, 20);
    const cs = checksum(data).toString(16).padStart(3, '0');
    const fullPayload = `${data}:${cs}`.slice(0, 24);

    const tones = encodePayloadAsTones(fullPayload);
    const leadIn = 0.3;
    const leadOut = 0.3;
    const totalDuration = leadIn + tones.length * FSK_TONE_DURATION + leadOut;

    if (totalDuration * 1000 > MAX_DURATION_MS) {
      // Should not happen with 24 chars, but enforce it
      console.warn('Signal duration exceeds 15s cap; truncating');
      return;
    }

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);

    // Lead-in: 800Hz tone for sync
    const leadOsc = ctx.createOscillator();
    leadOsc.type = 'sine';
    leadOsc.frequency.value = 800;
    const leadGain = ctx.createGain();
    leadGain.gain.setValueAtTime(0, now);
    leadGain.gain.linearRampToValueAtTime(0.7, now + 0.02);
    leadGain.gain.linearRampToValueAtTime(0.7, now + leadIn - 0.02);
    leadGain.gain.linearRampToValueAtTime(0, now + leadIn);
    leadOsc.connect(leadGain);
    leadGain.connect(master);
    leadOsc.start(now);
    leadOsc.stop(now + leadIn);
    sourcesRef.current.push(leadOsc);

    // Tones
    for (let i = 0; i < tones.length; i++) {
      const t0 = now + leadIn + i * FSK_TONE_DURATION;
      const freq = FSK_BASE + tones[i] * FSK_STEP;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.6, t0 + 0.005);
      g.gain.linearRampToValueAtTime(0.6, t0 + FSK_TONE_DURATION - 0.005);
      g.gain.linearRampToValueAtTime(0, t0 + FSK_TONE_DURATION);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + FSK_TONE_DURATION);
      sourcesRef.current.push(osc);
    }

    setPlaying(true);
    setProgress(0);
    const startMs = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startMs;
      const pct = Math.min(100, (elapsed / (totalDuration * 1000)) * 100);
      setProgress(pct);
      if (pct < 100) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    stopTimerRef.current = window.setTimeout(() => {
      setPlaying(false);
      setProgress(0);
      sourcesRef.current = [];
    }, totalDuration * 1000);
  }, [payload]);

  const play = () => {
    stop();
    if (mode === 'signature') playSignature();
    else playSignal();
  };

  const completeness = payload?.completeness ?? 50;
  const bias = payload?.biasFlags ?? 0;

  return (
    <div className="rounded-xl border border-border-default bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-gold">Sonification</div>
          <h3 className="mt-0.5 font-display text-sm font-semibold text-text-primary">Acoustic signature</h3>
        </div>
        <div className="flex gap-1 rounded-full border border-border-default p-0.5">
          <button
            onClick={() => { stop(); setMode('signature'); }}
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
              mode === 'signature' ? 'bg-brand-gold text-white' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Signature
          </button>
          <button
            onClick={() => { stop(); setMode('signal'); }}
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
              mode === 'signal' ? 'bg-brand-gold text-white' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Data signal
          </button>
        </div>
      </div>

      <p className="mb-3 text-[11px] leading-relaxed text-text-muted">
        {mode === 'signature'
          ? 'A short pleasant audio signature derived from this JD. Pitch maps to completeness, mood maps to bias flags. Maximum 8 seconds.'
          : 'A compact data signal encoding a JD reference (ID + version + checksum) as FSK tones. Decoder is experimental — full text recovery is not guaranteed.'}
      </p>

      {/* Mapping preview */}
      {mode === 'signature' && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border-default bg-surface-page p-2">
            <div className="text-[9px] uppercase tracking-wider text-text-muted">Completeness</div>
            <div className="mt-0.5 font-display text-sm font-semibold text-text-primary">{completeness}%</div>
            <div className="text-[9px] text-text-muted">→ pitch</div>
          </div>
          <div className="rounded-md border border-border-default bg-surface-page p-2">
            <div className="text-[9px] uppercase tracking-wider text-text-muted">Bias flags</div>
            <div className="mt-0.5 font-display text-sm font-semibold text-text-primary">{bias}</div>
            <div className="text-[9px] text-text-muted">→ {bias >= 3 ? 'minor mood' : 'major mood'}</div>
          </div>
        </div>
      )}

      {mode === 'signal' && (
        <div className="mb-3 rounded-md border border-info/20 bg-info-bg/50 p-2 text-[10px] text-info">
          <strong>Experimental.</strong> The receiver decodes a compact reference, not the full JD text.
          Full-text recovery from 15s of sound is not technically reliable and is not implemented.
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        {!playing ? (
          <button
            onClick={play}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-gold px-4 py-1.5 text-[11px] font-medium text-white hover:bg-brand-gold/90"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
              <path d="M2 1.5L7 4.5L2 7.5V1.5Z" />
            </svg>
            Play
          </button>
        ) : (
          <button
            onClick={stop}
            className="inline-flex items-center gap-1.5 rounded-full bg-text-primary px-4 py-1.5 text-[11px] font-medium text-white"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
              <rect x="2" y="2" width="5" height="5" />
            </svg>
            Stop
          </button>
        )}
        <button
          onClick={play}
          className="rounded-full border border-border-default bg-white px-3 py-1.5 text-[11px] font-medium text-text-secondary hover:border-brand-gold"
        >
          Regenerate
        </button>
      </div>

      {/* Progress */}
      {playing && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-page">
          <div
            className="h-full bg-brand-gold transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="mt-3 text-[9px] text-text-muted">
        Maximum duration: 15 seconds. Audio is generated locally in your browser.
      </div>
    </div>
  );
}
