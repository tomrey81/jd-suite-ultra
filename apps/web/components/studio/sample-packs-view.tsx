'use client';

import { useMemo, useState } from 'react';
import { INSTRUMENTS, NATURE_SOUNDS, ANIMAL_SOUNDS } from '@/lib/studio/engine';

type Pack = {
  slug: string;
  name: string;
  blurb: string;
  accent: string;
  instruments: string[];
  nature: string[];
  animals: string[];
};

const PACKS: Pack[] = [
  {
    slug: 'orchestral',
    name: 'Orchestral',
    blurb: 'Grand piano, kalimba and strings over soft rain — for leadership and governance JDs.',
    accent: '#8A7560',
    instruments: ['pianoGrand', 'kalimba', 'flute'],
    nature: ['lightRain', 'distantThunder'],
    animals: [],
  },
  {
    slug: 'wildlife',
    name: 'Wildlife',
    blurb: 'Brooks, owls and wolf packs — for field, environmental or community roles.',
    accent: '#3C6E47',
    instruments: ['flute'],
    nature: ['brook', 'wind'],
    animals: ['owl', 'wolfPack', 'hawk', 'whale'],
  },
  {
    slug: 'cinematic',
    name: 'Cinematic',
    blurb: 'Crackling embers, distant thunder, deep piano — for high-impact or board-level roles.',
    accent: '#6B2A2A',
    instruments: ['pianoGrand', 'synthBass'],
    nature: ['cracklingEmbers', 'distantThunder', 'oceanDepth'],
    animals: [],
  },
  {
    slug: 'tech',
    name: 'Tech',
    blurb: 'Synth bass + bells over heavy rain — for engineering, data and product roles.',
    accent: '#1F4FA3',
    instruments: ['synthBass', 'bell', 'pluck'],
    nature: ['heavyRain', 'wind'],
    animals: [],
  },
  {
    slug: 'pay-transparency',
    name: 'Pay Transparency',
    blurb: 'Soft kalimba + brook — calm, honest, EUPTD-aligned signal.',
    accent: '#1D7A3C',
    instruments: ['kalimba', 'flute'],
    nature: ['brook', 'lightRain'],
    animals: [],
  },
  {
    slug: 'wilderness',
    name: 'Wilderness',
    blurb: 'Storm, blizzard and wolf — for expedition, outdoor or security roles.',
    accent: '#243043',
    instruments: ['pluck'],
    nature: ['storm', 'blizzard', 'wind'],
    animals: ['wolfPack', 'hawk'],
  },
];

const LS_SOLO = 'jdgc_studio_solo_preset';
const LS_ENS  = 'jdgc_ensemble_layers';

