'use client';

/**
 * Krystyna — JD Suite AI Companion.
 *
 * Behaviour:
 * — Floating, draggable launcher (position persisted in localStorage)
 * — Three panel sizes: compact (380x520), expanded (480x680), fullscreen
 * — Keyboard shortcuts: Cmd/Ctrl+J open/close, Cmd/Ctrl+Shift+J fullscreen, Esc close, Cmd/Ctrl+Enter send
 * — Real backend: /api/ai/companion (multi-turn, context-aware)
 * — Voice input: Web Speech API; mic button transcribes into the message box
 * — Page context: pathname, selected JD (via useJDStore), locale
 * — Honest error states: NOT_CONFIGURED / AI_ERROR / network — never silent "No response received"
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useJDStore } from '@/hooks/use-jd-store';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type Size = 'compact' | 'expanded' | 'fullscreen';
type Mood = 'idle' | 'thinking' | 'listening' | 'error';

const STORAGE_LAUNCHER_POS = 'krystyna:launcher:pos';
const STORAGE_PANEL_SIZE = 'krystyna:panel:size';
const STORAGE_HISTORY = 'krystyna:history';

const QUICK_ACTIONS = [
  'Is this JD ready for pay equity evaluation?',
  'What is missing before we send this to Axiomera?',
  'Suggest 3 improvements for this JD.',
  'Compare this JD with the linked process map.',
  'Generate a Command Center task list for this org.',
  'Explain why this role is on this band.',
];

interface SpeechRecognitionInstance {
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

function getSR(): { new (): SpeechRecognitionInstance } | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { SpeechRecognition?: { new (): SpeechRecognitionInstance }; webkitSpeechRecognition?: { new (): SpeechRecognitionInstance } }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: { new (): SpeechRecognitionInstance } }).webkitSpeechRecognition ||
    null;
}

/**
 * Krystyna avatar — warm friendly face under a builder's helmet.
 *
 * Design notes:
 * — Round peach-toned face (not grey), sized so the helmet sits naturally on top
 * — Big round eyes with pupils + highlight, eyebrows for expression
 * — Gentle smile that bends per mood (no eerie flat line)
 * — Helmet has a real brim with shadow, a domed top, and a centred crest stripe
 * — Cheek blush adds warmth without being childish
 * — Mood-driven: idle / thinking / listening / error
 */
