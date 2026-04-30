'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

// Minimal types for SpeechRecognition (Web Speech API is non-standard in TS DOM lib)
type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>> & {
    length: number;
    [k: number]: ArrayLike<SpeechRecognitionResultLike> & { isFinal: boolean; length: number; [k: number]: SpeechRecognitionResultLike };
  };
  resultIndex: number;
};

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognition(): { new (): SpeechRecognitionInstance } | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

interface Props {
  /** The current value of the field — used as starting point */
  value: string;
  /** Field label, used in the prompt and placeholder */
  fieldLabel: string;
  /** Optional context question to show the user before recording */
  prompt?: string;
  /** Locale for transcription, e.g. "en-GB", "pl-PL" */
  locale?: string;
  /** Called when user confirms the new value */
  onConfirm: (newValue: string) => void;
  /** Called when user saves it as a reviewer note instead */
  onSaveAsNote?: (note: string) => void;
}

export function VoiceInput({ value, fieldLabel, prompt, locale = 'en-US', onConfirm, onSaveAsNote }: Props) {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [cleanedDraft, setCleanedDraft] = useState('');
  const [cleaning, setCleaning] = useState(false);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const SR = getSpeechRecognition();
    setSupported(!!SR);
  }, []);

  const start = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setError('Voice input is not supported in this browser. Use the manual text fallback instead.');
      return;
    }
    setError(null);
    setTranscript('');
    setInterim('');
    setCleanedDraft('');

    const rec = new SR();
    rec.lang = locale;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: SpeechRecognitionEventLike) => {
      let interimText = '';
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0]?.transcript || '';
        if ((r as any).isFinal) finalText += text;
        else interimText += text;
      }
      if (finalText) setTranscript((prev) => (prev + ' ' + finalText).trim());
      setInterim(interimText);
    };
    rec.onerror = (ev) => {
      setError(`Voice recognition error: ${ev.error}`);
      setRecording(false);
    };
    rec.onend = () => {
      setRecording(false);
      setInterim('');
    };

    recRef.current = rec;
    rec.start();
    setRecording(true);
  }, [locale]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setRecording(false);
  }, []);

  // Clean transcript via existing AI generate-field endpoint
  const clean = async () => {
    if (!transcript.trim()) return;
    setCleaning(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/generate-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldLabel,
          jdText: `Clean this voice transcript into a concise, professional ${fieldLabel} entry. Keep the user's meaning. Remove filler words. Output only the cleaned text, no commentary.\n\nTranscript:\n${transcript}`,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCleanedDraft(data.text || data.suggestion || transcript);
    } catch {
      // Fallback: just trim and use raw transcript
      setCleanedDraft(transcript.trim());
      setError('AI cleanup unavailable. You can confirm the raw transcript or edit it manually.');
    } finally {
      setCleaning(false);
    }
  };

  const handleConfirm = () => {
    const text = cleanedDraft || transcript;
    if (!text.trim()) return;
    onConfirm(text.trim());
    reset();
  };

  const handleSaveAsNote = () => {
    const note = cleanedDraft || transcript;
    if (!note.trim() || !onSaveAsNote) return;
    onSaveAsNote(note.trim());
    reset();
  };

  const reset = () => {
    setOpen(false);
    setTranscript('');
    setInterim('');
    setCleanedDraft('');
    setError(null);
    if (recRef.current) {
      try { recRef.current.abort(); } catch { /* ignore */ }
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-border-default bg-white px-2.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:border-brand-gold hover:text-brand-gold"
        title={`Voice input for ${fieldLabel}`}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
          <path d="M5.5 7.5C6.6 7.5 7.5 6.6 7.5 5.5V2.5C7.5 1.4 6.6 0.5 5.5 0.5C4.4 0.5 3.5 1.4 3.5 2.5V5.5C3.5 6.6 4.4 7.5 5.5 7.5Z" />
          <path d="M9.5 5.5C9.5 7.7 7.7 9.5 5.5 9.5M5.5 9.5C3.3 9.5 1.5 7.7 1.5 5.5M5.5 9.5V10.5" stroke="currentColor" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        </svg>
        Voice
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-brand-gold/40 bg-brand-gold-lighter p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-gold">Voice input</div>
          <div className="mt-0.5 text-[11px] text-text-primary">
            {prompt || `Describe ${fieldLabel.toLowerCase()} in your own words.`}
          </div>
        </div>
        <button
          onClick={reset}
          className="rounded p-0.5 text-text-muted hover:bg-white"
          title="Cancel"
        >
          ✕
        </button>
      </div>

      {!supported && (
        <div className="mb-2 rounded-md border border-warning/30 bg-warning-bg p-2 text-[10px] text-warning">
          Voice recognition is not supported in this browser. Type your note in the field below instead.
        </div>
      )}

      {error && (
        <div className="mb-2 rounded-md border border-danger/30 bg-danger-bg p-2 text-[10px] text-danger">
          {error}
        </div>
      )}

      {/* Recording controls */}
      <div className="mb-2 flex items-center gap-2">
        {!recording ? (
          <button
            onClick={start}
            disabled={!supported}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-gold px-3 py-1 text-[11px] font-medium text-white disabled:opacity-50"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-white" />
            Start recording
          </button>
        ) : (
          <button
            onClick={stop}
            className="inline-flex items-center gap-1.5 rounded-full bg-danger px-3 py-1 text-[11px] font-medium text-white"
          >
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
            Stop
          </button>
        )}
        {transcript && !recording && (
          <button
            onClick={clean}
            disabled={cleaning}
            className="rounded-full border border-border-default bg-white px-3 py-1 text-[11px] font-medium text-text-secondary hover:border-brand-gold disabled:opacity-50"
          >
            {cleaning ? 'Cleaning…' : 'Clean up with AI'}
          </button>
        )}
      </div>

      {/* Transcript */}
      {(transcript || interim) && (
        <div className="mb-2">
          <div className="mb-0.5 text-[9px] uppercase tracking-wider text-text-muted">Transcript</div>
          <div className="rounded-md border border-border-default bg-white p-2 text-xs text-text-primary">
            {transcript}
            {interim && <span className="text-text-muted italic">{' ' + interim}</span>}
          </div>
        </div>
      )}

      {/* Cleaned draft (editable) */}
      {cleanedDraft && (
        <div className="mb-2">
          <div className="mb-0.5 text-[9px] uppercase tracking-wider text-text-muted">Cleaned draft (you can edit)</div>
          <textarea
            value={cleanedDraft}
            onChange={(e) => setCleanedDraft(e.target.value)}
            rows={Math.min(8, Math.max(3, cleanedDraft.split('\n').length))}
            className="w-full rounded-md border border-border-default bg-white p-2 text-xs text-text-primary outline-none focus:border-brand-gold"
          />
        </div>
      )}

      {/* Manual text fallback */}
      {!supported && (
        <div className="mb-2">
          <div className="mb-0.5 text-[9px] uppercase tracking-wider text-text-muted">Manual entry (fallback)</div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={4}
            placeholder={`Type a note for ${fieldLabel}...`}
            className="w-full rounded-md border border-border-default bg-white p-2 text-xs text-text-primary outline-none focus:border-brand-gold"
          />
        </div>
      )}

      {/* Actions */}
      {(transcript || cleanedDraft) && !recording && (
        <div className="flex items-center gap-2 border-t border-border-default pt-2">
          <button
            onClick={handleConfirm}
            className={cn(
              'rounded-full px-4 py-1.5 text-[11px] font-medium transition-colors',
              value
                ? 'bg-brand-gold text-white hover:bg-brand-gold/90'
                : 'bg-brand-gold text-white',
            )}
          >
            {value ? 'Replace field' : 'Insert into field'}
          </button>
          {onSaveAsNote && (
            <button
              onClick={handleSaveAsNote}
              className="rounded-full border border-border-default bg-white px-4 py-1.5 text-[11px] font-medium text-text-secondary hover:border-brand-gold"
            >
              Save as reviewer note
            </button>
          )}
          <span className="ml-auto text-[10px] text-text-muted">
            Nothing is saved until you confirm.
          </span>
        </div>
      )}

      <div className="mt-2 text-[9px] text-text-muted">
        Audio is processed by your browser. Only the transcript is stored after you confirm.
      </div>
    </div>
  );
}
