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
const STORAGE_SETTINGS = 'jdgc_settings';

interface CompanionSettings {
  name: string;
  avatar: string;
  locale: string;
  voiceLang: string;
  notionToken: string;
  notionWorkerUrl: string;
  notionParentPageId: string;
}

/** Read companion settings from shared jdgc_settings localStorage key. */
function loadCompanionSettings(): CompanionSettings {
  const defaults: CompanionSettings = { name: 'Krystyna', avatar: 'default', locale: 'en', voiceLang: 'auto', notionToken: '', notionWorkerUrl: '', notionParentPageId: '' };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS);
    if (!raw) return defaults;
    const p = JSON.parse(raw);
    return {
      name: (typeof p.companionName === 'string' && p.companionName.trim()) ? p.companionName.trim() : 'Krystyna',
      avatar: typeof p.companionAvatar === 'string' ? p.companionAvatar : 'default',
      locale: typeof p.interfaceLanguage === 'string' ? p.interfaceLanguage : 'en',
      voiceLang: typeof p.voiceLang === 'string' ? p.voiceLang : 'auto',
      notionToken: typeof p.notionToken === 'string' ? p.notionToken : '',
      notionWorkerUrl: typeof p.workerUrl === 'string' ? p.workerUrl : '',
      notionParentPageId: typeof p.notionParentPageId === 'string' ? p.notionParentPageId : '',
    };
  } catch {
    return defaults;
  }
}

type JDSummary = { id: string; jobTitle?: string | null; status?: string };

async function fetchJDList(): Promise<JDSummary[]> {
  try {
    const res = await fetch('/api/jd');
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return (data as JDSummary[]).slice(0, 30).map((j) => ({ id: j.id, jobTitle: j.jobTitle, status: j.status }));
  } catch {
    return [];
  }
}

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
 * Krystyna avatar — official design from the brand reference.
 *
 * Design is fixed (per spec). The only thing that changes per mood is the
 * mouth/eye geometry and a subtle blink animation on idle.
 *
 * Key visual elements (preserved from reference):
 * — Bold black outer circle border, off-white inside
 * — Red helmet with black outline, cream stripe over the crown,
 *   yellow hexagonal front badge, two small white reflective patches
 * — Round peach face below helmet
 * — Distinctive Z-shaped brow+nose line on the right
 * — Two simple black dot eyes
 * — Round pink cheek blushes
 * — Soft chin shadow
 */