function KrystynaAvatar({ mood = 'idle', size = 36 }: { mood?: Mood; size?: number }) {
  // Mood-driven geometry
  const browLeft =
    mood === 'thinking' ? 'M19 24 L25 22.5'
    : mood === 'error' ? 'M19 23.5 L25 22'
    : 'M19.5 23 L24.5 22.5';
  const browRight =
    mood === 'thinking' ? 'M27 22.5 L33 24'
    : mood === 'error' ? 'M27 22 L33 23.5'
    : 'M27.5 22.5 L32.5 23';
  const mouthD =
    mood === 'thinking' ? 'M22.5 33 Q26 32 29.5 33'   // pursed
    : mood === 'error' ? 'M22.5 33.5 Q26 35 29.5 33.5' // tiny frown
    : mood === 'listening' ? 'M22 32.5 Q26 35 30 32.5' // open smile
    : 'M22.5 32.5 Q26 34.5 29.5 32.5';                  // soft smile

  const eyeOpen = mood !== 'thinking';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 52 52"
      className={cn('shrink-0', mood === 'thinking' && 'motion-safe:animate-pulse')}
      aria-label={`Krystyna (${mood})`}
    >
      <defs>
        <radialGradient id="krystyna-face" cx="40%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#FAE2C8" />
          <stop offset="60%" stopColor="#EFCBA6" />
          <stop offset="100%" stopColor="#D9A77E" />
        </radialGradient>
        <linearGradient id="krystyna-helmet" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E85B45" />
          <stop offset="60%" stopColor="#C9382A" />
          <stop offset="100%" stopColor="#A02619" />
        </linearGradient>
        <linearGradient id="krystyna-brim" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#7B1A12" />
          <stop offset="100%" stopColor="#5A110B" />
        </linearGradient>
      </defs>

      {/* ---------- Face ---------- */}
      {/* Soft drop shadow under chin */}
      <ellipse cx="26" cy="46" rx="11" ry="1.2" fill="#000" opacity="0.08" />
      {/* Face circle */}
      <circle cx="26" cy="32" r="13.5" fill="url(#krystyna-face)" stroke="#A87650" strokeWidth="0.6" />
      {/* Cheek blush */}
      <circle cx="18.5" cy="34" r="2.2" fill="#E89A7B" opacity="0.45" />
      <circle cx="33.5" cy="34" r="2.2" fill="#E89A7B" opacity="0.45" />
      {/* Eyebrows */}
      <path d={browLeft} stroke="#3A2418" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d={browRight} stroke="#3A2418" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* Eyes */}
      {eyeOpen ? (
        <>
          {/* whites */}
          <ellipse cx="22" cy="29.5" rx="2" ry="2.3" fill="#FFFFFF" />
          <ellipse cx="30" cy="29.5" rx="2" ry="2.3" fill="#FFFFFF" />
          {/* pupils */}
          <circle cx="22.2" cy="30" r="1.15" fill="#2A1810" />
          <circle cx="30.2" cy="30" r="1.15" fill="#2A1810" />
          {/* highlights */}
          <circle cx="21.7" cy="29.4" r="0.45" fill="#FFFFFF" />
          <circle cx="29.7" cy="29.4" r="0.45" fill="#FFFFFF" />
        </>
      ) : (
        // Closed/concentrating eyes — tiny arcs
        <>
          <path d="M20 30 Q22 28.5 24 30" stroke="#2A1810" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <path d="M28 30 Q30 28.5 32 30" stroke="#2A1810" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        </>
      )}
      {/* Nose hint */}
      <path d="M25.5 31.5 Q26 33 26.5 31.5" stroke="#A87650" strokeWidth="0.6" fill="none" strokeLinecap="round" opacity="0.55" />
      {/* Mouth */}
      <path d={mouthD} stroke="#3A2418" strokeWidth="1.3" fill="none" strokeLinecap="round" />

      {/* ---------- Helmet ---------- */}
      {/* Hair peek at sides under helmet (warm brown) */}
      <path d="M12.5 22 Q12 26 15 28 L15 22 Z" fill="#6B4226" opacity="0.55" />
      <path d="M39.5 22 Q40 26 37 28 L37 22 Z" fill="#6B4226" opacity="0.55" />

      {/* Helmet brim (sits ON the head, projects forward) */}
      <path
        d="M5.5 21.5 Q26 17.8 46.5 21.5 L46.5 24.4 Q26 23 5.5 24.4 Z"
        fill="url(#krystyna-brim)"
      />

      {/* Helmet dome */}
      <path
        d="M8.5 22 Q8.5 5 26 5 Q43.5 5 43.5 22 Z"
        fill="url(#krystyna-helmet)"
      />
      {/* Dome highlight (soft top-left sheen) */}
      <path
        d="M11 18 Q12 9 22 6 Q15 9 13 19 Z"
        fill="#FFFFFF"
        opacity="0.18"
      />
      {/* Crest stripe — runs front-to-back over the dome */}
      <path
        d="M22.5 5.4 Q22.5 14 22 22 L30 22 Q29.5 14 29.5 5.4 Q26 5 22.5 5.4 Z"
        fill="#F8DDB0"
      />
      {/* Crest stripe inner shadow line */}
      <path
        d="M26 5.5 L26 22"
        stroke="#C9A875"
        strokeWidth="0.4"
        opacity="0.6"
      />
      {/* Brim front line (separates brim from dome) */}
      <path d="M5.5 21.6 Q26 18 46.5 21.6" stroke="#5A110B" strokeWidth="0.6" fill="none" />

      {/* Listening pulse — small mic dot near helmet */}
      {mood === 'listening' && (
        <>
          <circle cx="45" cy="14" r="2.6" fill="#E85B45" />
          <circle cx="45" cy="14" r="2.6" fill="#E85B45" opacity="0.4" className="motion-safe:animate-ping" />
        </>
      )}
      {/* Error pip */}
      {mood === 'error' && (
        <circle cx="45" cy="14" r="2.6" fill="#B23B2C" />
      )}
    </svg>
  );
}

