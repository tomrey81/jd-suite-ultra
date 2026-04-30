'use client';

import { useState, useRef, useCallback } from 'react';
import {
  INSTRUMENTS,
  NATURE_SOUNDS,
  ANIMAL_SOUNDS,
  SCALES,
  ROOTS,
  renderInstrumentToWav,
  renderNatureSoundToWav,
  renderAnimalSoundToWav,
  type InstrumentDef,
  type NatureSoundDef,
  type AnimalSoundDef,
} from '@/lib/studio/engine';

type Mode = 'instruments' | 'nature' | 'animals';

function SoundCard({
  label, icon, color, playing, onClick,
}: {
  label: string; icon: string; color: string; playing: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center rounded-md border-2 p-4 text-center transition-all ${
        playing
          ? 'border-brand-gold bg-brand-gold/10'
          : 'border-border-default bg-surface-card hover:border-brand-gold/40'
      }`}
    >
      <span className="mb-1 text-2xl">{icon}</span>
      <span className="text-[10px] font-semibold text-text-primary">{label}</span>
      {playing && <span className="mt-1 text-[8px] text-brand-gold animate-pulse">Playing...</span>}
    </button>
  );
}

export function StudioSoloView() {
  const [mode, setMode] = useState<Mode>('instruments');
  const [selectedInst, setSelectedInst] = useState('piano');
  const [scaleKey, setScaleKey] = useState('major');
  const [rootKey, setRootKey] = useState('C');
  const [text, setText] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [speed, setSpeed] = useState(55);
  const [noteDur, setNoteDur] = useState(0.6);
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const playInstrumentPreview = (key: string) => {
    const ctx = getCtx();
    const inst = INSTRUMENTS[key];
    if (!inst) return;
    setPlaying(key);
    // Play a short C major arpeggio as preview
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, i) => {
      inst.play(ctx, ctx.destination, freq, volume * 0.6, ctx.currentTime + i * 0.25, 0.4);
    });
    setTimeout(() => setPlaying(null), notes.length * 250 + 500);
  };

  const playNatureSound = (key: string) => {
    const ctx = getCtx();
    const snd = NATURE_SOUNDS[key];
    if (!snd) return;
    setPlaying(key);
    snd.play(ctx, ctx.destination, volume, 3);
    setTimeout(() => setPlaying(null), 3500);
  };

  const playAnimalSound = (key: string) => {
    const ctx = getCtx();
    const snd = ANIMAL_SOUNDS[key];
    if (!snd) return;
    setPlaying(key);
    snd.play(ctx, ctx.destination, volume, ctx.currentTime);
    setTimeout(() => setPlaying(null), 2500);
  };

  const sonifyText = () => {
    if (!text.trim()) return;
    const ctx = getCtx();
    const inst = INSTRUMENTS[selectedInst];
    if (!inst) return;
    const sc = SCALES[scaleKey] || SCALES.major;
    const rf = ROOTS[rootKey] || 261.63;
    const semi = Math.log2(rf / 261.63) * 12 + 60;
    const ms = Math.max(60, 500 - speed * 4) / 1000;
    const chars = Array.from(text);

    setPlaying('sonify');

    // Compressor + reverb for clean output
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    comp.connect(ctx.destination);

    chars.forEach((c, i) => {
      const code = c.charCodeAt(0);
      const deg = code % sc.length;
      const oct = Math.floor(code / sc.length) % 3;
      const midi = semi + sc[deg] + oct * 12;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const vel = 0.4 + ((code % 7) / 6) * 0.6;
      inst.play(ctx, comp, freq, vel * volume, ctx.currentTime + i * ms, noteDur);
    });

    setTimeout(() => setPlaying(null), chars.length * ms * 1000 + noteDur * 1000 + 200);
  };

  const exportWav = async () => {
    setExporting(true);
    try {
      let blob: Blob;
      if (mode === 'instruments' && text.trim()) {
        blob = await renderInstrumentToWav(text, selectedInst, scaleKey, rootKey, { speed, noteDur, vol: volume });
      } else if (mode === 'nature' && playing) {
        blob = await renderNatureSoundToWav(playing, volume, 4);
      } else if (mode === 'animals' && playing) {
        blob = await renderAnimalSoundToWav(playing, volume);
      } else if (mode === 'instruments') {
        blob = await renderInstrumentToWav('JD Studio', selectedInst, scaleKey, rootKey, { speed, noteDur, vol: volume });
      } else {
        setExporting(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jd-studio-${mode}-${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('WAV export failed:', err);
    }
    setExporting(false);
  };

  const modeTabs: { key: Mode; label: string; icon: string }[] = [
    { key: 'instruments', label: 'Instruments', icon: '🎹' },
    { key: 'nature', label: 'Nature', icon: '🌿' },
    { key: 'animals', label: 'Animals', icon: '🐾' },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border-default bg-surface-card px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-display text-lg text-text-primary">Studio Solo</h1>
            <p className="text-xs text-text-muted">
              Procedural audio engine ported from Sonifikator v8. 7 instruments, 16 nature sounds, 17 animal sounds.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={exportWav}
              disabled={exporting}
              className="rounded-md border border-border-default bg-surface-card px-3 py-1.5 text-[11px] font-semibold text-text-primary transition-colors hover:border-brand-gold disabled:opacity-50"
            >
              {exporting ? 'Rendering...' : 'WAV Export'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Controls */}
        <div className="w-[260px] shrink-0 overflow-y-auto border-r border-border-default bg-surface-card p-4">
          {/* Mode tabs */}
          <div className="mb-4 flex gap-1">
            {modeTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setMode(tab.key)}
                className={`flex-1 rounded-md px-2 py-1.5 text-center text-[10px] font-semibold transition-colors ${
                  mode === tab.key
                    ? 'bg-brand-gold/10 text-brand-gold'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {mode === 'instruments' && (
            <>
              {/* Instrument selector */}
              <div className="mb-4">
                <div className="mb-2 text-[9px] uppercase tracking-wider text-text-muted">Instrument</div>
                {Object.entries(INSTRUMENTS).map(([key, inst]) => (
                  <button
                    key={key}
                    onClick={() => { setSelectedInst(key); playInstrumentPreview(key); }}
                    className={`mb-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] transition-colors ${
                      selectedInst === key
                        ? 'bg-brand-gold/10 text-brand-gold'
                        : 'text-text-secondary hover:bg-surface-page'
                    }`}
                  >
                    <span>{inst.icon}</span>
                    <span>{inst.label}</span>
                  </button>
                ))}
              </div>

              {/* Scale */}
              <div className="mb-4">
                <div className="mb-2 text-[9px] uppercase tracking-wider text-text-muted">Scale</div>
                <select
                  className="w-full rounded-md border border-border-default bg-surface-page px-2 py-1.5 text-xs"
                  value={scaleKey}
                  onChange={(e) => setScaleKey(e.target.value)}
                >
                  {Object.keys(SCALES).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Root */}
              <div className="mb-4">
                <div className="mb-2 text-[9px] uppercase tracking-wider text-text-muted">Root Key</div>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(ROOTS).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRootKey(r)}
                      className={`rounded px-2 py-1 text-[10px] font-bold ${
                        rootKey === r
                          ? 'bg-brand-gold text-white'
                          : 'bg-surface-page text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed */}
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-[9px] text-text-muted">
                  <span>Speed</span><span>{speed}</span>
                </div>
                <input
                  type="range" min="10" max="100" value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full accent-brand-gold"
                />
              </div>

              {/* Note Duration */}
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-[9px] text-text-muted">
                  <span>Note Duration</span><span>{noteDur.toFixed(2)}s</span>
                </div>
                <input
                  type="range" min="0.1" max="2.0" step="0.05" value={noteDur}
                  onChange={(e) => setNoteDur(Number(e.target.value))}
                  className="w-full accent-brand-gold"
                />
              </div>
            </>
          )}

          {/* Volume (all modes) */}
          <div className="mb-3">
            <div className="mb-1 flex justify-between text-[9px] text-text-muted">
              <span>Volume</span><span>{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range" min="0" max="1" step="0.05" value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full accent-brand-gold"
            />
          </div>
        </div>

        {/* Right: Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {mode === 'instruments' && (
            <div>
              <div className="mb-4">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter text to sonify. Each character becomes a note..."
                  className="h-32 w-full rounded-md border border-border-default bg-surface-card p-3 font-mono text-xs text-text-primary outline-none focus:border-brand-gold"
                />
              </div>
              <button
                onClick={sonifyText}
                disabled={!text.trim() || playing === 'sonify'}
                className="rounded-md bg-brand-gold px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-gold/90 disabled:opacity-50"
              >
                {playing === 'sonify' ? 'Playing...' : 'Sonify Text'}
              </button>

              <div className="mt-6 rounded-md border border-border-default bg-surface-page p-4 text-xs text-text-muted">
                <strong className="text-text-secondary">How it works:</strong> Each character maps to a scale degree + octave
                via ASCII arithmetic. The velocity varies by character code. The instrument synthesises the note procedurally
                via Web Audio API oscillators, filters, and gain envelopes. No samples, no external dependencies.
              </div>
            </div>
          )}

          {mode === 'nature' && (
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(NATURE_SOUNDS).map(([key, snd]) => (
                <SoundCard
                  key={key}
                  label={snd.label}
                  icon={snd.icon}
                  color={snd.color}
                  playing={playing === key}
                  onClick={() => playNatureSound(key)}
                />
              ))}
            </div>
          )}

          {mode === 'animals' && (
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(ANIMAL_SOUNDS).map(([key, snd]) => (
                <SoundCard
                  key={key}
                  label={snd.label}
                  icon={snd.icon}
                  color={snd.color}
                  playing={playing === key}
                  onClick={() => playAnimalSound(key)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
