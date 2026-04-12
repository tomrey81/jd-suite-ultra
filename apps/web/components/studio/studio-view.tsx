'use client';

import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  computeJdFingerprint,
  computeJdSimilarity,
  detectSonicIssues,
  applyFixes,
  computeDelta,
  type JdFingerprint,
  type SimilarityScore,
  type SonicIssue,
} from '@/lib/jd-sonic';
import { useAudioEngine } from '@/hooks/use-audio-engine';

// ── Sub-components ──────────────────────────────────────────────────────────

function MetricBadge({
  label, value, hint, hi = false, lo = false,
}: { label: string; value: string; hint?: string; hi?: boolean; lo?: boolean }) {
  return (
    <div className="flex flex-col gap-[3px] rounded-md border border-[#2E2C29] bg-[#1C1B1A] p-[8px_10px]">
      <div className="text-[9px] uppercase tracking-[0.12em] text-[#6B6660]">{label}</div>
      <div className={cn('font-mono text-sm font-bold', hi ? 'text-[#7A4A4A]' : lo ? 'text-[#4A7A50]' : 'text-[#E8E4DC]')}>
        {value}
      </div>
      {hint && <div className="text-[9px] text-[#6B6660]">{hint}</div>}
    </div>
  );
}

function NoteBar({ values, color = '#8A7560' }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 0.01);
  return (
    <div className="flex items-end gap-[2px] h-[32px]">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[1px]"
          style={{ height: `${Math.max(4, (v / max) * 100)}%`, background: color, opacity: 0.5 + v / max * 0.5 }}
        />
      ))}
    </div>
  );
}