function KrystynaAvatar({ mood = 'idle', size = 36 }: { mood?: Mood; size?: number }) {
  // Mood-driven geometry — only mouth + eyes change.
  // Smile gently shifts; do not change the helmet, face, nose, or palette.
  const mouthD =
    mood === 'thinking'  ? 'M52 75 Q56 75 60 75'        // pursed flat
    : mood === 'error'    ? 'M52 76 Q56 79 60 76'        // tiny frown
    : mood === 'listening' ? 'M50 74 Q56 80 62 74'        // wider open smile
    :                        'M52 74 Q56 77 60 74';       // soft smile

  const eyesClosed = mood === 'thinking';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="shrink-0 [--blink-dur:5s]"
      aria-label={`Krystyna (${mood})`}
    >
      <defs>
        {/* Subtle blink keyframes — only used on idle */}
        <style>{`
          @keyframes krystyna-blink {
            0%, 92%, 100% { transform: scaleY(1); }
            95%, 97%      { transform: scaleY(0.1); }
          }
          .krystyna-eye {
            transform-box: fill-box;
            transform-origin: center;
          }
          @media (prefers-reduced-motion: no-preference) {
            .krystyna-blink {
              animation: krystyna-blink var(--blink-dur, 5s) infinite ease-in-out;
            }
          }
        `}</style>
      </defs>

      {/* ---------- Outer black-ringed white badge ---------- */}
      <circle cx="50" cy="50" r="48" fill="#FAFAF7" stroke="#1A1A1A" strokeWidth="2.4" />

      {/* ---------- Face (drawn first, helmet sits on top) ---------- */}
      {/* Chin shadow */}
      <ellipse cx="50" cy="86" rx="20" ry="1.8" fill="#1A1A1A" opacity="0.13" />
      {/* Face circle */}
      <circle cx="50" cy="62" r="22" fill="#F4D3B3" stroke="#1A1A1A" strokeWidth="1.8" />
      {/* Cheek blushes */}
      <circle cx="34" cy="69" r="3.2" fill="#F0A290" opacity="0.7" />
      <circle cx="66" cy="69" r="3.2" fill="#F0A290" opacity="0.7" />
      {/* Eyes — simple dots */}
      <circle
        cx="44" cy="62" r="1.8"
        fill="#1A1A1A"
        className={cn('krystyna-eye', mood === 'idle' && 'krystyna-blink')}
        style={eyesClosed ? { transform: 'scaleY(0.1)' } : undefined}
      />
      <circle
        cx="56" cy="62" r="1.8"
        fill="#1A1A1A"
        className={cn('krystyna-eye', mood === 'idle' && 'krystyna-blink')}
        style={eyesClosed ? { transform: 'scaleY(0.1)' } : undefined}
      />
      {/* Z-shaped brow + nose line on the right side of the face */}
      <path
        d="M50 56 Q55 53 60 57 L52 67 Q55 70 60 68"
        stroke="#1A1A1A"
        strokeWidth="1.7"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Mouth */}
      <path
        d={mouthD}
        stroke="#1A1A1A"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />

      {/* ---------- Helmet ---------- */}
      {/* Brim back (wider, projects forward) */}
      <path
        d="M16 44 Q22 40 28 38 Q40 35 50 35 Q60 35 72 38 Q78 40 84 44 L82 49 Q50 53 18 49 Z"
        fill="#D8392A"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Dome */}
      <path
        d="M27 41 Q27 19 50 19 Q73 19 73 41 L73 44 L27 44 Z"
        fill="#D8392A"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Brim/dome separator line */}
      <path d="M18 45 Q50 41 82 45" stroke="#1A1A1A" strokeWidth="1.6" fill="none" />

      {/* Cream stripe — sits over the crown, behind the badge */}
      <path
        d="M44 19 Q44 28 43 40 L57 40 Q56 28 56 19 Q53 18.5 50 18.5 Q47 18.5 44 19 Z"
        fill="#F4D9A8"
        stroke="#1A1A1A"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Yellow hexagonal badge */}
      <polygon
        points="50,30 56.5,33.5 56.5,40.5 50,44 43.5,40.5 43.5,33.5"
        fill="#F2C633"
        stroke="#1A1A1A"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* White reflective patches */}
      <rect x="30.5" y="40" width="6" height="2.2" fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="0.9" />
      <rect x="63.5" y="40" width="6" height="2.2" fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="0.9" />

      {/* ---------- Mood indicators (overlaid, do not modify the face design) ---------- */}
      {mood === 'listening' && (
        <>
          <circle cx="84" cy="22" r="4" fill="#D8392A" stroke="#1A1A1A" strokeWidth="1" />
          <circle cx="84" cy="22" r="4" fill="#D8392A" opacity="0.4" className="motion-safe:animate-ping" />
        </>
      )}
      {mood === 'error' && (
        <circle cx="84" cy="22" r="4" fill="#A02619" stroke="#1A1A1A" strokeWidth="1" />
      )}
      {mood === 'thinking' && (
        <g transform="translate(76 18)" className="motion-safe:animate-pulse">
          <circle r="2.2" fill="#1A1A1A" opacity="0.4" />
          <circle cx="6" r="2.2" fill="#1A1A1A" opacity="0.6" />
          <circle cx="12" r="2.2" fill="#1A1A1A" opacity="0.85" />
        </g>
      )}
    </svg>
  );
}

/**
 * Renders the companion avatar: custom uploaded image, a prebuilt emoji face,
 * or the default Krystyna SVG. Falls back to Krystyna on error.
 */
