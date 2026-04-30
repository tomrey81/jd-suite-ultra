/**
 * FSK (Frequency Shift Keying) encoder + decoder for audio data transmission.
 *
 * What this is honestly:
 *   A way to encode a SHORT TEXT REFERENCE (typically 8-24 chars — like a JD
 *   ID or compact handle) as a sequence of audio tones, played through one
 *   device's speaker, captured by another device's microphone, and decoded
 *   back to the original text.
 *
 * What this is NOT:
 *   A way to transmit full multi-paragraph JD bodies. The data rate of FSK
 *   over the air through a phone microphone is ~30-60 chars/sec under ideal
 *   conditions. Use this to send a JD ID; the receiver fetches the body via
 *   normal HTTP.
 *
 * Encoding scheme:
 *   - 16 frequencies (4 bits per tone) spanning 1200 Hz - 4200 Hz, 200 Hz apart
 *   - Each character becomes 2 nibbles (4 bits each) → 2 tones
 *   - 80 ms per tone → ~12.5 chars/sec raw
 *   - Lead-in tone at 800 Hz for sync (300 ms)
 *   - Lead-out tone at 600 Hz for end-of-message (200 ms)
 *   - Trailing 12-bit checksum for error detection (3 hex chars → 6 nibbles)
 *
 * Total time for N-char payload: 0.5 + 0.08 * (N + 3) * 2 seconds
 *   - 8 chars  → ~2.3 sec
 *   - 24 chars → ~4.8 sec
 *   - Cap at 24 chars to keep under 5 seconds.
 */

export const FSK_BASE = 1200;
export const FSK_STEP = 200;
export const FSK_TONE_DURATION = 0.08;
export const FSK_LEAD_IN_FREQ = 800;
export const FSK_LEAD_OUT_FREQ = 600;
export const FSK_LEAD_IN_DURATION = 0.3;
export const FSK_LEAD_OUT_DURATION = 0.2;
export const FSK_MAX_CHARS = 24;

/** Compute a 12-bit checksum (returns 3-char hex string) */
export function fskChecksum(payload: string): string {
  let h = 0;
  for (const ch of payload) h = (h * 31 + ch.charCodeAt(0)) & 0xfff;
  return h.toString(16).padStart(3, '0');
}

/**
 * Convert a string into nibbles (4-bit values 0..15).
 * Each character becomes 2 nibbles (high then low of its char code & 0xff).
 */
export function payloadToNibbles(payload: string): number[] {
  const truncated = payload.slice(0, FSK_MAX_CHARS);
  const nibbles: number[] = [];
  for (const ch of truncated) {
    const code = ch.charCodeAt(0) & 0xff;
    nibbles.push((code >> 4) & 0xf);
    nibbles.push(code & 0xf);
  }
  return nibbles;
}

/** Inverse: nibble pairs → string. */
export function nibblesToPayload(nibbles: number[]): string {
  let out = '';
  for (let i = 0; i + 1 < nibbles.length; i += 2) {
    const code = (nibbles[i] << 4) | nibbles[i + 1];
    out += String.fromCharCode(code);
  }
  return out;
}

/** Total broadcast duration for a given payload length, in seconds. */
export function fskDuration(payloadCharCount: number): number {
  const total = Math.min(payloadCharCount, FSK_MAX_CHARS) + 3; // +3 chars for checksum
  return FSK_LEAD_IN_DURATION + (total * 2) * FSK_TONE_DURATION + FSK_LEAD_OUT_DURATION;
}

export interface FSKBroadcastOptions {
  /** 0..1 (default 0.4 — needs to be loud enough for mic pickup) */
  volume?: number;
}

/**
 * Schedule an FSK broadcast on an AudioContext.
 * @returns end time in seconds (relative to ctx.currentTime)
 */
export function scheduleFskBroadcast(
  ctx: AudioContext | OfflineAudioContext,
  payload: string,
  startTime: number,
  destination?: AudioNode,
  options: FSKBroadcastOptions = {},
): number {
  const { volume = 0.4 } = options;
  const truncatedPayload = payload.slice(0, FSK_MAX_CHARS);
  const checksum = fskChecksum(truncatedPayload);
  const fullMessage = truncatedPayload + checksum;
  const nibbles = payloadToNibbles(fullMessage);

  const dest = destination || ctx.destination;
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(dest);

  let t = startTime;

  // Lead-in: 800 Hz tone for sync
  scheduleTone(ctx, FSK_LEAD_IN_FREQ, t, FSK_LEAD_IN_DURATION, master);
  t += FSK_LEAD_IN_DURATION;

  // Data tones
  for (const n of nibbles) {
    const freq = FSK_BASE + n * FSK_STEP;
    scheduleTone(ctx, freq, t, FSK_TONE_DURATION, master);
    t += FSK_TONE_DURATION;
  }

  // Lead-out: 600 Hz tone for end-of-message
  scheduleTone(ctx, FSK_LEAD_OUT_FREQ, t, FSK_LEAD_OUT_DURATION, master);
  t += FSK_LEAD_OUT_DURATION;

  return t - startTime;
}

function scheduleTone(
  ctx: AudioContext | OfflineAudioContext,
  freq: number,
  startTime: number,
  duration: number,
  destination: AudioNode,
) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  // Quick fade in/out to avoid clicks
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.95, startTime + 0.005);
  gain.gain.linearRampToValueAtTime(0.95, startTime + duration - 0.005);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// ── Decoder (real-time, microphone-driven) ──────────────────────────────────

export interface FskDecoderState {
  /** Current decoder phase */
  phase: 'listening' | 'syncing' | 'receiving' | 'complete' | 'error';
  /** Data nibbles received so far */
  nibbles: number[];
  /** Decoded payload so far (without checksum) */
  partialPayload: string;
  /** Final decoded payload (only set when phase==='complete') */
  payload?: string;
  /** Checksum match flag (only set when phase==='complete') */
  checksumOk?: boolean;
  /** Error message if phase==='error' */
  error?: string;
}

