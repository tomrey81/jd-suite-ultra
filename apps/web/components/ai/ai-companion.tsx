'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_ACTIONS = [
  { label: 'Improve this JD', prompt: 'Suggest improvements for this job description.' },
  { label: 'Identify gaps', prompt: 'What information is missing from this job description?' },
  { label: 'Check readiness', prompt: 'Is this JD ready for pay equity evaluation? What needs to be added?' },
  { label: 'Explain score', prompt: 'Explain the current quality score and what drives it.' },
  { label: 'Suggest questions', prompt: 'What questions should I ask the line manager to complete this JD?' },
  { label: 'Summarise changes', prompt: 'Summarise the recent changes to this job description.' },
];

export function AICompanion() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();

  // Determine context from current route
  const isJDContext = pathname.startsWith('/jd/') || pathname.startsWith('/editor') || pathname.startsWith('/analyser');

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/generate-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldLabel: 'AI Companion', jdText: msg }),
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.text || data.suggestion || 'No response received.' }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'AI is currently unavailable. Please check your API key in Settings.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105',
          isOpen
            ? 'bg-surface-header text-text-on-dark'
            : 'bg-brand-gold text-white',
        )}
        title="AI Companion"
      >
        {isOpen ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4.5 4.5L13.5 13.5M4.5 13.5L13.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L12.5 7.5L18 10L12.5 12.5L10 18L7.5 12.5L2 10L7.5 7.5L10 2Z" fill="currentColor" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-xl border border-border-default bg-white shadow-2xl">
          {/* Header */}
          <div className="shrink-0 border-b border-border-default bg-surface-header px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-[13px] tracking-wide text-text-on-dark">AI Companion</h3>
                <p className="text-[9px] text-text-on-dark/40">
                  {isJDContext ? 'Context: current JD' : 'General assistant'}
                </p>
              </div>
              <button
                onClick={() => { setMessages([]); }}
                className="rounded-md px-2 py-1 text-[9px] text-text-on-dark/40 hover:text-text-on-dark/70"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-text-muted">How can I help with your JD work?</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleSend(action.prompt)}
                      className="rounded-lg border border-border-default px-2.5 py-2 text-left text-[10px] text-text-secondary transition-colors hover:border-brand-gold/40 hover:bg-brand-gold-lighter"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-[11px] leading-relaxed',
                  msg.role === 'user'
                    ? 'ml-auto bg-brand-gold/10 text-text-primary'
                    : 'bg-surface-page text-text-secondary',
                )}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-gold/50" />
                Thinking...
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
                onKeyDown={handleKeyDown}
                placeholder="Ask about this JD..."
                rows={1}
                className="flex-1 resize-none bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="shrink-0 rounded-md bg-brand-gold px-2.5 py-1 text-[10px] font-medium text-white transition-opacity disabled:opacity-30"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
