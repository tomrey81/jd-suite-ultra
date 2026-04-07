'use client';

import { useState } from 'react';

interface Process {
  id: string;
  step: string;
  rasci: Record<string, string>;
  confirmed: boolean;
  note: string;
}

const RASCI_COLORS: Record<string, string> = { R: '#1A1A1A', A: '#C0350A', S: '#8A7560', C: '#2E7D88', I: '#8A8070' };
const CYCLE: Record<string, string> = { '': 'R', R: 'A', A: 'S', S: 'C', C: 'I', I: '' };

export default function RASCIPage() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [newStep, setNewStep] = useState('');
  const [newRole, setNewRole] = useState('');
  const [showGuide, setShowGuide] = useState(false);

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

  const gaps = processes.filter((p) => !Object.values(p.rasci).includes('A'));
  const confirmed = processes.filter((p) => p.confirmed).length;
  const inputCls = 'rounded-md border border-border-default bg-white px-3 py-[7px] font-body text-xs text-text-primary outline-none';

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1000px]">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-text-primary">Process Intelligence</h1>
          <button type="button" onClick={() => setShowGuide(!showGuide)}
            className="rounded border border-border-default px-2.5 py-1 font-body text-[11px] text-text-muted">
            {showGuide ? 'Hide guide' : 'How to use RASCI'}
          </button>
        </div>
        <p className="mb-5 text-[13px] leading-relaxed text-text-secondary">
          Build your process-to-role RASCI map. Add roles (columns) and process steps (rows), then click cells to assign responsibility.
        </p>

        {showGuide && (
          <div className="mb-[18px] rounded-lg border border-[#C5D9EF] bg-info-bg p-3.5 text-xs leading-[1.7] text-info">
            <strong>R</strong> = Responsible (does it) · <strong>A</strong> = Accountable (owns outcome, one per step) · <strong>S</strong> = Support · <strong>C</strong> = Consulted · <strong>I</strong> = Informed
            <br />Click a cell to cycle R → A → S → C → I → empty. Every step needs exactly one A.
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
              Add roles (columns) and process steps (rows) above, then click cells to assign RASCI.
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
