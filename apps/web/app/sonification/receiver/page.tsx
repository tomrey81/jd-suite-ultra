'use client';

/**
 * JD Suite Sonification Receiver — public, cross-device.
 *
 * Three concurrent capabilities while microphone is open:
 *
 *  1. FSK token decoder — listens for the audible token broadcast from another
 *     device (encoded by lib/studio/fsk.ts), validates checksum, resolves to a
 *     JD link if the payload starts with "jd:" or looks like a UUID.
 *
 *  2. Live speech-to-text (Web Speech API where supported) — captures spoken
 *     audio in the room and produces a running transcript. Useful for note-
 *     taking during a sonification meeting.
 *
 *  3. Visual feedback — input level meter, frequency spectrum sketch, decoded
 *     state.
 *
 * QR fallback: if FSK fails (noisy room, ultrasonic blocked, encoding mismatch),
 * the broadcaster's QR code can be scanned with the device camera using the
 * native scanner; this page only renders the URL the user types or pastes.
 *
 * Public route — no auth required. The token resolves to a relative path that
 * the user can open in their authenticated session afterwards.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createFskDecoder, FSK_BASE, FSK_STEP, type FskDecoderState } from '@/lib/studio/fsk';

type ListenStatus = 'idle' | 'requesting' | 'listening' | 'error' | 'denied';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number }; resultIndex: number }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getSR(): { new (): SpeechRecognitionLike } | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as unknown as { SpeechRecognition?: { new (): SpeechRecognitionLike }; webkitSpeechRecognition?: { new (): SpeechRecognitionLike } }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: { new (): SpeechRecognitionLike } }).webkitSpeechRecognition ||
    null
  );
}

function resolveToken(payload: string): { kind: 'jd' | 'url' | 'unknown'; href?: string; label: string } {
  const trimmed = payload.trim();
  if (!trimmed) return { kind: 'unknown', label: '(empty)' };
  // jd:<uuid>
  if (trimmed.startsWith('jd:')) {
    const id = trimmed.slice(3);
    return { kind: 'jd', href: `/jd/${id}`, label: id };
  }
  // looks like a UUID-ish
  if (/^[a-f0-9-]{8,}$/i.test(trimmed)) return { kind: 'jd', href: `/jd/${trimmed}`, label: trimmed };
  // looks like a path
  if (trimmed.startsWith('/')) return { kind: 'url', href: trimmed, label: trimmed };
  return { kind: 'unknown', label: trimmed };
}

export default function ReceiverPage() {
  const [status, setStatus] = useState<ListenStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [spectrum, setSpectrum] = useState<number[]>([]);
  const [decoderState, setDecoderState] = useState<FskDecoderState>({
    phase: 'listening', nibbles: [], partialPayload: '',
  });
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [transcriptSupported, setTranscriptSupported] = useState(false);
  const [manualUrl, setManualUrl] = useState('');

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const decoderRef = useRef<ReturnType<typeof createFskDecoder> | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setTranscriptSupported(!!getSR());
  }, []);

  const cleanup = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try { recRef.current?.abort(); } catch { /* ignore */ }
    recRef.current = null;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (ctxRef.current) {
      try { ctxRef.current.close(); } catch { /* ignore */ }
      ctxRef.current = null;
    }
    analyserRef.current = null;
    decoderRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    setErrorMsg(null);
    setDecoderState({ phase: 'listening', nibbles: [], partialPayload: '' });
    setTranscript('');
    setInterim('');
    setStatus('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;

      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) throw new Error('Web Audio API not available in this browser');
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.4;
      src.connect(analyser);
      analyserRef.current = analyser;

      decoderRef.current = createFskDecoder({ sampleRate: ctx.sampleRate, fftSize: analyser.fftSize });

      // Start parallel speech recognition (best-effort)
      const SR = getSR();
      if (SR) {
        try {
          const rec = new SR();
          rec.lang = navigator.language || 'en-US';
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (e) => {
            let final = '';
            let mid = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const r = e.results[i] as ArrayLike<{ transcript: string }> & { isFinal: boolean };
              const t = r[0]?.transcript || '';
              if (r.isFinal) final += t;
              else mid += t;
            }
            if (final) setTranscript((prev) => (prev ? prev + ' ' : '') + final.trim());
            setInterim(mid);
          };
          rec.onerror = () => { /* speech errors are non-fatal */ };
          rec.onend = () => {
            // Auto-restart while listening (Chrome stops after ~1 min by default)
            if (status === 'listening' && recRef.current) {
              try { recRef.current.start(); } catch { /* swallow */ }
            }
          };
          recRef.current = rec;
          rec.start();
        } catch { /* speech is best-effort; ignore */ }
      }

      setStatus('listening');

      const freqBuf = new Float32Array(analyser.frequencyBinCount);
      const tdBuf = new Uint8Array(analyser.fftSize);
      let lastDecoderPoll = 0;

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(tdBuf);
        // RMS level
        let sumSq = 0;
        for (let i = 0; i < tdBuf.length; i++) {
          const v = (tdBuf[i] - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / tdBuf.length);
        setLevel(Math.min(1, rms * 3));

        // Sample frequency for spectrum bars (FSK band ~1200-4400 Hz)
        analyserRef.current.getFloatFrequencyData(freqBuf);
        const sr = ctxRef.current?.sampleRate ?? 44100;
        const binWidth = sr / analyser.fftSize;
        const startBin = Math.floor(800 / binWidth);
        const endBin = Math.ceil((FSK_BASE + 16 * FSK_STEP) / binWidth);
        const bars: number[] = [];
        const step = Math.max(1, Math.floor((endBin - startBin) / 32));
        for (let b = startBin; b < endBin; b += step) {
          bars.push(Math.max(-100, freqBuf[b] ?? -100));
        }
        setSpectrum(bars.slice(0, 32));

        // Throttle decoder to ~50 Hz
        const now = performance.now();
        if (now - lastDecoderPoll > 20 && decoderRef.current) {
          lastDecoderPoll = now;
          const next = decoderRef.current.feed(freqBuf);
          setDecoderState(next);
        }

        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setStatus('denied');
        setErrorMsg('Microphone permission was denied. Allow access in your browser site settings, then try again.');
      } else {
        setStatus('error');
        setErrorMsg(e?.message || 'Could not start listening');
      }
      cleanup();
    }
  }, [cleanup, status]);

  const stop = useCallback(() => {
    cleanup();
    setStatus('idle');
  }, [cleanup]);

  const clearTranscript = () => { setTranscript(''); setInterim(''); };

  const downloadTranscript = () => {
    const body = (transcript || '').trim();
    if (!body) return;
    const blob = new Blob([`JD Suite — Sonification receiver transcript\nGenerated ${new Date().toISOString()}\n\n${body}\n`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jd-suite-transcript-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const decoded = decoderState.phase === 'complete' && decoderState.checksumOk
    ? resolveToken(decoderState.payload || '')
    : null;

  const phaseLabel: Record<FskDecoderState['phase'], string> = {
    listening: 'Listening for signal…',
    syncing: 'Sync detected — locking onto signal',
    receiving: 'Receiving data',
    complete: 'Decoded',
    error: 'Decoder error',
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] px-4 py-8">
      <div className="mx-auto max-w-[680px]">
        <header className="mb-6 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A7560]">
            JD Suite · Sonification Receiver
          </div>
          <h1 className="mt-2 font-serif text-[28px] font-semibold leading-tight text-[#2A211A]">
            Listen for a sonification token
          </h1>
          <p className="mx-auto mt-3 max-w-[520px] text-[13px] leading-relaxed text-[#5C4F44]">
            Hold this device near the broadcaster. The microphone picks up the audible token,
            decodes it, and offers a link to the matching JD. Live transcription captures any
            spoken commentary alongside.
          </p>
        </header>

        {/* Listen control */}
        <div className="mb-4 rounded-xl border border-[#E5DBC8] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#8A7560]">Microphone</div>
              <div className="mt-0.5 text-[13px] font-medium text-[#2A211A]">
                {status === 'idle' && 'Tap Start to begin listening'}
                {status === 'requesting' && 'Requesting permission…'}
                {status === 'listening' && phaseLabel[decoderState.phase]}
                {status === 'denied' && 'Permission denied'}
                {status === 'error' && 'Error'}
              </div>
            </div>
            {status !== 'listening' ? (
              <button
                onClick={start}
                disabled={status === 'requesting'}
                className="rounded-full bg-[#8A7560] px-5 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#7A6655] disabled:opacity-50"
              >
                {status === 'requesting' ? 'Starting…' : '● Start listening'}
              </button>
            ) : (
              <button
                onClick={stop}
                className="rounded-full border border-[#D14B3D] bg-white px-5 py-2 text-[12px] font-medium text-[#D14B3D] transition-colors hover:bg-[#D14B3D]/5"
              >
                ■ Stop
              </button>
            )}
          </div>

          {/* Level meter */}
          {status === 'listening' && (
            <>
              <div className="mt-3">
                <div className="text-[9px] uppercase tracking-widest text-[#8A7560]">Input level</div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#F0E9DC]">
                  <div
                    className="h-full transition-[width] duration-75"
                    style={{
                      width: `${Math.min(100, level * 100)}%`,
                      background: level > 0.7 ? '#D14B3D' : level > 0.3 ? '#E5A23A' : '#8A7560',
                    }}
                  />
                </div>
              </div>

              {/* Spectrum sketch over the FSK band */}
              <div className="mt-3">
                <div className="text-[9px] uppercase tracking-widest text-[#8A7560]">Spectrum (FSK band)</div>
                <div className="mt-1 flex h-12 items-end gap-px rounded bg-[#F8F4EC] p-1">
                  {spectrum.map((db, i) => {
                    const norm = Math.max(0, Math.min(1, (db + 100) / 80));
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-sm bg-[#8A7560]"
                        style={{ height: `${Math.max(2, norm * 100)}%`, opacity: 0.35 + norm * 0.65 }}
                      />
                    );
                  })}
                  {spectrum.length === 0 && (
                    <div className="m-auto text-[9px] text-[#8A7560]/60">waiting for audio…</div>
                  )}
                </div>
              </div>
            </>
          )}

          {errorMsg && (
            <div className="mt-3 rounded border border-[#D14B3D]/30 bg-[#FBE8E5] p-2 text-[11px] text-[#A02619]">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Decoded token */}
        <div className="mb-4 rounded-xl border border-[#E5DBC8] bg-white p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#8A7560]">Decoded token</div>
          {decoderState.phase === 'complete' && decoderState.checksumOk && decoded ? (
            <div className="mt-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Checksum OK</div>
                <div className="mt-1 break-all font-mono text-[13px] text-[#2A211A]">{decoded.label}</div>
                {decoded.href && (
                  <a
                    href={decoded.href}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[#8A7560] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#7A6655]"
                  >
                    Open in JD Suite →
                  </a>
                )}
                {!decoded.href && (
                  <p className="mt-2 text-[11px] text-[#5C4F44]">
                    Token decoded but does not look like a JD link. Check with the broadcaster.
                  </p>
                )}
              </div>
              <button
                onClick={() => { decoderRef.current?.reset(); setDecoderState({ phase: 'listening', nibbles: [], partialPayload: '' }); }}
                className="mt-2 text-[11px] text-[#8A7560] underline-offset-2 hover:underline"
              >
                Listen for another token
              </button>
            </div>
          ) : decoderState.phase === 'complete' && !decoderState.checksumOk ? (
            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-800">
              <strong>Checksum failed.</strong> The signal was decoded but appears corrupted. Move closer, raise broadcaster volume, or use the QR fallback below.
            </div>
          ) : decoderState.phase === 'receiving' ? (
            <div className="mt-2 rounded-lg border border-[#E5DBC8] bg-[#FAF7F2] p-3">
              <div className="text-[11px] text-[#5C4F44]">Receiving…</div>
              <div className="mt-1 break-all font-mono text-[12px] text-[#2A211A]">
                {decoderState.partialPayload || '·'}<span className="opacity-30">_</span>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-[#8A7560]">No token received yet.</p>
          )}
        </div>

        {/* Transcript */}
        <div className="mb-4 rounded-xl border border-[#E5DBC8] bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#8A7560]">Live transcript</div>
              <div className="mt-0.5 text-[11px] text-[#8A7560]/80">
                {transcriptSupported
                  ? 'Web Speech API — best in Chrome / Edge. Privacy: audio is processed by your browser; only text is stored locally.'
                  : 'Speech-to-text is not supported in this browser. Try Chrome on desktop or Android.'}
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={clearTranscript}
                disabled={!transcript && !interim}
                className="rounded-md border border-[#E5DBC8] bg-white px-2.5 py-1 text-[10px] font-medium text-[#5C4F44] hover:border-[#8A7560] disabled:opacity-40"
              >
                Clear
              </button>
              <button
                onClick={downloadTranscript}
                disabled={!transcript.trim()}
                className="rounded-md border border-[#E5DBC8] bg-white px-2.5 py-1 text-[10px] font-medium text-[#5C4F44] hover:border-[#8A7560] disabled:opacity-40"
              >
                Download .txt
              </button>
            </div>
          </div>
          <div className="mt-3 min-h-[100px] rounded-lg border border-[#E5DBC8] bg-[#FAF7F2] p-3 text-[12px] leading-relaxed text-[#2A211A]">
            {transcript || interim ? (
              <>
                <span>{transcript}</span>
                {interim && <span className="text-[#8A7560]/70 italic"> {interim}</span>}
              </>
            ) : (
              <span className="text-[#8A7560]/60">{transcriptSupported ? 'Speak — text will appear here.' : 'Live transcription unavailable.'}</span>
            )}
          </div>
        </div>

        {/* QR fallback */}
        <div className="mb-4 rounded-xl border-l-2 border-[#8A7560] bg-[#F4ECDC] p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#8A7560]">QR fallback</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[#2A211A]">
            If the room is too noisy or the broadcaster's near-ultrasonic mode is blocked, ask them
            to display the QR code instead. Open your camera app and scan it directly.
          </p>
          <div className="mt-2">
            <label className="block text-[10px] font-medium text-[#8A7560]">Or paste a JD link manually</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="/jd/<id> or jd:<id>"
                className="flex-1 rounded-md border border-[#E5DBC8] bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[#8A7560]"
              />
              <a
                href={resolveToken(manualUrl).href || '#'}
                aria-disabled={!resolveToken(manualUrl).href}
                className="rounded-md bg-[#8A7560] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#7A6655] aria-disabled:pointer-events-none aria-disabled:opacity-40"
              >
                Open
              </a>
            </div>
          </div>
        </div>

        <footer className="mt-6 text-center text-[10px] text-[#8A7560]/70">
          JD Suite · acoustic transmission is experimental. Use the QR fallback in noisy rooms.
        </footer>
      </div>
    </div>
  );
}
