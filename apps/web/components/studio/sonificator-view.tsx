'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  INSTRUMENTS,
  NATURE_SOUNDS,
  ANIMAL_SOUNDS,
  SCALES,
  ROOTS,
  charToEvent,
  midiToFreq,
} from '@/lib/studio/engine';
import { THEMES, scheduleTheme, themeDuration, type Theme } from '@/lib/studio/themes';
import { scheduleFskBroadcast, fskDuration, FSK_MAX_CHARS } from '@/lib/studio/fsk';
import { QRCodeBlock } from '@/components/qr/qr-code';
import { cn } from '@/lib/utils';

type Tab = 'orchestra' | 'themes' | 'palette';

interface JDLite {
  id: string;
  jobTitle: string;
  status: string;
  folder: string | null;
}

interface OrchestraTrack {
  id: string;        // local UUID
  jdId: string;
  jobTitle: string;
  /** Sound source — instrument | nature | animal */
  soundType: 'instrument' | 'nature' | 'animal';
  soundKey: string;
  vol: number;       // 0..1
  pan: number;       // -1..1
  scaleKey: string;  // for instrument tracks only
  rootKey: string;
  muted: boolean;
  solo: boolean;
}

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: 'bg-amber-100', fg: 'text-amber-700', label: 'Draft' },
  UNDER_REVISION: { bg: 'bg-blue-100', fg: 'text-blue-700', label: 'In review' },
  APPROVED: { bg: 'bg-emerald-100', fg: 'text-emerald-700', label: 'Approved' },
  ARCHIVED: { bg: 'bg-stone-100', fg: 'text-stone-500', label: 'Archived' },
};