export default function SamplePacksView() {
  const [selected, setSelected] = useState<Pack | null>(null);

  const counts = useMemo(() => ({
    instruments: Object.keys(INSTRUMENTS).length,
    nature:      Object.keys(NATURE_SOUNDS).length,
    animals:     Object.keys(ANIMAL_SOUNDS).length,
  }), []);

  const previewPack = async (pack: Pack) => {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    const start = ctx.currentTime + 0.1;
    const dur = 4.5;

    // One short phrase on the first instrument
    if (pack.instruments[0]) {
      const inst = INSTRUMENTS[pack.instruments[0]];
      const notes = [261.63, 293.66, 329.63, 392.00, 440.00];
      notes.forEach((freq, i) => {
        try { inst.play(ctx, master, freq, 0.9, start + i * 0.25, 0.22); } catch {}
      });
    }
    // One nature bed
    if (pack.nature[0]) {
      try { NATURE_SOUNDS[pack.nature[0]].play(ctx, master, 0.35, dur); } catch {}
    }
    // One animal call
    if (pack.animals[0]) {
      try { ANIMAL_SOUNDS[pack.animals[0]].play(ctx, master, 0.4, start + 0.8); } catch {}
    }

    setTimeout(() => ctx.close(), (dur + 0.5) * 1000);
  };

  const applyToEnsemble = (pack: Pack) => {
    const layers = [
      ...pack.instruments.map((slug, i) => ({ id: `pk-i-${i}-${Date.now()}`, kind: 'instrument' as const, slug, volume: 0.7, muted: false })),
      ...pack.nature.map((slug, i) => ({ id: `pk-n-${i}-${Date.now()}`, kind: 'nature' as const, slug, volume: 0.4, muted: false })),
      ...pack.animals.map((slug, i) => ({ id: `pk-a-${i}-${Date.now()}`, kind: 'animal' as const, slug, volume: 0.5, muted: false })),
    ];
    try {
      localStorage.setItem(LS_ENS, JSON.stringify(layers));
      alert(`Applied "${pack.name}" to Studio Ensemble. Open Studio Ensemble to play it.`);
    } catch {
      alert('Could not write to localStorage.');
    }
  };

  const applyToSolo = (pack: Pack) => {
    const preset = {
      instrument: pack.instruments[0] || 'kalimba',
      nature: pack.nature[0] || null,
      animal: pack.animals[0] || null,
    };
    try {
      localStorage.setItem(LS_SOLO, JSON.stringify(preset));
      alert(`Applied "${pack.name}" as Studio Solo default.`);
    } catch {
      alert('Could not write to localStorage.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1300px]">
        <h1 className="mb-1 font-display text-2xl font-bold text-text-primary">Sample Packs</h1>
        <p className="mb-6 text-[13px] text-text-secondary">
          Curated preset bundles — {counts.instruments} instruments · {counts.nature} nature · {counts.animals} animals.
          Preview, apply to Solo, or push directly to Ensemble.
        </p>

        <div className="grid grid-cols-3 gap-4">
          {PACKS.map(pack => (
            <div
              key={pack.slug}
              className="group cursor-pointer overflow-hidden rounded-xl border border-border-default bg-white transition-all hover:border-brand-gold hover:shadow-md"
              onClick={() => setSelected(pack)}
            >
              <div className="h-20 w-full" style={{ backgroundColor: pack.accent }} />
              <div className="p-4">
                <div className="mb-1 font-display text-lg font-bold text-text-primary">{pack.name}</div>
                <div className="mb-3 text-[12px] leading-[1.5] text-text-secondary">{pack.blurb}</div>
                <div className="flex flex-wrap gap-1">
                  {pack.instruments.map(s => <span key={s} className="rounded bg-[#FAF6EE] px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">🎹 {s}</span>)}
                  {pack.nature.map(s => <span key={s} className="rounded bg-[#EAF1E9] px-1.5 py-0.5 font-mono text-[10px] text-[#3C6E47]">🌿 {s}</span>)}
                  {pack.animals.map(s => <span key={s} className="rounded bg-[#EDE6F6] px-1.5 py-0.5 font-mono text-[10px] text-[#5A3B8C]">🐾 {s}</span>)}
                </div>
                <div className="mt-3 flex gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); previewPack(pack); }}
                    className="flex-1 rounded-md bg-brand-gold px-2 py-1.5 text-[11px] font-medium text-white"
                  >
                    ▶ Preview
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); applyToSolo(pack); }}
                    className="rounded-md border border-border-default bg-white px-2 py-1.5 text-[11px] text-text-primary"
                  >
                    Solo
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); applyToEnsemble(pack); }}
                    className="rounded-md border border-border-default bg-white px-2 py-1.5 text-[11px] text-text-primary"
                  >
                    Ensemble
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
            onClick={() => setSelected(null)}
          >
            <div
              className="max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="font-display text-xl text-text-primary">{selected.name}</div>
                <button type="button" onClick={() => setSelected(null)} className="text-text-muted">✕</button>
              </div>
              <div className="mb-4 text-[13px] text-text-secondary">{selected.blurb}</div>
              <div className="grid grid-cols-3 gap-3 text-[12px]">
                <div>
                  <div className="mb-1 text-[10px] uppercase text-text-muted">Instruments</div>
                  {selected.instruments.map(s => <div key={s}>{s}</div>)}
                </div>
                <div>
                  <div className="mb-1 text-[10px] uppercase text-text-muted">Nature</div>
                  {selected.nature.map(s => <div key={s}>{s}</div>)}
                </div>
                <div>
                  <div className="mb-1 text-[10px] uppercase text-text-muted">Animals</div>
                  {selected.animals.map(s => <div key={s}>{s}</div>) || 'none'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
