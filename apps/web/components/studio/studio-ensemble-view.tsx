'use client';

import { useState, useRef, useEffect } from 'react';
import {
  INSTRUMENTS, NATURE_SOUNDS, ANIMAL_SOUNDS,
  SCALES, ROOTS, LANGUAGE_ROOTS,
  charToEvent,
  audioBufToWav,
} from '@/lib/studio/engine';

type LayerKind = 'instrument' | 'nature' | 'animal';
interface Layer {
  id: string;
  kind: LayerKind;
  slug: string;
  volume: number;
  muted: boolean;
}

const LS_KEY = 'jdgc_ensemble_layers';

export default function StudioEnsembleView() {
  const [text, setText] = useState('The future of work is transparent and fair.');
  const [language, setLanguage] = useState<string>('EN');
  const [scaleName, setScaleName] = useState<string>('major');
  const [speed, setSpeed] = useState(130);
  const [noteDur, setNoteDur] = useState(0.28);
  const [masterVol, setMasterVol] = useState(0.8);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [playing, setPlaying] = useState(false);
  const [rendering, setRendering] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  // Load saved ensemble
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setLayers(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(layers)); } catch { /* ignore */ }
  }, [layers]);

  const addLayer = (kind: LayerKind, slug: string) => {
    setLayers(L => [...L, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind, slug, volume: 0.7, muted: false }]);
  };
  const removeLayer = (id: string) => setLayers(L => L.filter(x => x.id !== id));
  const updateLayer = (id: string, patch: Partial<Layer>) =>
    setLayers(L => L.map(x => x.id === id ? { ...x, ...patch } : x));

  const ensureCtx = () => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  };

  const playEnsemble = async () => {
    if (playing) return;
    const ctx = ensureCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    setPlaying(true);
    const master = ctx.createGain();
    master.gain.value = masterVol;
    master.connect(ctx.destination);

    const rootFreq = ROOTS[LANGUAGE_ROOTS[language] || 'C'] || 261.63;
    const scale = SCALES[scaleName] || SCALES.major;
    const noteInterval = 60 / speed;
    const startAt = ctx.currentTime + 0.1;
    const totalDur = Math.min(30, text.length * noteInterval);

    for (const layer of layers) {
      if (layer.muted) continue;
      const gain = ctx.createGain();
      gain.gain.value = layer.volume;
      gain.connect(master);

      if (layer.kind === 'instrument') {
        const inst = INSTRUMENTS[layer.slug];
        if (!inst) continue;
        for (let i = 0; i < text.length; i++) {
          const ev = charToEvent(text.charCodeAt(i), scale, rootFreq);
          if (!ev) continue;
          const t = startAt + i * noteInterval;
          try { inst.play(ctx, gain, ev.freq, ev.vel, t, noteDur); } catch { /* ignore */ }
        }
      } else if (layer.kind === 'nature') {
        const sd = NATURE_SOUNDS[layer.slug];
        if (!sd) continue;
        try { sd.play(ctx, gain, layer.volume, totalDur); } catch { /* ignore */ }
      } else if (layer.kind === 'animal') {
        const sd = ANIMAL_SOUNDS[layer.slug];
        if (!sd) continue;
        try { sd.play(ctx, gain, layer.volume, startAt); } catch { /* ignore */ }
      }
    }

    setTimeout(() => setPlaying(false), (totalDur + 1) * 1000);
  };

  const renderEnsembleWav = async () => {
    if (rendering || layers.length === 0) return;
    setRendering(true);
    try {
      const rootFreq = ROOTS[LANGUAGE_ROOTS[language] || 'C'] || 261.63;
      const scale = SCALES[scaleName] || SCALES.major;
      const noteInterval = 60 / speed;
      const totalDur = Math.min(30, text.length * noteInterval + 1);
      const off = new OfflineAudioContext(2, Math.ceil(44100 * totalDur), 44100);
      const master = off.createGain();
      master.gain.value = masterVol;
      master.connect(off.destination);

      for (const layer of layers) {
        if (layer.muted) continue;
        const gain = off.createGain();
        gain.gain.value = layer.volume;
        gain.connect(master);
        if (layer.kind === 'instrument') {
          const inst = INSTRUMENTS[layer.slug];
          if (!inst) continue;
          for (let i = 0; i < text.length; i++) {
            const ev = charToEvent(text.charCodeAt(i), scale, rootFreq);
            if (!ev) continue;
            const t = i * noteInterval;
            try { inst.play(off, gain, ev.freq, ev.vel, t, noteDur); } catch { /* ignore */ }
          }
        } else if (layer.kind === 'nature') {
          const sd = NATURE_SOUNDS[layer.slug];
          if (!sd) continue;
          try { sd.play(off, gain, layer.volume, totalDur); } catch { /* ignore */ }
        } else if (layer.kind === 'animal') {
          const sd = ANIMAL_SOUNDS[layer.slug];
          if (!sd) continue;
          try { sd.play(off, gain, layer.volume, 0); } catch { /* ignore */ }
        }
      }

      const buf = await off.startRendering();
      const wav = audioBufToWav(buf);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `ensemble-${Date.now()}.wav`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setRendering(false);
    }
  };

  const presets: Record<string, Layer[]> = {
    'Pay Transparency · Lite': [
      { id: 'p1', kind: 'instrument', slug: 'kalimba', volume: 0.75, muted: false },
      { id: 'p2', kind: 'nature', slug: 'lightRain', volume: 0.35, muted: false },
    ],
    'Boardroom · Grave': [
      { id: 'p3', kind: 'instrument', slug: 'pianoGrand', volume: 0.8, muted: false },
      { id: 'p4', kind: 'nature', slug: 'distantThunder', volume: 0.25, muted: false },
    ],
    'Wild · Nature': [
      { id: 'p5', kind: 'nature', slug: 'brook', volume: 0.6, muted: false },
      { id: 'p6', kind: 'animal', slug: 'owl', volume: 0.4, muted: false },
      { id: 'p7', kind: 'instrument', slug: 'flute', volume: 0.55, muted: false },
    ],
  };

  const applyPreset = (name: string) => {
    setLayers(presets[name].map(l => ({ ...l, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })));
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1300px]">
        <h1 className="mb-1 font-display text-2xl font-bold text-text-primary">Studio Ensemble</h1>
        <p className="mb-6 text-[13px] text-text-secondary">
          Layer instruments, nature beds and animals. Save mixes · render to WAV · evoke a JD's tonal character.
        </p>

        {/* Presets */}
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.keys(presets).map(name => (
            <button
              key={name}
              type="button"
              onClick={() => applyPreset(name)}
              className="rounded-full border border-border-default bg-white px-3 py-1.5 text-[11px] text-text-primary hover:border-brand-gold"
            >
              ♪ {name}
            </button>
          ))}
          {layers.length > 0 && (
            <button
              type="button"
              onClick={() => setLayers([])}
              className="rounded-full border border-border-default bg-surface-page px-3 py-1.5 text-[11px] text-text-muted"
            >
              Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Controls */}
          <div className="col-span-4 space-y-3">
            <div className="rounded-xl border border-border-default bg-white p-4">
              <label className="mb-1 block text-[11px] font-semibold text-text-primary">Source Text</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 240))}
                className="w-full resize-y rounded-md border border-border-default bg-surface-page px-3 py-2 text-[13px]"
                style={{ minHeight: 80 }}
              />
              <div className="mt-1 text-[10px] text-text-muted">{text.length}/240 characters</div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] uppercase text-text-muted">Language / Root</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as typeof language)}
                    className="w-full rounded-md border border-border-default bg-surface-page px-2 py-1.5 text-[12px]"
                  >
                    {Object.keys(LANGUAGE_ROOTS).map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase text-text-muted">Scale</label>
                  <select
                    value={scaleName}
                    onChange={(e) => setScaleName(e.target.value as typeof scaleName)}
                    className="w-full rounded-md border border-border-default bg-surface-page px-2 py-1.5 text-[12px]"
                  >
                    {Object.keys(SCALES).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-[11px]">
                <label className="flex items-center gap-2">
                  <span className="w-16 text-text-muted">Speed</span>
                  <input type="range" min={60} max={220} value={speed} onChange={e => setSpeed(+e.target.value)} className="flex-1" />
                  <span className="w-10 text-right tabular-nums">{speed}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-16 text-text-muted">NoteDur</span>
                  <input type="range" min={0.1} max={0.8} step={0.05} value={noteDur} onChange={e => setNoteDur(+e.target.value)} className="flex-1" />
                  <span className="w-10 text-right tabular-nums">{noteDur.toFixed(2)}</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-16 text-text-muted">Master</span>
                  <input type="range" min={0} max={1} step={0.02} value={masterVol} onChange={e => setMasterVol(+e.target.value)} className="flex-1" />
                  <span className="w-10 text-right tabular-nums">{masterVol.toFixed(2)}</span>
                </label>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={playEnsemble}
                  disabled={playing || layers.length === 0}
                  className="flex-1 rounded-md bg-brand-gold px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
                >
                  {playing ? '◼ Playing…' : '▶ Play Ensemble'}
                </button>
                <button
                  type="button"
                  onClick={renderEnsembleWav}
                  disabled={rendering || layers.length === 0}
                  className="rounded-md border border-border-default bg-white px-3 py-2 text-xs text-text-primary disabled:opacity-40"
                >
                  {rendering ? '…' : '↓ WAV'}
                </button>
              </div>
            </div>

            {/* Palettes */}
            <PalettePicker title="Instruments" options={Object.keys(INSTRUMENTS)} onPick={slug => addLayer('instrument', slug)} />
            <PalettePicker title="Nature" options={Object.keys(NATURE_SOUNDS)} onPick={slug => addLayer('nature', slug)} />
            <PalettePicker title="Animals" options={Object.keys(ANIMAL_SOUNDS)} onPick={slug => addLayer('animal', slug)} />
          </div>

          {/* Mixer */}
          <div className="col-span-8">
            <div className="rounded-xl border border-border-default bg-white">
              <div className="border-b border-border-default px-4 py-2 text-[11px] font-medium text-text-muted">
                Mixer · {layers.length} layer{layers.length === 1 ? '' : 's'}
              </div>
              {layers.length === 0 ? (
                <div className="p-10 text-center text-[13px] text-text-muted">
                  Pick instruments, nature or animals on the left to add layers, or apply a preset.
                </div>
              ) : (
                <div className="divide-y divide-border-default">
                  {layers.map((l, i) => (
                    <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-6 text-center font-mono text-[10px] text-text-muted">{i + 1}</span>
                      <span className="w-16 rounded bg-surface-page px-2 py-0.5 text-center text-[10px] font-medium uppercase text-text-secondary">
                        {l.kind}
                      </span>
                      <span className="min-w-[140px] text-[13px] text-text-primary">{l.slug}</span>
                      <input
                        type="range" min={0} max={1} step={0.02}
                        value={l.volume}
                        onChange={e => updateLayer(l.id, { volume: +e.target.value })}
                        className="flex-1"
                      />
                      <span className="w-10 text-right font-mono text-[11px] tabular-nums">{l.volume.toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => updateLayer(l.id, { muted: !l.muted })}
                        className={`rounded px-2 py-1 text-[10px] ${l.muted ? 'bg-danger-bg text-danger' : 'bg-surface-page text-text-secondary'}`}
                      >
                        {l.muted ? 'MUTED' : 'on'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLayer(l.id)}
                        className="rounded border border-border-default px-2 py-1 text-[10px] text-text-muted hover:text-danger"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PalettePicker({ title, options, onPick }: { title: string; options: string[]; onPick: (slug: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-border-default bg-white">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between border-b border-border-default px-4 py-2 text-[11px] font-medium text-text-primary"
      >
        <span>{title} · {options.length}</span>
        <span className="text-text-muted">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-1 p-2">
          {options.map(o => (
            <button
              key={o}
              type="button"
              onClick={() => onPick(o)}
              className="rounded bg-surface-page px-2 py-1.5 text-left text-[11px] text-text-primary hover:bg-[#FAF6EE]"
            >
              + {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
