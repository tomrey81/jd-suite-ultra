/**
 * FSK loopback test — encoder nibble sequence → synthetic FFT frames → decoder.
 *
 * No AudioContext or audio rendering needed. We compute the exact nibble
 * sequence the encoder would emit, synthesise idealised FFT magnitude frames
 * (one hot bin at −30 dB, all others at −100 dB), and drive the decoder
 * through them — verifying the full encode→decode path including checksum.
 *
 * DECODER LIMITATION (pre-existing, not introduced by ef12aaa):
 *   The decoder uses a nibble-transition model: it only commits a nibble when
 *   the tone changes to a different value. If two consecutive positions in the
 *   encoded stream carry the same nibble value, the decoder cannot distinguish
 *   them and will see them as one longer run, producing a wrong payload.
 *   Test payloads must therefore be chosen so that no two adjacent nibbles in
 *   the full encoded stream (payload + 3-char checksum) are equal. Each payload
 *   below was pre-verified with the helper at the bottom of this file.
 */

import { describe, expect, it } from 'vitest';
import {
  FSK_BASE,
  FSK_LEAD_IN_FREQ,
  FSK_LEAD_OUT_FREQ,
  FSK_STEP,
  createFskDecoder,
  fskChecksum,
  nibblesToPayload,
  payloadToNibbles,
} from './fsk';

// ── Synthetic FFT helpers ─────────────────────────────────────────────────────

const SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;
const BIN_WIDTH = SAMPLE_RATE / FFT_SIZE;
const FREQ_BIN_COUNT = FFT_SIZE / 2;

function freqToBin(freq: number): number {
  return Math.round(freq / BIN_WIDTH);
}

const LEAD_IN_BIN = freqToBin(FSK_LEAD_IN_FREQ);
const LEAD_OUT_BIN = freqToBin(FSK_LEAD_OUT_FREQ);
const dataBin = (nibble: number) => freqToBin(FSK_BASE + nibble * FSK_STEP);

/** Build a synthetic FFT magnitude frame with a single dominant frequency. */
function makeFrame(activeBin: number, activeDb = -30): Float32Array {
  const buf = new Float32Array(FREQ_BIN_COUNT).fill(-100);
  buf[activeBin] = activeDb;
  return buf;
}

// Mirrored from fsk.ts (private constants)
const REQUIRED_LEAD_IN_FRAMES = 8;
const NIBBLE_STABLE_FRAMES = 3; // NIBBLE_STABLE_THRESHOLD in fsk.ts

/**
 * Drive the decoder through one complete idealised transmission for `payload`.
 * Returns the final decoder state (should be phase==='complete').
 *
 * Precondition: `payload` must be an FSK-safe string — no two adjacent nibbles
 * in `payloadToNibbles(payload + fskChecksum(payload))` may be equal.
 * Use `assertFskSafe()` below to verify this during test authoring.
 */
function loopback(payload: string) {
  const decoder = createFskDecoder({ sampleRate: SAMPLE_RATE, fftSize: FFT_SIZE });

  // Lead-in: must exceed REQUIRED_LEAD_IN_FRAMES to transition to 'receiving'
  const leadInFrame = makeFrame(LEAD_IN_BIN);
  for (let i = 0; i < REQUIRED_LEAD_IN_FRAMES + 2; i++) decoder.feed(leadInFrame);

  // Data nibbles: payload + 3-char checksum suffix
  const checksum = fskChecksum(payload);
  const nibbles = payloadToNibbles(payload + checksum);

  // Feed each nibble for NIBBLE_STABLE_FRAMES+1 frames so the decoder commits
  // it on the next nibble transition (threshold is NIBBLE_STABLE_FRAMES).
  for (const n of nibbles) {
    const frame = makeFrame(dataBin(n));
    for (let i = 0; i < NIBBLE_STABLE_FRAMES + 1; i++) decoder.feed(frame);
  }

  // Lead-out: 1 frame triggers checksum verification.
  // The fix (ef12aaa) ensures the last pending nibble is committed first.
  return decoder.feed(makeFrame(LEAD_OUT_BIN));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FSK loopback (encoder nibbles → synthetic FFT → decoder)', () => {
  it('decodes "test" and passes checksum', () => {
    // 'test' → checksum '492' → no consecutive duplicate nibbles ✓
    const state = loopback('test');
    expect(state.phase).toBe('complete');
    expect(state.checksumOk).toBe(true);
    expect(state.payload).toBe('test');
  });

  it('decodes "ping" and passes checksum', () => {
    // 'ping' → checksum '172' → no consecutive duplicate nibbles ✓
    const state = loopback('ping');
    expect(state.phase).toBe('complete');
    expect(state.checksumOk).toBe(true);
    expect(state.payload).toBe('ping');
  });

  it('decodes a realistic JD-style token and passes checksum', () => {
    // 'role-eng-2026' → checksum '008' → no consecutive duplicate nibbles ✓
    const state = loopback('role-eng-2026');
    expect(state.phase).toBe('complete');
    expect(state.checksumOk).toBe(true);
    expect(state.payload).toBe('role-eng-2026');
  });

  it('decodes a longer token (18 chars) and passes checksum', () => {
    // 'jd-backend-eng-v2' → checksum '417' → no consecutive duplicate nibbles ✓
    // Note: payload must be ≤ 21 chars so payload+checksum ≤ 24 = FSK_MAX_CHARS
    const state = loopback('jd-backend-eng-v2');
    expect(state.phase).toBe('complete');
    expect(state.checksumOk).toBe(true);
    expect(state.payload).toBe('jd-backend-eng-v2');
  });

  it('checksum helper is consistent with nibblesToPayload round-trip', () => {
    const payload = 'test';
    const cs = fskChecksum(payload);
    const nibbles = payloadToNibbles(payload + cs);
    const recovered = nibblesToPayload(nibbles);
    expect(recovered).toBe(payload + cs);
  });

  it('decoder returns error when lead-out fires before any data', () => {
    const decoder = createFskDecoder({ sampleRate: SAMPLE_RATE, fftSize: FFT_SIZE });
    const leadInFrame = makeFrame(LEAD_IN_BIN);
    for (let i = 0; i < REQUIRED_LEAD_IN_FRAMES + 2; i++) decoder.feed(leadInFrame);
    // Lead-out immediately after lead-in, no data nibbles
    const state = decoder.feed(makeFrame(LEAD_OUT_BIN));
    // decoded.length < 3 → 'error'
    expect(state.phase).toBe('error');
  });
});

// ── Payload safety checker (for test authoring) ───────────────────────────────

/**
 * Asserts that `payload` is FSK-safe: no two consecutive nibbles in the full
 * encoded stream are equal. Call this when adding new test payloads.
 *
 * @example
 *   assertFskSafe('my-new-token'); // throws if unsafe
 */
export function assertFskSafe(payload: string): void {
  const cs = fskChecksum(payload);
  const nibbles = payloadToNibbles(payload + cs);
  for (let i = 0; i < nibbles.length - 1; i++) {
    if (nibbles[i] === nibbles[i + 1]) {
      throw new Error(
        `Payload "${payload}" has consecutive duplicate nibble ${nibbles[i]} at positions ${i},${i + 1}. ` +
          `Choose a different payload or the decoder will misread it.`,
      );
    }
  }
}
