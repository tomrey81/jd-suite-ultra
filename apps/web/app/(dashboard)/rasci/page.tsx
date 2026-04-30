'use client';

import { useEffect, useRef, useState } from 'react';

interface Process {
  id: string;
  step: string;
  rasci: Record<string, string>;
  confirmed: boolean;
  note: string;
}

interface ExtractedStep {
  step: string;
  rasci: Record<string, string>;
  confidence: number;
  clarifications?: string[];
  source?: string;
}

interface Extracted {
  roles: string[];
  steps: ExtractedStep[];
  globalClarifications: string[];
}

const RASCI_COLORS: Record<string, string> = { R: '#1A1A1A', A: '#C0350A', S: '#8A7560', C: '#2E7D88', I: '#8A8070' };
const CYCLE: Record<string, string> = { '': 'R', R: 'A', A: 'S', S: 'C', C: 'I', I: '' };

export default function RASCIPage() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [newStep, setNewStep] = useState('');
  const [newRole, setNewRole] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  // Upload + extraction state
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // keyed by stepIdx:qIdx or "global:idx"
  const [merging, setMerging] = useState(false);

  // Persistence
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Load existing on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/process/save');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.steps)) {
          setProcesses(
            data.steps.map((s: { step: string; rasci: Record<string, string>; confirmed: boolean; note: string }) => ({
              id: crypto.randomUUID(),
              step: s.step,
              rasci: s.rasci || {},
              confirmed: !!s.confirmed,
              note: s.note || '',
            })),
          );
        }
        if (Array.isArray(data.roles)) setRoles(data.roles);
      } catch {
        // silent — page still functional
      }
    })();
  }, []);

  const addStep = () => {
    if (!newStep.trim()) return;
    setProcesses([...processes, { id: crypto.randomUUID(), step: newStep.trim(), rasci: {}, confirmed: false, note: '' }]);
    setNewStep('');
  };

  const addRole = () => {
    const r = newRole.trim();
    if (!r || roles.includes(r)) return;
    setRoles([...roles, r]);
    setNewRole('');
  };

  const removeStep = (id: string) => setProcesses(processes.filter((p) => p.id !== id));
  const removeRole = (r: string) => {
    setRoles(roles.filter((x) => x !== r));
    setProcesses(processes.map((p) => { const nr = { ...p.rasci }; delete nr[r]; return { ...p, rasci: nr }; }));
  };

  const cycleRasci = (id: string, role: string) => {
    setProcesses(processes.map((p) => {
      if (p.id !== id) return p;
      const cur = p.rasci[role] || '';
      return { ...p, rasci: { ...p.rasci, [role]: CYCLE[cur] } };
    }));
  };

  const toggleConfirm = (id: string) => {
    setProcesses(processes.map((p) => p.id === id ? { ...p, confirmed: !p.confirmed } : p));
  };

  // ── Upload flow ────────────────────────────────────────────────────────────

  async function runExtract(input: { file?: File | null; text?: string }) {
    setExtracting(true); setExtractError(null); setExtracted(null); setAnswers({});
    try {
      const fd = new FormData();
      if (input.file) fd.append('file', input.file);
      if (input.text) fd.append('text', input.text);
      const res = await fetch('/api/process/extract', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setExtractError(data.error || `Extraction failed (${res.status})`);
        setExtracting(false);
        return;
      }
      setExtracted(data.extracted as Extracted);
    } catch (err) {
      setExtractError((err as Error).message || 'Network error');
    } finally {
      setExtracting(false);
    }
  }

  function mergeExtracted() {
    if (!extracted) return;
    setMerging(true);
    // Merge roles (de-dup)
    const newRoles = Array.from(new Set([...roles, ...extracted.roles.filter(Boolean)]));
    setRoles(newRoles);
    // Append steps as new processes (don't overwrite existing)
    const next: Process[] = extracted.steps.map((s) => ({
      id: crypto.randomUUID(),
      step: s.step,
      rasci: { ...s.rasci },
      // If user provided clarification answers, attach them as note for traceability
      note: [
        s.source ? `Source: ${s.source}` : '',
        ...(s.clarifications || []).map((q, i) => {
          const a = answers[`s${extracted.steps.indexOf(s)}:q${i}`];
          return a ? `Q: ${q}\nA: ${a}` : '';
        }),
      ].filter(Boolean).join('\n'),
      confirmed: s.confidence >= 0.85 && (s.clarifications || []).length === 0,
    }));
    setProcesses([...processes, ...next]);
    setExtracted(null);
    setAnswers({});
    setMerging(false);
  }

  async function saveAll() {
    setSaving(true);
    try {
      const res = await fetch('/api/process/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roles,
          steps: processes.map((p) => ({
            step: p.step, rasci: p.rasci, confirmed: p.confirmed, note: p.note,
          })),
          replaceExisting: true,
        }),
      });
      if (res.ok) setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  const gaps = processes.filter((p) => !Object.values(p.rasci).includes('A'));
  const confirmed = processes.filter((p) => p.confirmed).length;
  const inputCls = 'rounded-md border border-border-default bg-white px-3 py-[7px] font-body text-xs text-text-primary outline-none';

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1000px]">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-text-primary">Process Intelligence</h1>
          <div className="flex items-center gap-2">
            <button type="button" onClick={saveAll} disabled={saving || processes.length === 0}
              className="rounded border border-border-default bg-white px-2.5 py-1 font-body text-[11px] text-text-primary disabled:opacity-40">
              {saving ? 'Saving…' : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : 'Save'}
            </button>
            <button type="button" onClick={() => setShowGuide(!showGuide)}
              className="rounded border border-border-default px-2.5 py-1 font-body text-[11px] text-text-muted">
              {showGuide ? 'Hide guide' : 'How to use RASCI'}
            </button>
          </div>
        </div>
        <p className="mb-5 text-[13px] leading-relaxed text-text-secondary">
          Build your process-to-role RASCI map. Add roles (columns) and process steps (rows), then click cells to assign responsibility.
          Or upload a process flow chart / department rules document — AI will read it for you.
        </p>

        {showGuide && (
          <div className="mb-[18px] rounded-lg border border-[#C5D9EF] bg-info-bg p-3.5 text-xs leading-[1.7] text-info">
            <strong>R</strong> = Responsible (does it) · <strong>A</strong> = Accountable (owns outcome, one per step) · <strong>S</strong> = Support · <strong>C</strong> = Consulted · <strong>I</strong> = Informed
            <br />Click a cell to cycle R → A → S → C → I → empty. Every step needs exactly one A.
          </div>
        )}

        {/* Upload card */}
        <div className="mb-[18px] rounded-lg border border-border-default bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">Import from document</div>
            <span className="text-[10px] text-text-muted">PDF · DOCX · TXT · PNG/JPG</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
            <div className="flex flex-col gap-1">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.csv,image/png,image/jpeg,image/gif,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={extracting}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) runExtract({ file: f });
                  if (fileRef.current) fileRef.current.value = '';
                }}
                className="text-xs"
              />
              <span className="text-[10px] text-text-muted">A flow chart, RASCI table, or written procedure.</span>
            </div>
            <div className="hidden self-center text-[10px] uppercase tracking-widest text-text-muted sm:block">or</div>
            <div className="flex flex-col gap-1">
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="Paste the procedure text here…"
                rows={3}
                className={`${inputCls} resize-y`}
              />
              <button type="button" disabled={extracting || !pasted.trim()}
                onClick={() => { runExtract({ text: pasted }); setPasted(''); }}
                className="self-end rounded-md bg-surface-header px-3 py-[6px] font-body text-[11px] font-medium text-text-on-dark disabled:opacity-40">
                {extracting ? 'Reading…' : 'Extract from text'}
              </button>
            </div>
          </div>
          {extractError && (
            <div className="mt-2 rounded border border-danger bg-danger-bg px-3 py-2 text-xs text-danger">{extractError}</div>
          )}
        </div>

        {/* Extraction preview + clarifications */}
        {extracted && (
          <div className="mb-[18px] rounded-lg border-2 border-[#C0350A] bg-[#FFF8F4] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-display text-[15px] font-semibold text-text-primary">
                  Extracted {extracted.steps.length} step{extracted.steps.length !== 1 ? 's' : ''} · {extracted.roles.length} role{extracted.roles.length !== 1 ? 's' : ''}
                </div>
                <div className="text-[11px] text-text-muted">Review the extraction. Answer any questions, then merge into your RASCI map.</div>
              </div>
              <button type="button" onClick={() => setExtracted(null)}
                className="rounded border border-border-default px-2.5 py-1 text-[11px] text-text-muted">
                Discard
              </button>
            </div>

            {/* Roles preview */}
            <div className="mb-3">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">Detected roles</div>
              <div className="flex flex-wrap gap-1.5">
                {extracted.roles.map((r) => (
                  <span key={r} className="rounded-full border border-[#C0350A]/30 bg-white px-2 py-0.5 text-[11px]">{r}</span>
                ))}
                {extracted.roles.length === 0 && <span className="text-[11px] italic text-text-muted">None detected — you may need to add them manually.</span>}
              </div>
            </div>

            {/* Global clarifications */}
            {extracted.globalClarifications.length > 0 && (
              <div className="mb-3 rounded border border-warning bg-warning-bg p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-warning">⚠ Questions about overall structure</div>
                {extracted.globalClarifications.map((q, i) => (
                  <div key={i} className="mb-2 last:mb-0">
                    <div className="text-[12px] text-text-primary">{q}</div>
                    <input
                      value={answers[`global:${i}`] || ''}
                      onChange={(e) => setAnswers({ ...answers, [`global:${i}`]: e.target.value })}
                      placeholder="Your answer (optional)"
                      className={`${inputCls} mt-1 w-full text-[11px]`}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Steps preview */}
            <div className="space-y-2">
              {extracted.steps.map((s, idx) => {
                const lowConf = s.confidence < 0.7;
                const hasClarifications = (s.clarifications || []).length > 0;
                return (
                  <div key={idx} className="rounded border border-border-default bg-white p-3">
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-[13px] font-medium text-text-primary">{s.step}</div>
                        {s.source && <div className="mt-0.5 text-[10px] italic text-text-muted">"{s.source}"</div>}
                      </div>
                      <div className="text-right">
                        <div className={`text-[10px] font-bold ${lowConf ? 'text-warning' : 'text-success'}`}>
                          {Math.round(s.confidence * 100)}% confidence
                        </div>
                        <div className="mt-0.5 flex flex-wrap justify-end gap-1">
                          {Object.entries(s.rasci).map(([role, val]) => (
                            <span key={role} className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                              style={{ background: '#F4ECDF', color: RASCI_COLORS[val as string] || '#555' }}>
                              {role}={val as string}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {hasClarifications && (
                      <div className="mt-2 rounded border border-warning bg-warning-bg p-2">
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-warning">⚠ Questions</div>
                        {s.clarifications!.map((q, qIdx) => (
                          <div key={qIdx} className="mb-1.5 last:mb-0">
                            <div className="text-[11px] text-text-primary">{q}</div>
                            <input
                              value={answers[`s${idx}:q${qIdx}`] || ''}
                              onChange={(e) => setAnswers({ ...answers, [`s${idx}:q${qIdx}`]: e.target.value })}
                              placeholder="Your answer"
                              className={`${inputCls} mt-1 w-full text-[11px]`}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setExtracted(null)}
                className="rounded border border-border-default px-3 py-1.5 text-xs text-text-muted">
                Cancel
              </button>
              <button type="button" onClick={mergeExtracted} disabled={merging}
                className="rounded bg-[#C0350A] px-4 py-1.5 font-body text-xs font-medium text-white">
                {merging ? 'Merging…' : `Merge ${extracted.steps.length} step${extracted.steps.length !== 1 ? 's' : ''} →`}
              </button>
            </div>
          </div>
        )}

        {/* KPIs */}
        {processes.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-3">
            {[
              { label: 'Steps', val: processes.length, col: 'text-text-primary' },
              { label: 'Confirmed', val: confirmed, col: 'text-success' },
              { label: 'Missing A', val: gaps.length, col: gaps.length > 0 ? 'text-danger' : 'text-success' },
            ].map(({ label, val, col }) => (
              <div key={label} className="min-w-[80px] rounded-lg border border-border-default bg-white p-[10px_16px] text-center">
                <div className={`font-display text-xl font-bold ${col}`}>{val}</div>
                <div className="text-[10px] text-text-muted">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Add inputs */}
        <div className="mb-[18px] grid grid-cols-2 gap-3.5">
          <div className="rounded-lg border border-border-default bg-white p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">Add Role (Column)</div>
            <div className="flex gap-2">
              <input value={newRole} onChange={(e) => setNewRole(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRole()}
                placeholder="e.g. HR Manager, IT Lead..." className={`${inputCls} flex-1`} />
              <button type="button" onClick={addRole} className="rounded-md bg-surface-header px-3.5 py-[7px] font-body text-xs font-medium text-text-on-dark">+ Add</button>
            </div>
            {roles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-[5px]">
                {roles.map((r) => (
                  <span key={r} className="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-page px-2 py-0.5 text-[11px]">
                    {r}
                    <button type="button" onClick={() => removeRole(r)} className="text-xs text-text-muted">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border-default bg-white p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">Add Process Step (Row)</div>
            <div className="flex gap-2">
              <input value={newStep} onChange={(e) => setNewStep(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addStep()}
                placeholder="e.g. 8.2.1 Define data governance policy" className={`${inputCls} flex-1`} />
              <button type="button" onClick={addStep} className="rounded-md bg-surface-header px-3.5 py-[7px] font-body text-xs font-medium text-text-on-dark">+ Add</button>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {processes.length === 0 && (
          <div className="rounded-lg border border-dashed border-border-default bg-white p-12 text-center">
            <div className="mb-3 text-[32px] opacity-30">⊞</div>
            <div className="mb-2 font-display text-lg text-text-primary">No process steps yet</div>
            <div className="mx-auto max-w-[420px] text-xs leading-[1.7] text-text-muted">
              Add roles (columns) and process steps (rows) above, upload a document, or paste text — then assign RASCI.
            </div>
          </div>
        )}

        {/* RASCI Table */}
        {processes.length > 0 && roles.length > 0 && (
          <div className="mb-4 overflow-x-auto rounded-lg border border-border-default bg-white p-5">
            <table className="w-full min-w-[400px] border-collapse text-[11px]">
              <thead>
                <tr className="border-b-2 border-border-default">
                  <th className="min-w-[200px] p-2 text-left text-[9px] font-semibold uppercase text-text-muted">Process step</th>
                  <th className="w-[70px] p-2 text-center text-[9px] font-semibold uppercase text-text-muted">Status</th>
                  {roles.map((r) => (
                    <th key={r} className="min-w-[80px] p-2 text-center text-[9px] font-semibold uppercase text-text-muted">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processes.map((proc) => {
                  const hasA = Object.values(proc.rasci).includes('A');
                  return (
                    <tr key={proc.id} className="border-b border-border-default" style={{ background: proc.confirmed ? '#F8FFF9' : !hasA ? '#FFFBF0' : '#fff' }}>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className={`flex-1 text-xs ${!hasA ? 'font-semibold' : ''}`}>
                            {!hasA && <span className="mr-1 text-warning">⚠</span>}
                            {proc.step}
                            {proc.note && <div className="mt-0.5 text-[10px] italic text-text-muted whitespace-pre-line">{proc.note}</div>}
                          </div>
                          <button type="button" onClick={() => removeStep(proc.id)} className="text-[13px] text-border-default">×</button>
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <button type="button" onClick={() => toggleConfirm(proc.id)}
                          className={`rounded border px-[7px] py-0.5 font-body text-[10px] ${proc.confirmed ? 'border-success bg-success-bg text-success' : 'border-border-default bg-surface-page text-text-muted'}`}>
                          {proc.confirmed ? '✓ Conf.' : 'Hyp.'}
                        </button>
                      </td>
                      {roles.map((role) => {
                        const val = proc.rasci[role] || '';
                        return (
                          <td key={role} className="cursor-pointer select-none p-2 text-center" title="Click to cycle"
                            onClick={() => cycleRasci(proc.id, role)}>
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded text-xs font-bold transition-all"
                              style={{
                                color: val ? (RASCI_COLORS[val] || '#555') : '#E0DBD4',
                                background: val === 'A' ? '#FEF0EA' : val === 'R' ? '#F0F0F0' : 'transparent',
                                fontSize: val ? 12 : 18,
                              }}>
                              {val || '·'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Gaps warning */}
        {gaps.length > 0 && processes.length > 0 && (
          <div className="rounded-lg border border-[#FDE68A] bg-warning-bg p-3 text-xs text-warning">
            <strong>⚠ {gaps.length} step{gaps.length > 1 ? 's' : ''} missing Accountable (A):</strong>{' '}
            {gaps.map((p) => p.step).join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}