export function SonificatorView() {
  const [tab, setTab] = useState<Tab>('orchestra');
  const [jds, setJDs] = useState<JDLite[]>([]);
  const [tracks, setTracks] = useState<OrchestraTrack[]>([]);
  const [loadingJDs, setLoadingJDs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [tempo, setTempo] = useState(80); // 60..160 BPM master
  const [themeMix, setThemeMix] = useState(0.25); // 0..1 — theme volume vs orchestra
  const [masterVol, setMasterVol] = useState(0.8); // 0..1
  const [broadcasting, setBroadcasting] = useState<{ token: string; until: number } | null>(null);
  const [receiverQrOpen, setReceiverQrOpen] = useState(false);
  const receiverQrRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const sourcesRef = useRef<Array<OscillatorNode | AudioBufferSourceNode>>([]);
  const stopTimerRef = useRef<number | null>(null);

  // Load JDs once
  useEffect(() => {
    let cancelled = false;
    fetch('/api/jd')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data) => {
        if (cancelled) return;
        const lite: JDLite[] = (data || []).map((j: any) => ({
          id: j.id,
          jobTitle: j.jobTitle || 'Untitled',
          status: j.status,
          folder: j.folder,
        }));
        setJDs(lite);
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoadingJDs(false); });
    return () => { cancelled = true; };
  }, []);

  const filteredJDs = useMemo(() => {
    if (!search.trim()) return jds.slice(0, 60);
    const q = search.trim().toLowerCase();
    return jds.filter((j) =>
      j.jobTitle.toLowerCase().includes(q) ||
      (j.folder || '').toLowerCase().includes(q),
    ).slice(0, 60);
  }, [jds, search]);

  const addedJDIds = useMemo(() => new Set(tracks.map((t) => t.jdId)), [tracks]);
  const instrumentKeys = useMemo(() => Object.keys(INSTRUMENTS), []);

  const addJDToOrchestra = (jd: JDLite) => {
    if (addedJDIds.has(jd.id)) return;
    // Auto-assign next instrument round-robin
    const inst = instrumentKeys[tracks.length % instrumentKeys.length];
    setTracks((prev) => [
      ...prev,
      {
        id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        jdId: jd.id,
        jobTitle: jd.jobTitle,
        soundType: 'instrument',
        soundKey: inst,
        vol: 0.6,
        pan: 0,
        scaleKey: 'major',
        rootKey: 'C',
        muted: false,
        solo: false,
      },
    ]);
  };

  const removeTrack = (id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTrack = (id: string, patch: Partial<OrchestraTrack>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const ensureCtx = (): AudioContext => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      ctxRef.current = new Ctor();
    }
    return ctxRef.current!;
  };

  const stopAll = () => {
    sourcesRef.current.forEach((s) => { try { s.stop(); } catch { /* ignore */ } });
    sourcesRef.current = [];
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    setPlaying(false);
    setPaused(false);
    if (ctxRef.current && ctxRef.current.state === 'suspended') {
      try { ctxRef.current.resume(); } catch { /* ignore */ }
    }
  };

  const pausePlayback = async () => {
    if (!ctxRef.current || !playing) return;
    if (paused) {
      try { await ctxRef.current.resume(); } catch { /* ignore */ }
      setPaused(false);
    } else {
      try { await ctxRef.current.suspend(); } catch { /* ignore */ }
      setPaused(true);
    }
  };

  // Live master volume — keep gain node value in sync with state
  useEffect(() => {
    if (masterGainRef.current) masterGainRef.current.gain.value = masterVol;
  }, [masterVol]);

  // Cleanup on unmount — kill audio so it doesn't leak across pages
  useEffect(() => () => {
    sourcesRef.current.forEach((s) => { try { s.stop(); } catch { /* ignore */ } });
    if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current);
    if (ctxRef.current) { try { ctxRef.current.close(); } catch { /* ignore */ } }
  }, []);

  // Close receiver QR popover on click-outside or Escape
  useEffect(() => {
    if (!receiverQrOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setReceiverQrOpen(false); };
    const onMouse = (e: MouseEvent) => {
      if (receiverQrRef.current && !receiverQrRef.current.contains(e.target as Node)) {
        setReceiverQrOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouse);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouse);
    };
  }, [receiverQrOpen]);

  /**
   * Play the orchestra: each track plays its assigned sound for the JD title text,
   * driven by the engine's character-to-event encoding. Optional theme music plays
   * underneath all tracks.
   */
  const playOrchestra = async () => {
    if (tracks.length === 0 && !currentTheme) return;
    stopAll();

    const ctx = ensureCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    const now = ctx.currentTime;
    const beatDur = 60 / tempo;
    const noteDur = beatDur * 0.85;

    const master = ctx.createGain();
    master.gain.value = masterVol;
    master.connect(ctx.destination);
    masterGainRef.current = master;

    // Schedule theme underneath
    let themeDur = 0;
    if (currentTheme) {
      themeDur = scheduleTheme(ctx, currentTheme, now, master, themeMix);
    }

    // Mute/Solo logic — if any track is solo, only solo tracks play
    const soloActive = tracks.some((t) => t.solo);
    const trackAudible = (t: OrchestraTrack) =>
      !t.muted && (soloActive ? t.solo : true);

    // Schedule each track
    let maxTrackDur = 0;
    tracks.forEach((track, idx) => {
      if (!trackAudible(track)) return;
      const text = track.jobTitle || 'JD';
      const chars = Array.from(text);
      const trackOffset = idx * 0.05; // slight stagger so they don't all hit on beat 0

      const trackGain = ctx.createGain();
      trackGain.gain.value = track.vol;
      const panNode = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panNode) {
        panNode.pan.value = track.pan;
        trackGain.connect(panNode);
        panNode.connect(master);
      } else {
        trackGain.connect(master);
      }

      if (track.soundType === 'instrument') {
        const inst = INSTRUMENTS[track.soundKey] || INSTRUMENTS.piano;
        const sc = SCALES[track.scaleKey] || SCALES.major;
        const rf = ROOTS[track.rootKey] || 261.63;
        chars.forEach((ch, i) => {
          const ev = charToEvent(ch.charCodeAt(0), sc, rf);
          if (!ev) return;
          const t0 = now + trackOffset + i * beatDur;
          // Use the instrument's own play function (handles synthesis details)
          inst.play(ctx as AudioContext, trackGain, ev.freq, ev.vel || 0.7, t0, noteDur);
        });
        const trackTotal = chars.length * beatDur + noteDur;
        if (trackTotal > maxTrackDur) maxTrackDur = trackTotal;
      } else {
        // Nature / animal: render a single short pulse per JD (not per char)
        // Simplified: short sine burst at a frequency derived from the title
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
        sourcesRef.current.push(osc);
        if (dur > maxTrackDur) maxTrackDur = dur;
      }
    });

    const totalDur = Math.max(themeDur, maxTrackDur, 1);
    setPlaying(true);
    stopTimerRef.current = window.setTimeout(() => {
      setPlaying(false);
      sourcesRef.current = [];
    }, totalDur * 1000 + 200);
  };

  const playTheme = async (theme: Theme) => {
    stopAll();
    const ctx = ensureCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    const dur = scheduleTheme(ctx, theme, ctx.currentTime, undefined, 0.5);
    setPlaying(true);
    setCurrentTheme(theme);
    stopTimerRef.current = window.setTimeout(() => setPlaying(false), dur * 1000 + 200);
  };

  /**
   * Broadcast a short audible token using FSK. The token format is
   *   jd:<short-id>
   * for a single-JD orchestra, or
   *   orc:<count>:<first-id>
   * for a multi-track orchestra.  Receiver page (/sonification/receiver)
   * decodes and resolves to a JD link.
   */
  const broadcastToken = async () => {
    if (broadcasting) return;
    let payload = '';
    if (tracks.length === 1) {
      payload = `jd:${tracks[0].jdId.slice(0, 18)}`;
    } else if (tracks.length > 1) {
      payload = `orc:${tracks.length}:${tracks[0].jdId.slice(0, 14)}`;
    } else {
      setError('Add at least one JD to the orchestra before broadcasting.');
      setTimeout(() => setError(null), 4000);
      return;
    }
    const truncated = payload.slice(0, FSK_MAX_CHARS);
    const ctx = ensureCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    const dur = fskDuration(truncated.length);
    scheduleFskBroadcast(ctx, truncated, ctx.currentTime, ctx.destination, { volume: 0.45 });
    const until = Date.now() + dur * 1000 + 200;
    setBroadcasting({ token: truncated, until });
    window.setTimeout(() => setBroadcasting(null), dur * 1000 + 250);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border-default bg-white px-6 py-4">
        <div className="mx-auto flex max-w-[1400px] items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">
              Sonification · Studio
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
              Sonificator
            </h1>
            <p className="mt-1 max-w-[680px] text-[12px] leading-relaxed text-text-muted">
              Build an audio orchestra from your JDs — pick multiple JDs, assign each one a sound,
              optionally play a theme underneath. Procedural audio only, no external files.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Master volume */}
            <label className="flex items-center gap-1.5 rounded-full border border-border-default bg-white px-3 py-1.5 text-[10px] text-text-muted">
              <span className="font-medium text-text-secondary">Master</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(masterVol * 100)}
                onChange={(e) => setMasterVol(parseInt(e.target.value, 10) / 100)}
                className="w-20 accent-brand-gold"
                title={`Master volume ${Math.round(masterVol * 100)}%`}
              />
              <span className="w-7 text-right tabular-nums">{Math.round(masterVol * 100)}</span>
            </label>

            {/* Transport */}
            {!playing ? (
              <>
                <button
                  onClick={playOrchestra}
                  disabled={tracks.length === 0 && !currentTheme}
                  className="rounded-full bg-brand-gold px-4 py-1.5 text-[11px] font-medium text-white hover:bg-brand-gold/90 disabled:opacity-40"
                  title="Play orchestra"
                >
                  ▶ Play
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={pausePlayback}
                  className="rounded-full border border-border-default bg-white px-3 py-1.5 text-[11px] font-medium text-text-primary hover:border-brand-gold"
                  title={paused ? 'Resume' : 'Pause'}
                >
                  {paused ? '▶ Resume' : '❚❚ Pause'}
                </button>
                <button
                  onClick={() => { stopAll(); setTimeout(playOrchestra, 50); }}
                  className="rounded-full border border-border-default bg-white px-3 py-1.5 text-[11px] font-medium text-text-primary hover:border-brand-gold"
                  title="Restart from beginning"
                >
                  ↻ Restart
                </button>
                <button
                  onClick={stopAll}
                  className="rounded-full bg-text-primary px-3 py-1.5 text-[11px] font-medium text-white"
                  title="Stop"
                >
                  ■ Stop
                </button>
              </>
            )}

            {/* Broadcast token */}
            <button
              onClick={broadcastToken}
              disabled={tracks.length === 0 || !!broadcasting}
              className="rounded-full border border-brand-gold bg-white px-3 py-1.5 text-[11px] font-medium text-brand-gold transition-colors hover:bg-brand-gold-lighter disabled:opacity-40"
              title="Broadcast a short audible token that another device can decode at /sonification/receiver"
            >
              {broadcasting ? `📡 Broadcasting…` : '📡 Broadcast'}
            </button>

            {/* Receiver QR popover */}
            <div ref={receiverQrRef} className="relative">
              <button
                onClick={() => setReceiverQrOpen((v) => !v)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors',
                  receiverQrOpen
                    ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                    : 'border-border-default bg-white text-text-secondary hover:border-brand-gold hover:text-brand-gold',
                )}
                title="Open Receiver page on another device"
              >
                ⊞ Receiver QR
              </button>
              {receiverQrOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border-default bg-white shadow-xl">
                  <div className="border-b border-border-default px-4 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-brand-gold">Receiver</div>
                    <p className="mt-0.5 text-[10px] text-text-muted">
                      Open this page on another device to decode the FSK broadcast.
                    </p>
                  </div>
                  <div className="p-3">
                    <QRCodeBlock
                      url={typeof window !== 'undefined' ? `${window.location.origin}/sonification/receiver` : '/sonification/receiver'}
                      title="Sonification Receiver"
                      size={160}
                      fileName="jd-suite-receiver"
                      className="w-full border-0 p-0"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-border-default bg-white px-6">
        <div className="mx-auto flex max-w-[1400px] gap-0">
          {([
            { id: 'orchestra', label: 'Orchestra', desc: 'Pick JDs and assign sounds' },
            { id: 'themes', label: 'Theme music', desc: 'Pick theme to play under the orchestra' },
            { id: 'palette', label: 'Sound palette', desc: 'Browse all available instruments and sounds' },
          ] as { id: Tab; label: string; desc: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'whitespace-nowrap border-b-2 px-4 py-2.5 text-[11px] font-medium transition-colors',
                tab === t.id
                  ? 'border-brand-gold text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-secondary',
              )}
              title={t.desc}
            >
              {t.label}
              {t.id === 'orchestra' && tracks.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-brand-gold/15 px-1.5 text-[9px] font-bold text-brand-gold">
                  {tracks.length}
                </span>
              )}
              {t.id === 'themes' && currentTheme && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-emerald-100 px-1.5 text-[9px] font-bold text-emerald-700">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-surface-page">
        <div className="mx-auto max-w-[1400px] p-6">
          {error && (
            <div className="mb-4 rounded-md border border-danger/30 bg-danger-bg p-2 text-xs text-danger">
              {error}
            </div>
          )}

          {/* TAB: Orchestra */}
          {tab === 'orchestra' && (
            <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
              {/* JD picker */}
              <div className="rounded-xl border border-border-default bg-white">
                <div className="border-b border-border-default p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-brand-gold">
                    Add JDs to orchestra
                  </div>
                  <p className="mt-0.5 text-[10px] text-text-muted">
                    Multi-select. Each JD becomes a track with its own assigned sound.
                  </p>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPickerOpen(true); }}
                    placeholder="Search JDs by title or folder…"
                    className="mt-2 w-full rounded-full border border-border-default bg-surface-page px-3 py-1.5 text-[11px] outline-none focus:border-brand-gold focus:bg-white"
                  />
                </div>
                <div className="max-h-[480px] overflow-y-auto">
                  {loadingJDs ? (
                    <div className="p-6 text-center text-xs text-text-muted">Loading JDs…</div>
                  ) : filteredJDs.length === 0 ? (
                    <div className="p-6 text-center text-xs text-text-muted">
                      {search.trim() ? 'No JDs match the search.' : 'No JDs in this org yet.'}
                    </div>
                  ) : (
                    <ul className="divide-y divide-border-default">
                      {filteredJDs.map((jd) => {
                        const added = addedJDIds.has(jd.id);
                        const pill = STATUS_PILL[jd.status] || STATUS_PILL.DRAFT;
                        return (
                          <li key={jd.id}>
                            <button
                              onClick={() => addJDToOrchestra(jd)}
                              disabled={added}
                              className={cn(
                                'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
                                added ? 'cursor-default bg-surface-page opacity-60' : 'hover:bg-surface-page',
                              )}
                            >
                              <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]', added ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-gold/10 text-brand-gold')}>
                                {added ? '✓' : '+'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="truncate text-[11px] text-text-primary">{jd.jobTitle}</div>
                                {jd.folder && <div className="truncate text-[9px] text-text-muted">{jd.folder}</div>}
                              </div>
                              <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider', pill.bg, pill.fg)}>
                                {pill.label}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {/* Tracks */}
              <div className="rounded-xl border border-border-default bg-white">
                <div className="flex items-center justify-between border-b border-border-default p-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-brand-gold">
                      Orchestra ({tracks.length} {tracks.length === 1 ? 'track' : 'tracks'})
                    </div>
                    <p className="mt-0.5 text-[10px] text-text-muted">
                      Each JD plays its title encoded as notes. Theme music plays underneath if selected.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[10px] text-text-muted">
                      Tempo
                      <input
                        type="range"
                        min={60}
                        max={160}
                        value={tempo}
                        onChange={(e) => setTempo(parseInt(e.target.value, 10))}
                        className="w-24"
                      />
                      <span className="tabular-nums">{tempo}</span>
                    </label>
                    {currentTheme && (
                      <label className="flex items-center gap-1.5 text-[10px] text-text-muted">
                        Theme mix
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={themeMix * 100}
                          onChange={(e) => setThemeMix(parseInt(e.target.value, 10) / 100)}
                          className="w-20"
                        />
                      </label>
                    )}
                    {tracks.length > 0 && (
                      <button
                        onClick={() => setTracks([])}
                        className="rounded-full border border-border-default px-2.5 py-0.5 text-[10px] text-text-muted hover:border-danger hover:text-danger"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {currentTheme && (
                  <div className="border-b border-border-default bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                    Theme: <strong>{currentTheme.name}</strong> · {currentTheme.composer}
                    <button
                      onClick={() => setCurrentTheme(null)}
                      className="ml-2 text-[10px] text-emerald-700/70 hover:underline"
                    >
                      remove
                    </button>
                  </div>
                )}

                {tracks.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="text-2xl text-text-muted/40">♫</div>
                    <p className="mt-2 text-xs text-text-muted">
                      No tracks yet. Pick JDs from the left to start building your orchestra.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border-default">
                    {tracks.map((track, idx) => (
                      <TrackRow
                        key={track.id}
                        track={track}
                        index={idx}
                        onUpdate={(patch) => updateTrack(track.id, patch)}
                        onRemove={() => removeTrack(track.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* TAB: Themes */}
          {tab === 'themes' && (
            <div>
              <div className="mb-4 rounded-lg border border-info/20 bg-info-bg/40 p-3 text-[11px] text-info">
                Themes are <strong>synthesized in your browser</strong> using the Web Audio API. No external files,
                no copyright risk. Public-domain classical works (Beethoven, Mozart, Pachelbel, Grieg, Rossini)
                and original short themes. Pick a theme to play under your orchestra.
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {THEMES.map((theme) => {
                  const dur = Math.round(themeDuration(theme));
                  const active = currentTheme?.id === theme.id;
                  return (
                    <div
                      key={theme.id}
                      className={cn(
                        'rounded-xl border bg-white p-4 transition-all',
                        active ? 'border-brand-gold ring-2 ring-brand-gold/20' : 'border-border-default hover:border-brand-gold/40',
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-display text-sm font-semibold text-text-primary">{theme.name}</h3>
                          <div className="mt-0.5 text-[10px] text-text-muted">{theme.composer}</div>
                        </div>
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider',
                            theme.source === 'public_domain' ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-gold/15 text-brand-gold',
                          )}
                          title={theme.source === 'public_domain' ? 'Public domain — composer 70+ years deceased' : 'Original composition'}
                        >
                          {theme.source === 'public_domain' ? 'PD' : 'Orig'}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-text-muted">{theme.description}</p>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-text-muted">
                        <span>♩ {theme.tempo} BPM</span>
                        <span>{dur}s</span>
                      </div>
                      <div className="mt-3 flex gap-1">
                        <button
                          onClick={() => playTheme(theme)}
                          className="flex-1 rounded-full bg-brand-gold px-3 py-1 text-[10px] font-medium text-white hover:bg-brand-gold/90"
                        >
                          ▶ Preview
                        </button>
                        <button
                          onClick={() => setCurrentTheme(active ? null : theme)}
                          className={cn(
                            'flex-1 rounded-full border px-3 py-1 text-[10px] font-medium transition-colors',
                            active
                              ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                              : 'border-border-default text-text-secondary hover:border-brand-gold',
                          )}
                        >
                          {active ? '✓ Selected' : 'Use under orchestra'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: Palette */}
          {tab === 'palette' && (
            <div className="space-y-5">
              <PaletteSection title="Instruments" entries={Object.entries(INSTRUMENTS)} type="instrument" />
              <PaletteSection title="Nature sounds" entries={Object.entries(NATURE_SOUNDS)} type="nature" />
              <PaletteSection title="Animal sounds" entries={Object.entries(ANIMAL_SOUNDS)} type="animal" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrackRow({
  track,
  index,
  onUpdate,
  onRemove,
}: {
  track: OrchestraTrack;
  index: number;
  onUpdate: (patch: Partial<OrchestraTrack>) => void;
  onRemove: () => void;
}) {
  const instrumentKeys = Object.keys(INSTRUMENTS);
  const natureKeys = Object.keys(NATURE_SOUNDS);
  const animalKeys = Object.keys(ANIMAL_SOUNDS);
  const optionList =
    track.soundType === 'instrument' ? instrumentKeys :
    track.soundType === 'nature' ? natureKeys :
    animalKeys;

  return (
    <li className="grid items-center gap-2 px-3 py-2.5" style={{ gridTemplateColumns: 'auto 1fr auto auto auto auto auto auto auto' }}>
      <span className="text-[10px] font-mono text-text-muted">{index + 1}</span>
      <div className="min-w-0">
        <div className={cn('truncate text-[11px] font-medium', track.muted ? 'text-text-muted line-through' : 'text-text-primary')} title={track.jobTitle}>
          {track.jobTitle}
        </div>
        <div className="text-[9px] text-text-muted">
          {track.soundType} · {track.soundKey}
        </div>
      </div>
      {/* Mute */}
      <button
        onClick={() => onUpdate({ muted: !track.muted })}
        title={track.muted ? 'Unmute' : 'Mute'}
        className={cn(
          'rounded border px-1.5 py-0.5 text-[9px] font-bold transition-colors',
          track.muted ? 'border-danger bg-danger-bg text-danger' : 'border-border-default text-text-muted hover:border-danger hover:text-danger',
        )}
      >
        M
      </button>
      {/* Solo */}
      <button
        onClick={() => onUpdate({ solo: !track.solo })}
        title={track.solo ? 'Unsolo' : 'Solo (silences non-solo tracks)'}
        className={cn(
          'rounded border px-1.5 py-0.5 text-[9px] font-bold transition-colors',
          track.solo ? 'border-brand-gold bg-brand-gold-lighter text-brand-gold' : 'border-border-default text-text-muted hover:border-brand-gold hover:text-brand-gold',
        )}
      >
        S
      </button>
      <select
        value={track.soundType}
        onChange={(e) => {
          const t = e.target.value as OrchestraTrack['soundType'];
          const firstKey =
            t === 'instrument' ? instrumentKeys[0] :
            t === 'nature' ? natureKeys[0] :
            animalKeys[0];
          onUpdate({ soundType: t, soundKey: firstKey });
        }}
        className="rounded border border-border-default bg-white px-1.5 py-0.5 text-[10px]"
      >
        <option value="instrument">Instrument</option>
        <option value="nature">Nature</option>
        <option value="animal">Animal</option>
      </select>
      <select
        value={track.soundKey}
        onChange={(e) => onUpdate({ soundKey: e.target.value })}
        className="max-w-[120px] truncate rounded border border-border-default bg-white px-1.5 py-0.5 text-[10px]"
      >
        {optionList.map((k) => (
          <option key={k} value={k}>{k}</option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-[9px] text-text-muted">
        Vol
        <input
          type="range"
          min={0}
          max={100}
          value={track.vol * 100}
          onChange={(e) => onUpdate({ vol: parseInt(e.target.value, 10) / 100 })}
          className="w-16"
        />
      </label>
      <label className="flex items-center gap-1 text-[9px] text-text-muted">
        Pan
        <input
          type="range"
          min={-100}
          max={100}
          value={track.pan * 100}
          onChange={(e) => onUpdate({ pan: parseInt(e.target.value, 10) / 100 })}
          className="w-16"
        />
      </label>
      <button
        onClick={onRemove}
        className="text-text-muted hover:text-danger"
        title="Remove track"
      >
        ✕
      </button>
    </li>
  );
}

function PaletteSection({
  title,
  entries,
  type,
}: {
  title: string;
  entries: [string, any][];
  type: 'instrument' | 'nature' | 'animal';
}) {
  return (
    <div className="rounded-xl border border-border-default bg-white p-4">
      <h3 className="mb-3 font-display text-sm font-semibold text-text-primary">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {entries.map(([key, def]) => (
          <div key={key} className="rounded-lg border border-border-default bg-surface-page p-2 text-center">
            <div className="text-base">{def.emoji || (type === 'instrument' ? '♪' : type === 'nature' ? '🌿' : '🐾')}</div>
            <div className="mt-1 text-[10px] font-medium text-text-primary">{def.label || key}</div>
            <div className="text-[8px] text-text-muted">{key}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