function CompanionAvatar({
  avatarSetting,
  mood = 'idle',
  size = 36,
}: {
  avatarSetting: string;
  mood?: Mood;
  size?: number;
}) {
  if (avatarSetting.startsWith('custom:')) {
    const src = avatarSetting.replace('custom:', '');
    return (
      <img
        src={src}
        alt="AI companion"
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  if (avatarSetting === 'assistant') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" aria-label="AI companion" className="shrink-0">
        <circle cx="50" cy="50" r="48" fill="#E8F0FE" stroke="#1A1A1A" strokeWidth="2.4" />
        <rect x="28" y="30" width="44" height="32" rx="8" fill="#4A7DFF" stroke="#1A1A1A" strokeWidth="2" />
        <circle cx="38" cy="46" r="5" fill="#FFFFFF" />
        <circle cx="62" cy="46" r="5" fill="#FFFFFF" />
        <rect x="44" y="62" width="12" height="4" rx="2" fill="#1A1A1A" />
        <rect x="46" y="22" width="8" height="10" rx="4" fill="#4A7DFF" stroke="#1A1A1A" strokeWidth="1.5" />
        <circle cx="50" cy="20" r="3" fill="#F2C633" stroke="#1A1A1A" strokeWidth="1.2" />
      </svg>
    );
  }
  if (avatarSetting === 'advisor') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" aria-label="AI companion" className="shrink-0">
        <circle cx="50" cy="50" r="48" fill="#FEF3E8" stroke="#1A1A1A" strokeWidth="2.4" />
        <ellipse cx="50" cy="55" rx="26" ry="28" fill="#C8935A" stroke="#1A1A1A" strokeWidth="2" />
        <ellipse cx="34" cy="48" rx="10" ry="13" fill="#C8935A" stroke="#1A1A1A" strokeWidth="1.5" />
        <ellipse cx="66" cy="48" rx="10" ry="13" fill="#C8935A" stroke="#1A1A1A" strokeWidth="1.5" />
        <circle cx="42" cy="54" r="6" fill="#FAFAF7" stroke="#1A1A1A" strokeWidth="1.5" />
        <circle cx="58" cy="54" r="6" fill="#FAFAF7" stroke="#1A1A1A" strokeWidth="1.5" />
        <circle cx="42" cy="54" r="3" fill="#1A1A1A" />
        <circle cx="58" cy="54" r="3" fill="#1A1A1A" />
        <path d="M44 66 Q50 70 56 66" stroke="#1A1A1A" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  if (avatarSetting === 'analyst') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" aria-label="AI companion" className="shrink-0">
        <circle cx="50" cy="50" r="48" fill="#F0FDF4" stroke="#1A1A1A" strokeWidth="2.4" />
        <circle cx="50" cy="52" r="26" fill="#5CB85C" stroke="#1A1A1A" strokeWidth="2" />
        <rect x="35" y="44" width="30" height="3" rx="1.5" fill="#FAFAF7" />
        <rect x="38" y="51" width="24" height="3" rx="1.5" fill="#FAFAF7" />
        <rect x="41" y="58" width="18" height="3" rx="1.5" fill="#FAFAF7" />
        <rect x="42" y="24" width="16" height="22" rx="4" fill="#FAFAF7" stroke="#1A1A1A" strokeWidth="1.5" />
        <circle cx="50" cy="35" r="4" fill="#5CB85C" />
      </svg>
    );
  }
  // Default: Krystyna
  return <KrystynaAvatar mood={mood} size={size} />;
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

  // Companion identity (read from settings localStorage on mount)
  const [companionName, setCompanionName] = useState('Krystyna');
  const [companionAvatar, setCompanionAvatar] = useState('default');
  const [companionLocale, setCompanionLocale] = useState('en');
  const [voiceLang, setVoiceLang] = useState('auto');

  // JD workspace list (fetched lazily on first open)
  const [jdList, setJdList] = useState<JDSummary[]>([]);

  // Notion integration
  const [notionSettings, setNotionSettings] = useState<{ token: string; workerUrl: string; parentPageId: string } | null>(null);
  const [notionSearchQuery, setNotionSearchQuery] = useState('');
  const [notionSearchOpen, setNotionSearchOpen] = useState(false);
  const [notionSearching, setNotionSearching] = useState(false);
  const [savingToNotion, setSavingToNotion] = useState(false);

  // Saved exchanges (set of assistant message indices that have been saved)
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());

  // Voice
  const [recording, setRecording] = useState(false);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceSupported = useRef(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Default = safe bottom-right corner, leaves the canvas free
  const defaultPos = useCallback(() => {
    if (typeof window === 'undefined') return { x: 24, y: 24 };
    return { x: window.innerWidth - 80, y: window.innerHeight - 80 };
  }, []);

  // Restore persisted state on mount + handle viewport resizes
  useEffect(() => {
    voiceSupported.current = !!getSR();
    // Load companion settings from localStorage
    const cs = loadCompanionSettings();
    setCompanionName(cs.name);
    setCompanionAvatar(cs.avatar);
    setCompanionLocale(cs.locale);
    setVoiceLang(cs.voiceLang);
    if (cs.notionToken && cs.notionWorkerUrl) {
      setNotionSettings({ token: cs.notionToken, workerUrl: cs.notionWorkerUrl, parentPageId: cs.notionParentPageId });
    }
    try {
      const rawPos = localStorage.getItem(STORAGE_LAUNCHER_POS);
      let next = defaultPos();
      if (rawPos) {
        const parsed = JSON.parse(rawPos);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) {
          const maxX = Math.max(8, window.innerWidth - 64);
          const maxY = Math.max(8, window.innerHeight - 64);
          next = {
            x: Math.min(Math.max(parsed.x, 8), maxX),
            y: Math.min(Math.max(parsed.y, 8), maxY),
          };
        }
      }
      setPos(next);
      const rawSize = localStorage.getItem(STORAGE_PANEL_SIZE);
      if (rawSize === 'compact' || rawSize === 'expanded' || rawSize === 'fullscreen') setSize(rawSize);
      const rawHist = sessionStorage.getItem(STORAGE_HISTORY);
      if (rawHist) {
        const parsedHist = JSON.parse(rawHist);
        if (Array.isArray(parsedHist)) setMessages(parsedHist.slice(-20));
      }
    } catch {
      // ignore corrupt storage
    }

    // Re-clamp launcher when the viewport shrinks (avoids it landing off-screen
    // or covering canvas content after layout changes)
    const onResize = () => {
      setPos((cur) => {
        const maxX = Math.max(8, window.innerWidth - 64);
        const maxY = Math.max(8, window.innerHeight - 64);
        const nx = Math.min(Math.max(cur.x, 8), maxX);
        const ny = Math.min(Math.max(cur.y, 8), maxY);
        return nx === cur.x && ny === cur.y ? cur : { x: nx, y: ny };
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [defaultPos]);

  // Double-click to reset launcher to bottom-right corner
  const resetPos = useCallback(() => {
    const fresh = defaultPos();
    setPos(fresh);
    try { localStorage.setItem(STORAGE_LAUNCHER_POS, JSON.stringify(fresh)); } catch { /* ignore */ }
  }, [defaultPos]);

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

  // Fetch JD list on first open (used to give Krystyna workspace awareness)
  useEffect(() => {
    if (!open || jdList.length > 0) return;
    fetchJDList().then(setJdList);
  }, [open, jdList.length]);

  // Notion: search workspace pages
  const searchNotion = useCallback(async () => {
    if (!notionSettings || !notionSearchQuery.trim()) return;
    setNotionSearching(true);
    try {
      const res = await fetch(notionSettings.workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'POST', path: 'search', token: notionSettings.token,
          body: { query: notionSearchQuery.trim(), filter: { property: 'object', value: 'page' }, page_size: 5 },
        }),
      });
      const data = await res.json();
      const results: Array<Record<string, unknown>> = data.results || [];
      const summary = results.length === 0
        ? `No Notion pages found for "${notionSearchQuery}".`
        : `Notion search: "${notionSearchQuery}" — ${results.length} page(s) found:\n${results.map((p) => {
            const props = p.properties as Record<string, { title?: Array<{ plain_text?: string }> }> | undefined;
            const title = props?.title?.title?.[0]?.plain_text || props?.Name?.title?.[0]?.plain_text || 'Untitled';
            return `- ${title}`;
          }).join('\n')}`;
      setMessages((prev) => [...prev, { role: 'assistant', content: summary }]);
      setNotionSearchQuery('');
      setNotionSearchOpen(false);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Notion search failed: ${err instanceof Error ? err.message : 'Network error'}` }]);
    } finally {
      setNotionSearching(false);
    }
  }, [notionSettings, notionSearchQuery]);

  // Notion: save conversation as a page
  const saveToNotion = useCallback(async () => {
    if (!notionSettings || messages.length === 0 || savingToNotion) return;
    setSavingToNotion(true);
    try {
      const title = `${companionName} — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      const blocks = messages.slice(0, 100).map((m) => ({
        object: 'block', type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: `[${m.role.toUpperCase()}] ${m.content.slice(0, 2000)}` } }],
        },
      }));
      const res = await fetch(notionSettings.workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'POST', path: 'pages', token: notionSettings.token,
          body: {
            parent: { page_id: notionSettings.parentPageId },
            properties: { title: { title: [{ type: 'text', text: { content: title } }] } },
            children: blocks,
          },
        }),
      });
      if (res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Conversation saved to Notion: "${title}"` }]);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Failed to save to Notion: ${err instanceof Error ? err.message : 'Network error'}` }]);
    } finally {
      setSavingToNotion(false);
    }
  }, [notionSettings, messages, companionName, savingToNotion]);

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
          locale: companionLocale || (typeof navigator !== 'undefined' ? navigator.language : undefined),
          companionName,
          jdList: jdList.length > 0 ? jdList : undefined,
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
    [input, loading, messages, pathname, jdId, jd, dqsScore, ersScore, companionLocale, companionName, jdList],
  );

  const saveExchange = useCallback(async (assistantIdx: number) => {
    const reply = messages[assistantIdx]?.content;
    const prompt = [...messages].slice(0, assistantIdx).reverse().find((m) => m.role === 'user')?.content;
    if (!prompt || !reply) return;
    try {
      await fetch('/api/companion/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, reply, context: { pathname } }),
      });
      setSavedIndices((prev) => new Set([...prev, assistantIdx]));
    } catch {
      // silent — saving is best-effort
    }
  }, [messages, pathname]);

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
      rec.lang = (voiceLang !== 'auto' ? voiceLang : null) || (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
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
        aria-label={`Open ${companionName} AI Companion (Cmd+J)`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={resetPos}
        title={`${companionName} · drag to move · double-click to reset position · Cmd/Ctrl+J to open`}
        className={cn(
          'fixed z-[60] flex h-14 w-14 cursor-grab select-none items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 transition-shadow hover:shadow-xl',
          dragging && 'cursor-grabbing shadow-2xl',
        )}
        style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
      >
        <CompanionAvatar avatarSetting={companionAvatar} mood="idle" size={44} />
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
          <CompanionAvatar avatarSetting={companionAvatar} mood={mood} size={32} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[13px] tracking-wide text-text-on-dark">{companionName}</h3>
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
            {notionSettings && (
              <>
                <button
                  onClick={() => setNotionSearchOpen((o) => !o)}
                  className="rounded px-1.5 py-1 text-[9px] text-text-on-dark/40 hover:bg-white/10 hover:text-text-on-dark/80"
                  title="Search Notion"
                >
                  ⊞
                </button>
                <button
                  onClick={saveToNotion}
                  disabled={savingToNotion || messages.length === 0}
                  className="rounded px-1.5 py-1 text-[9px] text-text-on-dark/40 hover:bg-white/10 hover:text-text-on-dark/80 disabled:opacity-30"
                  title="Save to Notion"
                >
                  {savingToNotion ? '…' : '↗'}
                </button>
              </>
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

      {/* Notion search bar — slides in when open */}
      {notionSearchOpen && (
        <div className="shrink-0 border-b border-border-default bg-surface-page px-3 py-2">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={notionSearchQuery}
              onChange={(e) => setNotionSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') searchNotion(); if (e.key === 'Escape') setNotionSearchOpen(false); }}
              placeholder="Search Notion pages…"
              className="flex-1 rounded-md border border-border-default bg-white px-2.5 py-1.5 text-[11px] text-text-primary outline-none focus:border-brand-gold"
            />
            <button
              onClick={searchNotion}
              disabled={notionSearching || !notionSearchQuery.trim()}
              className="rounded-md bg-brand-gold px-2.5 py-1.5 text-[10px] font-medium text-white disabled:opacity-40"
            >
              {notionSearching ? '…' : 'Search'}
            </button>
          </div>
          <p className="mt-1 text-[9px] text-text-muted">Results injected as context. Then ask {companionName} about them.</p>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !loading && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              I&apos;m {companionName}. Ask me about this JD, the architecture matrix, your processes, or what you should do next.
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
          <div key={i} className={cn('group flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
            <div
              className={cn(
                'max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[12px] leading-relaxed',
                m.role === 'user'
                  ? 'bg-brand-gold/10 text-text-primary'
                  : 'bg-surface-page text-text-secondary',
              )}
            >
              {m.content}
            </div>
            {m.role === 'assistant' && (
              <button
                onClick={() => saveExchange(i)}
                disabled={savedIndices.has(i)}
                className={cn(
                  'mt-0.5 text-[9px] transition-colors',
                  savedIndices.has(i)
                    ? 'cursor-default text-success'
                    : 'text-text-muted opacity-0 hover:text-brand-gold group-hover:opacity-100',
                )}
                title={savedIndices.has(i) ? 'Saved' : 'Save this exchange'}
              >
                {savedIndices.has(i) ? '✓ Saved' : '⊕ Save'}
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <CompanionAvatar avatarSetting={companionAvatar} mood="thinking" size={20} />
            <span>{companionName} is thinking…</span>
          </div>
        )}
        {errorState && (
          <div className="rounded-md border border-danger/30 bg-danger-bg p-2.5 text-[11px] text-danger">
            <div className="font-medium">
              {errorState.code === 'NOT_CONFIGURED' && 'AI Companion is not configured'}
              {errorState.code === 'UNAUTHORIZED' && `Sign in to use ${companionName}`}
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
            placeholder={recording ? 'Listening…' : `Ask ${companionName}…  (Cmd+Enter to send)`}
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
          <span>{companionName} proposes — humans decide.</span>
        </div>
      </div>
    </div>
  );
}