function FingerprintPanel({ fp, label = 'SONIC FINGERPRINT', dimmed = false }: {
  fp: JdFingerprint | null;
  label?: string;
  dimmed?: boolean;
}) {
  if (!fp) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-[#2E2C29] bg-[#141410] p-6 text-center">
        <div className="text-2xl opacity-20">♫</div>
        <div className="text-[11px] text-[#6B6660]">Analyze a JD to see its fingerprint</div>
      </div>
    );
  }

  const metrics = [
    { label: 'Repetition', value: `${Math.round(fp.repRate * 100)}%`, hi: fp.repRate > 0.3, lo: fp.repRate < 0.1, hint: 'word repetition rate' },
    { label: 'Flatness',   value: `${Math.round(fp.flatness * 100)}%`,  hi: fp.flatness > 0.78, lo: fp.flatness < 0.3, hint: 'stepwise intervals' },
    { label: 'Jumps',      value: `${Math.round(fp.largeJumps * 100)}%`, hi: fp.largeJumps > 0.28, lo: false, hint: 'large register leaps' },
    { label: 'DynVar',     value: fp.velVar.toFixed(3),  hi: fp.velVar < 0.07, lo: fp.velVar > 0.15, hint: 'dynamic variance' },
    { label: 'Words',      value: String(fp.wordCount), hi: fp.wordCount < 80, lo: false, hint: '4+ letter words' },
    { label: 'Cluster',    value: `${Math.round(fp.concentration * 100)}%`, hi: fp.concentration > 0.52, lo: false, hint: 'top-3 note coverage' },
  ];

  const lowPct = Math.round(fp.normOct[0] * 100);
  const midPct = Math.round(fp.normOct[1] * 100);
  const hiPct = Math.round(fp.normOct[2] * 100);
  const registerLabel = midPct > 50 ? 'Balanced register — good readability mix' : lowPct > 60 ? 'Low register — dense, technical text' : 'High register — light, aspirational language';

  return (
    <div className={cn('flex flex-col gap-3 rounded-lg border border-[#2E2C29] bg-[#141410] p-4', dimmed && 'opacity-60')}>
      <div className="flex items-center justify-between">
        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8A7560]">{label}</div>
        <div className="text-[9px] text-[#6B6660]">{fp.charCount} chars · major scale</div>
      </div>

      {/* Note distribution */}
      <div>
        <div className="mb-1 text-[9px] uppercase tracking-[0.1em] text-[#6B6660]">Note distribution</div>
        <NoteBar values={fp.normNote} color="#8A7560" />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {metrics.map((m) => (
          <MetricBadge key={m.label} {...m} />
        ))}
      </div>

      {/* Top keywords */}
      {fp.topWords.length > 0 && (
        <div>
          <div className="mb-1.5 text-[9px] uppercase tracking-[0.1em] text-[#6B6660]">Top keywords (sonic weight)</div>
          <div className="flex flex-wrap gap-1">
            {fp.topWords.slice(0, 8).map((tw) => (
              <span
                key={tw.w}
                className="rounded bg-[#1C1B1A] px-[7px] py-[2px] font-mono text-[10px] text-[#B5A089]"
              >
                {tw.w} <span className="text-[#6B6660]">×{tw.c}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Register profile */}
      <div>
        <div className="mb-1 text-[9px] uppercase tracking-[0.1em] text-[#6B6660]">Register profile</div>
        <div className="flex gap-[3px] h-[16px]">
          <div className="rounded-l-sm" style={{ width: `${lowPct}%`, background: '#4A5E7A', minWidth: 4 }} title={`Low: ${lowPct}%`} />
          <div className="" style={{ width: `${midPct}%`, background: '#4A7A50', minWidth: 4 }} title={`Mid: ${midPct}%`} />
          <div className="rounded-r-sm" style={{ width: `${hiPct}%`, background: '#7A6A4A', minWidth: 4 }} title={`Hi: ${hiPct}%`} />
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-[#6B6660]">
          <span>Low {lowPct}%</span><span>Mid {midPct}%</span><span>Hi {hiPct}%</span>
        </div>
        <div className="mt-1 text-[10px] italic text-[#6B6660]">{registerLabel}</div>
      </div>
    </div>
  );
}

const SEV_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  critical: { bg: 'bg-[#2A1A1A]', border: 'border-[#7A3A3A]', text: 'text-[#C06060]' },
  warning:  { bg: 'bg-[#1E1C14]', border: 'border-[#5C5030]', text: 'text-[#B5A050]' },
  info:     { bg: 'bg-[#141820]', border: 'border-[#2A3050]', text: 'text-[#5080A0]' },
};

function IssueCard({ issue, onAccept, onSkip, onEdit, onEditSave }: {
  issue: SonicIssue;
  onAccept: () => void;
  onSkip: () => void;
  onEdit: () => void;
  onEditSave: (text: string) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(issue.editedFix || issue.fix);
  const sc = SEV_COLORS[issue.sev] ?? SEV_COLORS.info;

  return (
    <div className={cn('rounded-lg border p-3.5', sc.bg, sc.border)}>
      {/* Header row */}
      <div className="mb-2 flex items-center gap-2">
        <span className={cn('rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase', sc.text, sc.bg)}>
          {issue.sev}
        </span>
        <span className="rounded bg-[#2E2C29] px-1.5 py-0.5 font-mono text-[9px] text-[#6B6660]">
          {issue.type}
        </span>
        {issue.isAi && (
          <span className="ml-auto rounded bg-[#4F46E5]/20 px-1.5 py-0.5 font-mono text-[9px] text-[#8B83F0]">
            AI
          </span>
        )}
        {/* Action buttons */}
        {issue.status === 'pending' && (
          <div className="ml-auto flex gap-1.5">
            <button type="button" onClick={onAccept} title="Accept fix"
              className="rounded border border-[#4A7A50]/50 px-2 py-0.5 text-[10px] text-[#4A7A50] hover:bg-[#4A7A50]/20">
              ✓ accept
            </button>
            <button type="button" onClick={onSkip} title="Skip"
              className="rounded border border-[#6B6660]/30 px-2 py-0.5 text-[10px] text-[#6B6660] hover:bg-[#2E2C29]">
              ✗ skip
            </button>
            <button type="button" onClick={() => { setEditMode(!editMode); onEdit(); }} title="Edit fix"
              className="rounded border border-[#8A7560]/40 px-2 py-0.5 text-[10px] text-[#8A7560] hover:bg-[#8A7560]/20">
              ✏ edit fix
            </button>
          </div>
        )}
        {issue.status === 'accepted' && (
          <span className="ml-auto rounded bg-[#4A7A50]/20 px-2 py-0.5 text-[10px] text-[#4A7A50]">✓ accepted</span>
        )}
        {issue.status === 'skipped' && (
          <span className="ml-auto rounded bg-[#2E2C29] px-2 py-0.5 text-[10px] text-[#6B6660]">✗ skip</span>
        )}
      </div>

      {/* Issue title / description */}
      <div className="mb-1 text-[12px] font-medium text-[#E8E4DC]">{issue.msg}</div>
      <div className="mb-1.5 font-mono text-[10px] italic text-[#8A7560]">♫ {issue.sonicNote}</div>

      {/* Location */}
      {issue.location && (
        <div className="mb-2 flex items-start gap-[6px]">
          <span className="mt-[1px] shrink-0 text-[10px] text-[#6B6660]">📍</span>
          <span className="rounded bg-[#2E2C29] px-1.5 py-0.5 font-mono text-[10px] text-[#B5A089]">
            {issue.location.slice(0, 80)}{issue.location.length > 80 ? '…' : ''}
          </span>
        </div>
      )}

      {/* Fix recommendation */}
      {!editMode && (
        <div className="flex items-start gap-[6px] text-[11px] text-[#A09880]">
          <span className="mt-[1px] shrink-0 text-[#8A7560]">→</span>
          {issue.editedFix || issue.fix}
        </div>
      )}

      {/* Inline edit */}
      {editMode && (
        <div className="mt-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="w-full rounded border border-[#8A7560]/50 bg-[#0E0D0C] p-2 font-mono text-[11px] text-[#E8E4DC] outline-none"
          />
          <div className="mt-1.5 flex justify-end gap-2">
            <button type="button" onClick={() => setEditMode(false)}
              className="rounded border border-[#2E2C29] px-2.5 py-1 text-[10px] text-[#6B6660]">
              Cancel
            </button>
            <button type="button" onClick={() => { onEditSave(editText); setEditMode(false); }}
              className="rounded bg-[#8A7560] px-2.5 py-1 text-[10px] font-medium text-white">
              Save & accept
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Studio view ────────────────────────────────────────────────────────

interface StudioViewProps {
  initialText?: string;
  jdId?: string;
  jdTitle?: string;
}

type FixState = 'idle' | 'analyzing' | 'issues' | 'applied';

export function StudioView({ initialText = '', jdId, jdTitle }: StudioViewProps) {
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [text1, setText1] = useState(initialText);
  const [text2, setText2] = useState('');
  const [fp1, setFp1] = useState<JdFingerprint | null>(null);
  const [fp2, setFp2] = useState<JdFingerprint | null>(null);
  const [fpFixed, setFpFixed] = useState<JdFingerprint | null>(null);
  const [sim, setSim] = useState<SimilarityScore | null>(null);
  const [issues, setIssues] = useState<SonicIssue[]>([]);
  const [fixState, setFixState] = useState<FixState>('idle');
  const [fixedText, setFixedText] = useState('');
  const [aiRunning, setAiRunning] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [playing1, setPlaying1] = useState(false);
  const [playing2, setPlaying2] = useState(false);
  const [playingFixed, setPlayingFixed] = useState(false);
  const [playProg, setPlayProg] = useState(0);
  const [exportingWav, setExportingWav] = useState(false);
  const [savingFixed, setSavingFixed] = useState(false);
  const [saveFixedSuccess, setSaveFixedSuccess] = useState(false);

  const { sonify, stopPlayback, renderWav } = useAudioEngine();

  // ── Play / stop ────────────────────────────────────────────────────────────

  const handlePlay = useCallback((which: 'jd1' | 'jd2' | 'fixed') => {
    const isPlaying = which === 'jd1' ? playing1 : which === 'jd2' ? playing2 : playingFixed;
    if (isPlaying) { stopPlayback(); setPlaying1(false); setPlaying2(false); setPlayingFixed(false); return; }

    stopPlayback();
    setPlaying1(false); setPlaying2(false); setPlayingFixed(false);
    const txt = which === 'jd1' ? text1 : which === 'jd2' ? text2 : fixedText;
    if (!txt.trim()) return;

    const setter = which === 'jd1' ? setPlaying1 : which === 'jd2' ? setPlaying2 : setPlayingFixed;
    setter(true);
    setPlayProg(0);

    sonify(txt, {
      onProgress: (f) => setPlayProg(Math.round(f * 100)),
      onDone: () => { setter(false); setPlayProg(0); },
    });
  }, [playing1, playing2, playingFixed, text1, text2, fixedText, sonify, stopPlayback]);

  // ── Analyze ────────────────────────────────────────────────────────────────

  const handleAnalyze = useCallback(async () => {
    const txt = text1.trim();
    if (!txt) return;

    const wordCount = txt.split(/\s+/).length;

    setAiRunning(true);
    setFixState('analyzing');
    setIssues([]);
    setFp1(null);
    setFpFixed(null);
    setSim(null);
    setAiError(null);

    // Compute fingerprint immediately — never requires Claude
    const fp = computeJdFingerprint(txt);
    setFp1(fp);

    if (mode === 'compare' && text2.trim()) {
      const fp2local = computeJdFingerprint(text2.trim());
      setFp2(fp2local);
      setSim(computeJdSimilarity(fp, fp2local));
    }

    // Local sonic heuristics — always available
    const sonicIss = detectSonicIssues(fp, txt).map((iss) => ({
      ...iss,
      status: 'pending' as const,
      editedFix: '',
      isAi: false,
    }));

    // AI deep review — optional, needs word count ≥ 30
    let aiIss: SonicIssue[] = [];
    if (wordCount >= 30) {
      try {
        const res = await fetch('/api/ai/sonic-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jdText: txt }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data._fallback) {
            setAiError('AI used simplified analysis (full analysis timed out). Sonic issues are complete.');
          }
          if (Array.isArray(data.issues)) {
            aiIss = data.issues.map((iss: any, idx: number) => ({
              id: iss.id || `ai_${idx}`,
              sev: ['critical', 'warning', 'info'].includes(iss.severity) ? iss.severity : 'info',
              type: iss.type || 'vague',
              msg: iss.title || iss.description || 'Issue detected',
              sonicNote: iss.sonicNote || 'AI-identified issue',
              fix: iss.fix || 'See description',
              location: iss.location || '',
              fixedSnippet: iss.fixedSnippet || '',
              isAi: true,
              status: 'pending' as const,
              editedFix: '',
            }));
          }
        } else if (res.status === 422) {
          const err = await res.json();
          setAiError(err.hint || 'JD too short for AI analysis');
        } else if (res.status !== 500) {
          setAiError(`AI review unavailable (${res.status})`);
        }
      } catch {
        setAiError('AI review failed — sonic issues shown');
      }
    }

    // Merge: sonic first, then AI. Deduplicate by issue type+location.
    const seen = new Set<string>();
    const merged: SonicIssue[] = [];
    for (const iss of [...sonicIss, ...aiIss]) {
      const key = `${iss.type}:${iss.location?.slice(0, 30)}`;
      if (!seen.has(key)) { seen.add(key); merged.push(iss); }
    }

    setIssues(merged);
    setFixState('issues');
    setAiRunning(false);
  }, [text1, text2, mode]);

  // ── Bulk issue actions ─────────────────────────────────────────────────────

  const updateIssue = (id: string, patch: Partial<SonicIssue>) =>
    setIssues((prev) => prev.map((iss) => (iss.id === id ? { ...iss, ...patch } : iss)));

  const acceptAll = () => setIssues((prev) => prev.map((iss) => ({ ...iss, status: iss.status === 'pending' ? 'accepted' : iss.status })));
  const skipAll   = () => setIssues((prev) => prev.map((iss) => ({ ...iss, status: iss.status === 'pending' ? 'skipped' : iss.status })));

  // ── Apply fixes ────────────────────────────────────────────────────────────

  const handleApplyFixes = useCallback(() => {
    const { patchedText, appliedCount } = applyFixes(text1, issues);
    setFixedText(patchedText);
    const fp = computeJdFingerprint(patchedText);
    setFpFixed(fp);
    setFixState('applied');
  }, [text1, issues]);

  // ── Save fixed JD back to DB ───────────────────────────────────────────────

  const handleSaveFixed = useCallback(async () => {
    if (!jdId || !fixedText.trim()) return;
    setSavingFixed(true);
    try {
      const res = await fetch(`/api/jd/${jdId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { jobDescription: fixedText },
          jobTitle: jdTitle || '',
        }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSaveFixedSuccess(true);
      setTimeout(() => setSaveFixedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Save failed');
    } finally {
      setSavingFixed(false);
    }
  }, [jdId, fixedText, jdTitle]);

  // ── WAV export ────────────────────────────────────────────────────────────

  const handleExportWav = useCallback(async (which: 'original' | 'fixed') => {
    const txt = which === 'fixed' ? fixedText : text1;
    if (!txt.trim()) return;
    setExportingWav(true);
    try {
      const blob = await renderWav(txt);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `JD_${which}_${new Date().toISOString().slice(0, 10)}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'WAV export failed');
    } finally {
      setExportingWav(false);
    }
  }, [text1, fixedText, renderWav]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const pending  = issues.filter((i) => i.status === 'pending').length;
  const accepted = issues.filter((i) => i.status === 'accepted').length;
  const wordCount1 = text1.trim().split(/\s+/).filter(Boolean).length;
  const wordCount2 = text2.trim().split(/\s+/).filter(Boolean).length;
  const isDuplicate = (sim?.overall ?? 0) >= 75;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0E0D0C]">
      {/* Studio header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#2E2C29] px-6 py-3">
        <div className="flex items-center gap-3">
          {jdId && (
            <a href={`/jd/${jdId}`} className="text-[11px] text-[#6B6660] hover:text-[#8A7560]">
              ← Back to editor
            </a>
          )}
          {jdTitle && <span className="text-[11px] font-medium text-[#B5A089]">{jdTitle}</span>}
          <div className="text-[9px] uppercase tracking-[0.16em] text-[#8A7560]">JD Studio</div>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-[6px] rounded-lg border border-[#2E2C29] bg-[#141410] p-1">
          {(['single', 'compare'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md px-3 py-1 text-[11px] font-medium transition-all',
                mode === m
                  ? 'bg-[#8A7560] text-[#F6F4EF]'
                  : 'text-[#6B6660] hover:text-[#B5A089]',
              )}
            >
              {m === 'single' ? 'Single JD' : 'Compare 2 JDs'}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Input panel */}
        <div className="flex w-[420px] shrink-0 flex-col border-r border-[#2E2C29] overflow-y-auto">
          {/* JD #1 */}
          <div className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[9px] uppercase tracking-[0.12em] text-[#6B6660]">
                Job Description {mode === 'compare' ? '#1' : ''}
              </div>
              <div className="text-[10px] text-[#6B6660]">
                {wordCount1 > 0 && `${wordCount1} words`}
                {wordCount1 > 0 && wordCount1 < 80 && (
                  <span className="ml-1 text-[#B5A050]">· short</span>
                )}
                {fp1 && <span className="ml-1 rounded bg-[#8A7560]/20 px-1 py-0.5 text-[9px] text-[#8A7560]">fingerprinted</span>}
              </div>
            </div>
            <textarea
              value={text1}
              onChange={(e) => { setText1(e.target.value); if (fp1) { setFp1(null); setFpFixed(null); setIssues([]); setFixState('idle'); } }}
              placeholder="Paste job description here…&#10;&#10;Example: We are looking for a Senior Product Manager…"
              rows={14}
              className="w-full resize-none rounded-md border border-[#2E2C29] bg-[#141410] p-3 font-mono text-[12px] leading-[1.7] text-[#E8E4DC] outline-none placeholder:text-[#4A4844]"
              style={{ caretColor: '#8A7560' }}
            />

            {/* Note preview bar */}
            {fp1 && (
              <div className="mt-2">
                <NoteBar values={fp1.normNote} color="#8A7560" />
              </div>
            )}

            {/* Actions */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handlePlay('jd1')}
                disabled={!text1.trim()}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-[11px] font-medium transition-all disabled:opacity-40',
                  playing1
                    ? 'border-[#7A4A4A] bg-[#7A4A4A]/20 text-[#C06060]'
                    : 'border-[#2E2C29] text-[#8A7560] hover:border-[#8A7560]',
                )}
              >
                {playing1 ? `⏹ ${playProg}%` : '▶ Sonify'}
              </button>

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!text1.trim() || aiRunning}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#8A7560]/50 bg-[#8A7560]/10 px-3 py-1.5 text-[11px] font-medium text-[#B5A089] transition-all hover:bg-[#8A7560]/20 disabled:opacity-40"
              >
                {aiRunning ? (
                  <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#8A7560]/30 border-t-[#8A7560]" />Analyzing…</>
                ) : '🔍 Analyze & Fingerprint'}
              </button>

              {text1.trim() && (
                <button
                  type="button"
                  onClick={() => handleExportWav('original')}
                  disabled={exportingWav}
                  className="rounded-md border border-[#2E2C29] px-3 py-1.5 text-[11px] text-[#6B6660] hover:border-[#8A7560] hover:text-[#8A7560] disabled:opacity-40"
                >
                  {exportingWav ? '…' : '♫ WAV'}
                </button>
              )}
            </div>

            {/* Issue count badge */}
            {(fixState === 'issues' || fixState === 'applied') && issues.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-[#7A4A4A]/30 px-2.5 py-1 text-[11px] font-semibold text-[#C06060]">
                  {issues.length} issues
                </span>
                {fixState === 'applied' && (
                  <span className="text-[10px] text-[#4A7A50]">✓ fixes applied</span>
                )}
              </div>
            )}
          </div>

          {/* JD #2 (compare mode) */}
          {mode === 'compare' && (
            <div className="border-t border-[#2E2C29] p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[9px] uppercase tracking-[0.12em] text-[#6B6660]">Job Description #2</div>
                <div className="text-[10px] text-[#6B6660]">{wordCount2 > 0 && `${wordCount2} words`}</div>
              </div>
              <textarea
                value={text2}
                onChange={(e) => { setText2(e.target.value); setSim(null); setFp2(null); }}
                placeholder="Paste second JD to compare…"
                rows={8}
                className="w-full resize-none rounded-md border border-[#2E2C29] bg-[#141410] p-3 font-mono text-[12px] leading-[1.7] text-[#E8E4DC] outline-none placeholder:text-[#4A4844]"
              />
              {fp2 && <div className="mt-2"><NoteBar values={fp2.normNote} color="#4A5E7A" /></div>}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => handlePlay('jd2')}
                  disabled={!text2.trim()}
                  className="rounded-md border border-[#2E2C29] px-3 py-1.5 text-[11px] text-[#6B6660] hover:border-[#4A5E7A] hover:text-[#8090B0] disabled:opacity-40"
                >
                  {playing2 ? '⏹ Stop' : '▶ Sonify #2'}
                </button>
              </div>

              {/* Similarity score */}
              {sim && (
                <div className={cn('mt-3 rounded-lg border p-3', isDuplicate ? 'border-[#7A4A4A] bg-[#2A1A1A]' : 'border-[#2E2C29] bg-[#1C1B1A]')}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[9px] uppercase tracking-[0.12em] text-[#6B6660]">Similarity score</div>
                    {isDuplicate && (
                      <span className="rounded bg-[#7A4A4A]/30 px-2 py-0.5 text-[10px] font-bold text-[#C06060]">
                        ⚠ Near-duplicate
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { label: 'Overall',  value: sim.overall },
                      { label: 'Melodic',  value: sim.melodic },
                      { label: 'Register', value: sim.register },
                      { label: 'Dynamic',  value: sim.dynamic },
                    ] as const).map(({ label, value }) => (
                      <div key={label} className="text-center">
                        <div className="font-mono text-base font-bold text-[#E8E4DC]">{value}%</div>
                        <div className="text-[9px] text-[#6B6660]">{label}</div>
                      </div>
                    ))}
                  </div>
                  {isDuplicate && (
                    <p className="mt-2 text-[10px] text-[#B5A050]">
                      These JDs sound ≥75% similar — consider consolidating into a single canonical description.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Fingerprint + Issues panel */}
        <div className="flex flex-1 flex-col overflow-y-auto p-5 gap-4">
          {/* Fingerprint */}
          <FingerprintPanel fp={fp1} />

          {/* AI error banner */}
          {aiError && (
            <div className="rounded-md border border-[#5C5030] bg-[#1E1C14] px-3.5 py-2.5 text-[11px] text-[#B5A050]">
              ◆ {aiError}
            </div>
          )}

          {/* Issue report */}
          {fixState !== 'idle' && issues.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8A7560]">Issue report</div>
                  <div className="text-[10px] text-[#6B6660]">
                    {issues.filter(i => i.sev === 'critical').length > 0 && (
                      <span className="text-[#C06060]">{issues.filter(i => i.sev === 'critical').length} critical · </span>
                    )}
                    {issues.filter(i => i.sev === 'warning').length} warnings · {issues.filter(i => i.sev === 'info').length} info
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={acceptAll}
                    className="rounded border border-[#4A7A50]/40 px-2.5 py-1 text-[10px] text-[#4A7A50] hover:bg-[#4A7A50]/20">
                    ✓ Accept All
                  </button>
                  <button type="button" onClick={skipAll}
                    className="rounded border border-[#6B6660]/30 px-2.5 py-1 text-[10px] text-[#6B6660] hover:bg-[#2E2C29]">
                    ✗ Skip All
                  </button>
                  {accepted > 0 && (
                    <button type="button" onClick={handleApplyFixes}
                      className="rounded border-none bg-[#8A7560] px-2.5 py-1 text-[10px] font-semibold text-white">
                      ⚡ Apply {accepted} fix{accepted > 1 ? 'es' : ''}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {issues.map((iss) => (
                  <IssueCard
                    key={iss.id}
                    issue={iss}
                    onAccept={() => updateIssue(iss.id, { status: 'accepted' })}
                    onSkip={() => updateIssue(iss.id, { status: 'skipped' })}
                    onEdit={() => {}}
                    onEditSave={(text) => updateIssue(iss.id, { editedFix: text, status: 'accepted' })}
                  />
                ))}
              </div>
            </div>
          )}

          {fixState !== 'idle' && issues.length === 0 && !aiRunning && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-[#4A7A50]/30 bg-[#1A2A1A] p-6 text-center">
              <div className="text-2xl">✓</div>
              <div className="text-sm font-medium text-[#4A7A50]">No issues detected</div>
              <div className="text-[11px] text-[#6B6660]">This JD scores well on all sonic quality metrics.</div>
            </div>
          )}

          {/* Fixed JD section */}
          {fixState === 'applied' && fixedText && (
            <div className="rounded-lg border border-[#4A7A50]/40 bg-[#141410] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#4A7A50]">
                  ✓ Fixes Applied — Fixed JD
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handlePlay('fixed')}
                    className="rounded border border-[#2E2C29] px-2.5 py-1 text-[10px] text-[#6B6660] hover:text-[#8A7560]">
                    {playingFixed ? '⏹ Stop' : '▶ Re-sonify'}
                  </button>
                  <button type="button" onClick={() => handleExportWav('fixed')} disabled={exportingWav}
                    className="rounded border border-[#2E2C29] px-2.5 py-1 text-[10px] text-[#6B6660] hover:text-[#8A7560] disabled:opacity-40">
                    {exportingWav ? '…' : '♫ WAV Fixed'}
                  </button>
                  <button type="button" onClick={() => navigator.clipboard.writeText(fixedText)}
                    className="rounded border border-[#2E2C29] px-2.5 py-1 text-[10px] text-[#6B6660] hover:text-[#8A7560]">
                    📋 Copy
                  </button>
                  {jdId && (
                    <button type="button" onClick={handleSaveFixed} disabled={savingFixed || saveFixedSuccess}
                      className={cn('rounded px-2.5 py-1 text-[10px] font-medium transition-colors',
                        saveFixedSuccess ? 'bg-[#4A7A50]/30 text-[#4A7A50]' : 'bg-[#8A7560] text-white disabled:opacity-50')}>
                      {savingFixed ? '…' : saveFixedSuccess ? '✓ Saved' : '💾 Save to JD'}
                    </button>
                  )}
                </div>
              </div>

              {/* Delta metrics */}
              {fp1 && fpFixed && (() => {
                const delta = computeDelta(fp1, fpFixed);
                return (
                  <div className="mb-3 grid grid-cols-3 gap-1.5">
                    {([
                      { label: 'Repetition', key: 'repRate', fmt: (v: number) => `${Math.round(v * 100)}%`, lowerBetter: true },
                      { label: 'Flatness', key: 'flatness', fmt: (v: number) => `${Math.round(v * 100)}%`, lowerBetter: true },
                      { label: 'Jumps', key: 'largeJumps', fmt: (v: number) => `${Math.round(v * 100)}%`, lowerBetter: true },
                    ] as const).map(({ label, key, fmt }) => {
                      const d = delta[key as keyof typeof delta];
                      return (
                        <div key={key} className="rounded-md border border-[#2E2C29] bg-[#1C1B1A] p-2 text-center">
                          <div className="text-[9px] text-[#6B6660]">{label}</div>
                          <div className="font-mono text-[11px]">
                            <span className="text-[#6B6660] line-through">{fmt(d.before)}</span>
                            <span className="mx-1 text-[#4A4844]">→</span>
                            <span className={d.improved ? 'text-[#4A7A50]' : 'text-[#B5A050]'}>
                              {fmt(d.after)} {d.improved ? '↑' : '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Fixed fingerprint */}
              {fpFixed && <FingerprintPanel fp={fpFixed} label="FIXED FINGERPRINT" />}

              {/* Fixed text editor */}
              <div className="mt-3">
                <div className="mb-1 text-[9px] text-[#6B6660]">Fixed text (editable)</div>
                <textarea
                  value={fixedText}
                  onChange={(e) => {
                    setFixedText(e.target.value);
                    setFpFixed(computeJdFingerprint(e.target.value));
                  }}
                  rows={10}
                  className="w-full resize-none rounded-md border border-[#4A7A50]/30 bg-[#0E0D0C] p-3 font-mono text-[12px] leading-[1.7] text-[#E8E4DC] outline-none"
                />
              </div>
            </div>
          )}

          {/* Info bar */}
          <div className="rounded-lg border border-[#2E2C29] bg-[#141410] p-3.5 text-[11px] leading-relaxed text-[#6B6660]">
            <span className="font-semibold text-[#8A7560]">How JD Sonification works: </span>
            Each character maps to a note via ASCII → scale degree → frequency. Structural flaws become{' '}
            <em className="text-[#B5A089]">audible</em>: repetitive JDs sound stuck on the same notes; inconsistent
            language register creates melodic jumps; generic text produces flat, undynamic melodies. The fingerprint
            quantifies these patterns for comparison and improvement tracking. Use Compare mode to detect
            near-duplicate JDs that could be consolidated.
          </div>
        </div>
      </div>
    </div>
  );
}
