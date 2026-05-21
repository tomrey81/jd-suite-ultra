'use client';

/**
 * Mobile Companion — Krystyna on the go.
 *
 * Full-screen mobile-optimised chat interface. Large voice button,
 * text input, auto-transcript saved via /api/ai/companion.
 * Designed to be opened from the QR code inside the desktop panel.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number }; resultIndex: number }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getSR(): { new(): SpeechRecognitionInstance } | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { SpeechRecognition?: { new(): SpeechRecognitionInstance }; webkitSpeechRecognition?: { new(): SpeechRecognitionInstance } }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: { new(): SpeechRecognitionInstance } }).webkitSpeechRecognition ||
    null;
}

export default function MobileCompanionPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [interim, setInterim] = useState('');
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    setError('');
    const next: Message[] = [...messages, { role: 'user', content: msg, ts: Date.now() }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          context: { pathname: '/mobile-companion', companionName: 'Krystyna' },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Request failed'); return; }
      const reply = (data.reply || '').trim();
      if (!reply) { setError('Empty response — try again'); return; }
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, ts: Date.now() }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const startVoice = () => {
    const SR = getSR();
    if (!SR) { setError('Voice not supported in this browser. Use Chrome on Android or Safari on iOS.'); return; }
    try {
      const rec = new SR();
      rec.lang = navigator.language || 'en-US';
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let final = '';
        let inter = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i] as ArrayLike<{ transcript: string }> & { isFinal: boolean };
          const t = r[0]?.transcript || '';
          if (r.isFinal) final += t;
          else inter += t;
        }
        if (final) { setInput((p) => (p ? p + ' ' : '') + final); setInterim(''); }
        else setInterim(inter);
      };
      rec.onerror = (ev) => { setError(`Voice error: ${ev.error}`); setRecording(false); };
      rec.onend = () => { setRecording(false); setInterim(''); };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice failed');
    }
  };

  const stopVoice = () => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setRecording(false);
    setInterim('');
  };

  const sendVoice = () => {
    stopVoice();
    setTimeout(() => send(), 300); // let final transcript settle
  };

  return (
    <div className="flex h-dvh flex-col bg-[#F6F4EF] font-body">
      {/* Header */}
      <div className="shrink-0 border-b border-[#E5E0D8] bg-[#1A1A1A] px-4 py-3 safe-top">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8A7560]">
            <span className="text-base font-bold text-white">K</span>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white" style={{ fontFamily: 'Playfair Display, serif' }}>Krystyna</p>
            <p className="text-[10px] text-white/40">JD Suite · Mobile</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {loading && <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
            {recording && <div className="h-2 w-2 animate-ping rounded-full bg-red-400" />}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="pt-8 text-center">
            <p className="text-sm text-[#6B5A48] font-medium">Krystyna, mobile edition.</p>
            <p className="mt-1 text-xs text-[#9A8A7A]">Tap the mic, speak your JD question, or type below.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
              m.role === 'user'
                ? 'bg-[#8A7560] text-white'
                : 'bg-white border border-[#E5E0D8] text-[#1A1A1A]'
            }`}>
              {m.content}
            </div>
            <span className="mt-1 text-[10px] text-[#9A8A7A]">
              {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2">
            <div className="rounded-2xl bg-white border border-[#E5E0D8] px-4 py-3">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8A7560]" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8A7560]" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8A7560]" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Voice recording interim */}
      {interim && (
        <div className="shrink-0 px-4 py-2 text-xs text-[#8A7560] italic bg-[#F6F4EF] border-t border-[#E5E0D8]">
          {interim}...
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-[#E5E0D8] bg-white px-4 py-3 safe-bottom">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder={recording ? 'Listening…' : 'Ask Krystyna…'}
            rows={2}
            className="flex-1 resize-none rounded-xl border border-[#E5E0D8] bg-[#F6F4EF] px-3 py-2.5 text-[14px] text-[#1A1A1A] outline-none focus:border-[#8A7560] placeholder:text-[#9A8A7A]"
          />
          {/* Big voice button */}
          <button
            type="button"
            onClick={recording ? sendVoice : startVoice}
            className={`shrink-0 flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold shadow-md transition-all ${
              recording
                ? 'bg-red-500 text-white scale-110 shadow-red-200'
                : 'bg-[#1A1A1A] text-white hover:bg-[#8A7560]'
            }`}
            aria-label={recording ? 'Stop and send voice' : 'Start voice input'}
          >
            {recording ? '⬛' : '🎙'}
          </button>
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="shrink-0 rounded-xl bg-[#8A7560] px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-30 active:scale-95 transition-transform"
          >
            Send
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-[#9A8A7A]">
          Transcripts saved automatically · Krystyna proposes, you decide.
        </p>
      </div>
    </div>
  );
}