interface DecoderConfig {
  /** Sample rate of incoming audio (typically 44100 or 48000) */
  sampleRate: number;
  /** FFT size (must be power of 2). Larger = better frequency resolution but more latency. */
  fftSize?: number;
}

/**
 * Real-time FSK decoder. Feed it FFT magnitude buffers from an AnalyserNode
 * sampled at regular intervals. Returns updated state on every call.
 *
 * Usage:
 *   const decoder = createFskDecoder({ sampleRate: ctx.sampleRate });
 *   const buf = new Float32Array(analyser.frequencyBinCount);
 *   setInterval(() => {
 *     analyser.getFloatFrequencyData(buf);  // dB values
 *     const state = decoder.feed(buf);
 *     // ...react to state.phase
 *   }, 20);
 */
export function createFskDecoder(config: DecoderConfig) {
  const { sampleRate } = config;
  const fftSize = config.fftSize ?? 2048;
  const binWidth = sampleRate / fftSize;

  // Pre-compute bin indices for each frequency we care about
  const leadInBin = Math.round(FSK_LEAD_IN_FREQ / binWidth);
  const leadOutBin = Math.round(FSK_LEAD_OUT_FREQ / binWidth);
  const dataBins = Array.from({ length: 16 }, (_, i) =>
    Math.round((FSK_BASE + i * FSK_STEP) / binWidth),
  );

  let phase: FskDecoderState['phase'] = 'listening';
  let nibbles: number[] = [];
  let lastNibble = -1;
  let nibbleStableFrames = 0;
  // Number of decoder iterations of the current dominant signal we've seen
  let leadInFrames = 0;
  let silenceFrames = 0;
  const REQUIRED_LEAD_IN_FRAMES = 8; // ~160ms at 50Hz polling
  const NIBBLE_STABLE_THRESHOLD = 3; // frames a nibble must persist
  const SILENCE_THRESHOLD = 30;       // frames of silence → reset
  const PEAK_DB_THRESHOLD = -60;      // dB above which we consider a tone detected

  return {
    feed(magBuf: Float32Array): FskDecoderState {
      // Find dominant bin among our candidates
      let peakDb = -Infinity;
      let peakBin = -1;
      const candidates = [leadInBin, leadOutBin, ...dataBins];
      for (const bin of candidates) {
        // Look at +/- 1 bin for tolerance
        const local = Math.max(magBuf[bin - 1] ?? -Infinity, magBuf[bin] ?? -Infinity, magBuf[bin + 1] ?? -Infinity);
        if (local > peakDb) {
          peakDb = local;
          peakBin = bin;
        }
      }

      // Silence?
      if (peakDb < PEAK_DB_THRESHOLD || peakBin < 0) {
        silenceFrames++;
        if (silenceFrames > SILENCE_THRESHOLD && phase !== 'complete' && phase !== 'error') {
          // Reset
          phase = 'listening';
          nibbles = [];
          lastNibble = -1;
          nibbleStableFrames = 0;
          leadInFrames = 0;
        }
        return { phase, nibbles: [...nibbles], partialPayload: nibblesToPayload(nibbles) };
      }
      silenceFrames = 0;

      // Identify which signal it is
      let detectedNibble = -1;
      let isLeadIn = false;
      let isLeadOut = false;
      if (peakBin === leadInBin) isLeadIn = true;
      else if (peakBin === leadOutBin) isLeadOut = true;
      else {
        const idx = dataBins.indexOf(peakBin);
        if (idx >= 0) detectedNibble = idx;
      }

      // State machine
      if (phase === 'listening' || phase === 'syncing') {
        if (isLeadIn) {
          phase = 'syncing';
          leadInFrames++;
          if (leadInFrames >= REQUIRED_LEAD_IN_FRAMES) {
            phase = 'receiving';
            nibbles = [];
            lastNibble = -1;
            nibbleStableFrames = 0;
          }
        } else {
          leadInFrames = 0;
          phase = 'listening';
        }
      } else if (phase === 'receiving') {
        if (isLeadOut) {
          // End of message — verify checksum
          const decoded = nibblesToPayload(nibbles);
          if (decoded.length >= 3) {
            const body = decoded.slice(0, decoded.length - 3);
            const cs = decoded.slice(-3);
            const expected = fskChecksum(body);
            const ok = cs === expected;
            phase = 'complete';
            return {
              phase,
              nibbles: [...nibbles],
              partialPayload: body,
              payload: body,
              checksumOk: ok,
            };
          } else {
            phase = 'error';
            return {
              phase,
              nibbles: [...nibbles],
              partialPayload: '',
              error: 'Message too short',
            };
          }
        } else if (detectedNibble >= 0) {
          if (detectedNibble === lastNibble) {
            nibbleStableFrames++;
          } else {
            // Commit prior nibble if it was stable enough
            if (lastNibble >= 0 && nibbleStableFrames >= NIBBLE_STABLE_THRESHOLD) {
              nibbles.push(lastNibble);
            }
            lastNibble = detectedNibble;
            nibbleStableFrames = 1;
          }
        }
      }

      return {
        phase,
        nibbles: [...nibbles],
        partialPayload: nibblesToPayload(nibbles),
      };
    },
    reset() {
      phase = 'listening';
      nibbles = [];
      lastNibble = -1;
      nibbleStableFrames = 0;
      leadInFrames = 0;
      silenceFrames = 0;
    },
    getState(): FskDecoderState {
      return { phase, nibbles: [...nibbles], partialPayload: nibblesToPayload(nibbles) };
    },
  };
}