export function AICompanion() {
  const pathname = usePathname();
  const { jdId, jd, dqsScore, ersScore } = useJDStore();

  // Launcher position
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 24, y: 24 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  const dragMoved = useRef(false);

  // Panel state
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<Size>('compact');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<{ message: string; code: string } | null>(null);
  const [mood, setMood] = useState<Mood>('idle');

  // Voice
  const [recording, setRecording] = useState(false);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceSupported = useRef(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Restore persisted state on mount
  useEffect(() => {
    voiceSupported.current = !!getSR();
    try {
      const rawPos = localStorage.getItem(STORAGE_LAUNCHER_POS);
      if (rawPos) {
        const parsed = JSON.parse(rawPos);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          // Clamp into viewport on next frame so we have window dims
          const clamp = () => {
            const maxX = Math.max(8, window.innerWidth - 64);
            const maxY = Math.max(8, window.innerHeight - 64);
            setPos({ x: Math.min(Math.max(parsed.x, 8), maxX), y: Math.min(Math.max(parsed.y, 8), maxY) });
          };
          clamp();
        }
      } else {
        // Default bottom-right
        setPos({ x: typeof window !== 'undefined' ? window.innerWidth - 80 : 24, y: typeof window !== 'undefined' ? window.innerHeight - 80 : 24 });
      }
      const rawSize = localStorage.getItem(STORAGE_PANEL_SIZE);
      if (rawSize === 'compact' || rawSize === 'expanded' || rawSize === 'fullscreen') setSize(rawSize);
      const rawHist = sessionStorage.getItem(STORAGE_HISTORY);
      if (rawHist) {
        const parsed = JSON.parse(rawHist);
        if (Array.isArray(parsed)) setMessages(parsed.slice(-20));
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  // Persist size + history
  useEffect(() => {
    try { localStorage.setItem(STORAGE_PANEL_SIZE, size); } catch { /* ignore */ }
  }, [size]);
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_HISTORY, JSON.stringify(messages.slice(-20))); } catch { /* ignore */ }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  // Focus input when opening
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Mood follows loading + error
  useEffect(() => {
    if (loading) setMood('thinking');
    else if (errorState) setMood('error');
    else if (recording) setMood('listening');
    else setMood('idle');
  }, [loading, errorState, recording]);

  // Keyboard shortcuts: Cmd/Ctrl+J, Cmd/Ctrl+Shift+J, Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (e.shiftKey) {
          setOpen(true);
          setSize('fullscreen');
        } else {
          setOpen((o) => !o);
        }
      } else if (e.key === 'Escape' && open) {
        if (size === 'fullscreen') setSize('expanded');
        else setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, size]);

  // Drag handlers (pointer events)
  const onPointerDown = (e: React.PointerEvent) => {
    if (open) return;
    dragMoved.current = false;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragOffset.current) return;
    dragMoved.current = true;
    const x = e.clientX - dragOffset.current.x;
    const y = e.clientY - dragOffset.current.y;
    const maxX = window.innerWidth - 64;
    const maxY = window.innerHeight - 64;
    setPos({ x: Math.min(Math.max(x, 8), maxX), y: Math.min(Math.max(y, 8), maxY) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    if (dragOffset.current) {
      try { localStorage.setItem(STORAGE_LAUNCHER_POS, JSON.stringify(pos)); } catch { /* ignore */ }
    }
    dragOffset.current = null;
    // If user didn't move, treat as click → open
    if (!dragMoved.current) setOpen(true);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  // Send message
  const send = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || loading) return;
      setInput('');
      setErrorState(null);
      const next = [...messages, { role: 'user' as const, content: msg }];
      setMessages(next);
      setLoading(true);
      try {
        const ctx = {
          pathname,
          locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
          selectedJD: jdId
            ? {
                id: jdId,
                jobTitle: jd?.jobTitle || undefined,
                status: jd?.status || undefined,
                dqsScore: dqsScore || undefined,
                ersScore: ersScore ?? undefined,
              }
            : undefined,
        };
        const res = await fetch('/api/ai/companion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: next, context: ctx }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorState({
            message: data.error || `Request failed (${res.status})`,
            code: data.code || 'ERROR',
          });
          return;
        }
        const reply = (data.reply || '').trim();
        if (!reply) {
          setErrorState({
            message: 'Krystyna returned an empty response. Try rephrasing.',
            code: 'EMPTY',
          });
          return;
        }
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Network error';
        setErrorState({ message, code: 'NETWORK' });
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, pathname, jdId, jd, dqsScore, ersScore],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if ((mod && e.key === 'Enter') || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      send();
    }
  };

  // Voice
  const startVoice = () => {
    const SR = getSR();
    if (!SR) {
      setErrorState({ message: 'Voice input is not supported in this browser. Try Chrome or Edge.', code: 'VOICE_UNSUPPORTED' });
      return;
    }
    try {
      const rec = new SR();
      rec.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let final = '';
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i] as ArrayLike<{ transcript: string }> & { isFinal: boolean };
          const t = r[0]?.transcript || '';
          if (r.isFinal) final += t;
          else interim += t;
        }
        if (final) setInput((prev) => (prev ? prev + ' ' : '') + final);
        else if (interim) setInput((prev) => prev.replace(/ \[\.\.\..*$/, '') + ` [...${interim.trim()}]`);
      };
      rec.onerror = (ev) => {
        setErrorState({ message: `Voice error: ${ev.error}`, code: 'VOICE_ERROR' });
        setRecording(false);
      };
      rec.onend = () => {
        setRecording(false);
        setInput((prev) => prev.replace(/ \[\.\.\..*$/, ''));
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (err) {
      setErrorState({ message: err instanceof Error ? err.message : 'Voice failed', code: 'VOICE_ERROR' });
    }
  };
  const stopVoice = () => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setRecording(false);
  };

  const clearChat = () => {
    setMessages([]);
    setErrorState(null);
    try { sessionStorage.removeItem(STORAGE_HISTORY); } catch { /* ignore */ }
  };

  // ---------- Render ----------

  // Launcher (when closed)
  if (!open) {
    return (
      <div
        role="button"
        aria-label="Open Krystyna AI Companion (Cmd+J)"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Krystyna · drag to move · Cmd/Ctrl+J to open"
        className={cn(
          'fixed z-[60] flex h-14 w-14 cursor-grab select-none items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 transition-shadow hover:shadow-xl',
          dragging && 'cursor-grabbing shadow-2xl',
        )}
        style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
      >
        <KrystynaAvatar mood="idle" size={44} />
      </div>
    );
  }

  // Panel
  const panelClass =
    size === 'fullscreen'
      ? 'fixed inset-4 z-[70]'
      : size === 'expanded'
      ? 'fixed bottom-6 right-6 z-[70] h-[680px] w-[480px]'
      : 'fixed bottom-6 right-6 z-[70] h-[520px] w-[380px]';

  return (
    <div className={cn(panelClass, 'flex flex-col overflow-hidden rounded-xl border border-border-default bg-white shadow-2xl')}>
      {/* Header */}
      <div className="shrink-0 border-b border-border-default bg-surface-header px-4 py-3">
        <div className="flex items-center gap-3">
          <KrystynaAvatar mood={mood} size={32} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[13px] tracking-wide text-text-on-dark">Krystyna</h3>
            <p className="truncate text-[9px] text-text-on-dark/40">
              {pathname || 'JD Suite'}
              {jd?.jobTitle ? ` · ${jd.jobTitle}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {size !== 'compact' && (
              <button
                onClick={() => setSize('compact')}
                className="rounded px-1.5 py-1 text-[10px] text-text-on-dark/40 hover:bg-white/10 hover:text-text-on-dark/80"
                title="Compact"
              >
                ▭
              </button>
            )}
            {size !== 'expanded' && (
              <button
                onClick={() => setSize('expanded')}
                className="rounded px-1.5 py-1 text-[10px] text-text-on-dark/40 hover:bg-white/10 hover:text-text-on-dark/80"
                title="Expanded"
              >
                ◫
              </button>
            )}
            {size !== 'fullscreen' && (
              <button
                onClick={() => setSize('fullscreen')}
                className="rounded px-1.5 py-1 text-[10px] text-text-on-dark/40 hover:bg-white/10 hover:text-text-on-dark/80"
                title="Fullscreen (Cmd+Shift+J)"
              >
                ⛶
              </button>
            )}
            <button
              onClick={clearChat}
              className="rounded px-1.5 py-1 text-[9px] text-text-on-dark/40 hover:bg-white/10 hover:text-text-on-dark/80"
              title="Clear conversation"
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded px-1.5 py-1 text-[10px] text-text-on-dark/40 hover:bg-white/10 hover:text-text-on-dark/80"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !loading && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              I'm Krystyna. Ask me about this JD, the architecture matrix, your processes, or what you should do next.
            </p>
            <div className={cn('grid gap-1.5', size === 'compact' ? 'grid-cols-1' : 'grid-cols-2')}>
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-lg border border-border-default px-2.5 py-2 text-left text-[10px] text-text-secondary transition-colors hover:border-brand-gold/40 hover:bg-brand-gold-lighter"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[12px] leading-relaxed',
              m.role === 'user'
                ? 'ml-auto bg-brand-gold/10 text-text-primary'
                : 'bg-surface-page text-text-secondary',
            )}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <KrystynaAvatar mood="thinking" size={20} />
            <span>Krystyna is thinking…</span>
          </div>
        )}
        {errorState && (
          <div className="rounded-md border border-danger/30 bg-danger-bg p-2.5 text-[11px] text-danger">
            <div className="font-medium">
              {errorState.code === 'NOT_CONFIGURED' && 'AI Companion is not configured'}
              {errorState.code === 'UNAUTHORIZED' && 'Sign in to use Krystyna'}
              {errorState.code === 'AI_ERROR' && 'AI request failed'}
              {errorState.code === 'NETWORK' && 'Network problem'}
              {errorState.code === 'EMPTY' && 'Empty response'}
              {!['NOT_CONFIGURED', 'UNAUTHORIZED', 'AI_ERROR', 'NETWORK', 'EMPTY'].includes(errorState.code) && 'Error'}
            </div>
            <div className="mt-0.5 opacity-90">{errorState.message}</div>
            {errorState.code !== 'NOT_CONFIGURED' && (
              <button
                onClick={() => {
                  const last = [...messages].reverse().find((m) => m.role === 'user');
                  if (last) {
                    setMessages((prev) => prev.filter((m) => m !== last));
                    send(last.content);
                  }
                }}
                className="mt-2 rounded border border-danger/40 bg-white px-2 py-0.5 text-[10px] font-medium text-danger hover:bg-danger/5"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border-default p-3">
        <div className="flex items-end gap-2 rounded-lg border border-border-default bg-surface-page px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={recording ? 'Listening…' : 'Ask Krystyna…  (Cmd+Enter to send)'}
            rows={size === 'compact' ? 1 : 2}
            className="flex-1 resize-none bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted"
          />
          <button
            type="button"
            onClick={recording ? stopVoice : startVoice}
            disabled={loading}
            className={cn(
              'shrink-0 rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors',
              recording
                ? 'bg-danger text-white motion-safe:animate-pulse'
                : 'border border-border-default bg-white text-text-secondary hover:border-brand-gold hover:text-brand-gold',
            )}
            title={recording ? 'Stop recording' : 'Voice input'}
            aria-label={recording ? 'Stop voice input' : 'Start voice input'}
          >
            {recording ? '■' : '🎙'}
          </button>
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="shrink-0 rounded-md bg-brand-gold px-3 py-1.5 text-[10px] font-medium text-white transition-opacity disabled:opacity-30"
          >
            Send
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[9px] text-text-muted">
          <span>Cmd/Ctrl+J · Cmd/Ctrl+Shift+J fullscreen · Esc close</span>
          <span>Krystyna proposes — humans decide.</span>
        </div>
      </div>
    </div>
  );
}
