'use client';

import { useMemo, useState } from 'react';
import { HypothesisPanel } from '@/components/hypotheses/hypothesis-panel';

interface BiasFlag {
  layer: 'lexical' | 'title' | 'structural' | 'implicit';
  category: string;
  severity: 'low' | 'medium' | 'high' | 'block';
  start: number;
  end: number;
  matched: string;
  pattern: string;
  notes: string;
  source: string;
  remediation?: string;
}

interface BiasReport {
  language: 'en' | 'pl';
  inputLength: number;
  agenticCount: number;
  communalCount: number;
  skewScore: number;
  skewLevel: 'balanced' | 'soft_warn' | 'hard_warn';
  flags: BiasFlag[];
  eigeCoverage: { cognitive: boolean; emotional: boolean; physical: boolean };
  implicit: { pinkJobUndervaluation: boolean; machoLeadership: boolean; elektromonterTrap: boolean };
}

const SAMPLE_EN = `Senior Sales Engineering Lead

We are looking for an aggressive, ambitious individual contributor who thrives in a competitive, fast-paced environment. The successful candidate will be a confident, decisive leader, comfortable taking autonomous decisions under pressure.

You will analyze technical requirements, lead architectural reasoning, and present strategic plans to executive stakeholders. You must be self-reliant, fearless, and dominant in client conversations.

Required: 8+ years of progressively senior technical sales experience. Must lift demo equipment up to 25 kg.`;

const SAMPLE_PL = `Specjalista ds. obsługi klienta

Poszukujemy ambitnej, zdecydowanej osoby do dynamicznego zespołu. Wymagamy nastawienia na rezultaty oraz umiejętności rywalizacji w szybkim środowisku.

Obowiązki: prowadzenie rozmów z klientami, dbanie o wysoką jakość obsługi, wsparcie zespołu sprzedaży.

Wymagania: doświadczenie w obsłudze klienta, samodzielność, asertywność, gotowość do pracy pod presją.`;

const SEVERITY_BG: Record<string, string> = {
  low: 'bg-yellow-100',
  medium: 'bg-orange-100',
  high: 'bg-red-100',
  block: 'bg-red-200',
};

const SEVERITY_BORDER: Record<string, string> = {
  low: 'border-yellow-400',
  medium: 'border-orange-500',
  high: 'border-red-500',
  block: 'border-red-700',
};

const CATEGORY_LABEL: Record<string, string> = {
  agentic: 'agentic',
  communal: 'communal',
  'title-singular': 'title (single-gender)',
  'eige-coverage': 'EIGE coverage',
  'implicit-bias': 'implicit bias',
};

type PackId = 'ist85' | 'nz-payequity' | 'uk-birmingham';

const AVAILABLE_PACKS: Array<{ id: PackId; short: string; label: string; description: string }> = [
  { id: 'ist85', short: 'IS / ÍST 85', label: 'ÍST 85 — Iceland Equal Pay', description: 'Iceland 2024 implicit-bias rules; rockstar/ninja/wojownik flags; emotional-effort enforcement.' },
  { id: 'nz-payequity', short: 'NZ Pay Equity', label: 'NZ Pay Equity (Public Service)', description: 'Requires Skills + Responsibilities + Conditions + Experience to be assessable.' },
  { id: 'uk-birmingham', short: 'UK Birmingham', label: 'UK Birmingham (Bonus rule)', description: 'Bonus/allowance without explicit eligibility = unequal pay (Birmingham 2023).' },
];

export default function BiasCheckPage() {
  const [language, setLanguage] = useState<'en' | 'pl'>('en');
  const [text, setText] = useState(SAMPLE_EN);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<BiasReport | null>(null);
  const [lexVer, setLexVer] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [enabledPacks, setEnabledPacks] = useState<Set<PackId>>(new Set());

  function togglePack(id: PackId) {
    setEnabledPacks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setReport(null); // results invalid for prior pack set
  }

  async function run() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/v5/bias-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language, packs: Array.from(enabledPacks) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Bias check failed (${res.status})`);
        setReport(null);
        return;
      }
      setReport(data.report);
      setLexVer(data.lexiconVersion || '');
    } catch (e) {
      setError((e as Error).message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  function loadSample(l: 'en' | 'pl') {
    setLanguage(l);
    setText(l === 'en' ? SAMPLE_EN : SAMPLE_PL);
    setReport(null);
  }

  // Render the input with bias spans highlighted (per spec §8: wavy red underline + margin)
  const annotated = useMemo(() => {
    if (!report || report.flags.length === 0) return null;
    const segments: Array<{ kind: 'plain' | 'flag'; text: string; flag?: BiasFlag }> = [];
    let cur = 0;
    const flags = [...report.flags].sort((a, b) => a.start - b.start);
    for (const f of flags) {
      if (f.start > cur) segments.push({ kind: 'plain', text: text.slice(cur, f.start) });
      segments.push({ kind: 'flag', text: text.slice(f.start, f.end), flag: f });
      cur = f.end;
    }
    if (cur < text.length) segments.push({ kind: 'plain', text: text.slice(cur) });
    return segments;
  }, [report, text]);

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A7560]">JD Suite v5 · Phase 0a</div>
            <h1 className="font-display text-2xl font-semibold text-[#1A1A1A]">Bias check</h1>
            <p className="mt-1 text-[12px] text-[#55524A]">
              Layer 1 (lexical) + Layer 2 (title pair) + Layer 3 (EIGE coverage) + Layer 4 (Iceland implicit-bias).
              Lexicons: Gaucher 2011 + Matfield + EU-26 v0 (EN, PL).
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/v5" className="rounded border border-[#E0DBD4] bg-white px-3 py-1.5 text-[11px] text-[#1A1A1A]">
              ← v5 home
            </a>
          </div>
        </div>

        {/* Input + controls */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-lg border border-[#E0DBD4] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex gap-1">
                {(['en', 'pl'] as const).map((l) => (
                  <button key={l} onClick={() => setLanguage(l)}
                    className={`rounded px-2.5 py-1 text-[11px] font-medium ${language === l ? 'bg-[#1A1A1A] text-white' : 'bg-[#F4ECDF] text-[#1A1A1A]'}`}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <button onClick={() => loadSample('en')} className="rounded border border-[#E0DBD4] px-2.5 py-1 text-[10px] text-[#55524A]">
                  Sample EN
                </button>
                <button onClick={() => loadSample('pl')} className="rounded border border-[#E0DBD4] px-2.5 py-1 text-[10px] text-[#55524A]">
                  Sample PL
                </button>
                <button onClick={() => { setText(''); setReport(null); }} className="rounded border border-[#E0DBD4] px-2.5 py-1 text-[10px] text-[#55524A]">
                  Clear
                </button>
              </div>
            </div>

            {/* P0f — opt-in policy packs */}
            <div className="mb-3 rounded border border-[#F4ECDF] bg-[#FAF7F2] p-2.5">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8A7560]">
                Policy packs (opt-in)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_PACKS.map((p) => {
                  const on = enabledPacks.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePack(p.id)}
                      title={p.description}
                      className={`rounded px-2 py-1 text-[10px] font-medium transition ${
                        on
                          ? 'bg-[#8A7560] text-white border border-[#8A7560]'
                          : 'bg-white text-[#55524A] border border-[#E0DBD4] hover:border-[#8A7560]'
                      }`}
                    >
                      {on ? '✓ ' : ''}{p.short}
                    </button>
                  );
                })}
              </div>
            </div>

            {report && annotated ? (
              <div className="mb-3 max-h-[400px] overflow-y-auto rounded border border-[#F4ECDF] bg-[#FAF7F2] p-3 font-mono text-[12px] leading-[1.7] text-[#1A1A1A] whitespace-pre-wrap">
                {annotated.map((seg, i) => seg.kind === 'plain' ? (
                  <span key={i}>{seg.text}</span>
                ) : (
                  <span key={i}
                    title={`${seg.flag!.layer} · ${CATEGORY_LABEL[seg.flag!.category] || seg.flag!.category} · ${seg.flag!.severity}\n${seg.flag!.notes}\n${seg.flag!.remediation || ''}`}
                    className={`rounded px-0.5 ${SEVERITY_BG[seg.flag!.severity]} border-b-2 border-dotted ${SEVERITY_BORDER[seg.flag!.severity]} cursor-help`}
                    style={{ textDecorationStyle: 'wavy' }}>
                    {seg.text}
                  </span>
                ))}
              </div>
            ) : (
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={16}
                placeholder="Paste a JD here — title, purpose, accountabilities, skills, conditions."
                className="mb-3 w-full resize-y rounded border border-[#E0DBD4] bg-[#FAF7F2] p-3 font-mono text-[12px] leading-[1.7] outline-none" />
            )}

            <div className="flex items-center justify-between">
              <div className="text-[10px] text-[#55524A]">
                {text.length.toLocaleString()} chars
                {lexVer && <> · lex {lexVer}</>}
              </div>
              <div className="flex gap-2">
                {report && (
                  <button onClick={() => setReport(null)} className="rounded border border-[#E0DBD4] px-3 py-1.5 text-[11px] text-[#55524A]">
                    Edit text
                  </button>
                )}
                <button onClick={run} disabled={loading || !text.trim()}
                  className="rounded bg-[#1A1A1A] px-4 py-1.5 text-[11px] font-medium text-white disabled:opacity-40">
                  {loading ? 'Analysing…' : 'Run bias check'}
                </button>
              </div>
            </div>
            {error && <div className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-[11px] text-red-700">{error}</div>}
          </div>

          {/* Report rail */}
          <div className="space-y-3">
            {report && (
              <>
                {/* Skew score */}
                <div className="rounded-lg border border-[#E0DBD4] bg-white p-4">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#8A7560]">Agentic ↔ Communal</div>
                  <div className="font-display text-2xl font-semibold text-[#1A1A1A]">
                    {report.skewScore > 0 ? '+' : ''}{report.skewScore.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-[#55524A]">
                    {report.agenticCount} agentic · {report.communalCount} communal · {' '}
                    <span className={
                      report.skewLevel === 'balanced' ? 'text-green-700 font-semibold' :
                      report.skewLevel === 'soft_warn' ? 'text-orange-600 font-semibold' :
                      'text-red-600 font-semibold'
                    }>
                      {report.skewLevel === 'balanced' ? 'balanced' : report.skewLevel === 'soft_warn' ? 'soft warn' : 'hard warn'}
                    </span>
                  </div>
                  {/* Skew bar */}
                  <div className="mt-2 h-2 rounded-full bg-[#F4ECDF] relative">
                    <div
                      className={`absolute top-0 h-2 rounded-full ${report.skewScore > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                      style={{
                        left: report.skewScore > 0 ? '50%' : `${50 + report.skewScore * 50}%`,
                        width: `${Math.abs(report.skewScore) * 50}%`,
                      }}
                    />
                    <div className="absolute top-[-2px] left-1/2 h-3 w-[1px] bg-[#1A1A1A]" />
                  </div>
                  <div className="mt-1 flex justify-between text-[9px] text-[#55524A]">
                    <span>−1 (communal)</span><span>0 (balanced)</span><span>+1 (agentic)</span>
                  </div>
                </div>

                {/* EIGE coverage */}
                <div className="rounded-lg border border-[#E0DBD4] bg-white p-4">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8A7560]">EIGE effort coverage</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'E1 cognitive', ok: report.eigeCoverage.cognitive },
                      { label: 'E2 emotional', ok: report.eigeCoverage.emotional },
                      { label: 'E3 physical', ok: report.eigeCoverage.physical },
                    ].map((c) => (
                      <div key={c.label} className={`rounded border p-2 ${c.ok ? 'border-green-400 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                        <div className="text-base font-bold">{c.ok ? '✓' : '✗'}</div>
                        <div className="text-[10px] text-[#55524A]">{c.label}</div>
                      </div>
                    ))}
                  </div>
                  {!report.eigeCoverage.emotional && (
                    <div className="mt-2 text-[10px] italic text-red-700">
                      E2 (emotional) absent. In care/customer/teaching roles this is the canonical pink-job miss.
                    </div>
                  )}
                </div>

                {/* Iceland implicit-bias */}
                <div className="rounded-lg border border-[#E0DBD4] bg-white p-4">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8A7560]">Iceland implicit-bias</div>
                  <ul className="space-y-1.5 text-[11px]">
                    {[
                      { label: 'Pink-job undervaluation', flagged: report.implicit.pinkJobUndervaluation, ref: 'Iceland 2024 §11' },
                      { label: 'Macho-coded leadership', flagged: report.implicit.machoLeadership, ref: 'high R/S + empty E2' },
                      { label: 'Elektromonter trap', flagged: report.implicit.elektromonterTrap, ref: 'physical-effort claim mismatch' },
                    ].map((c) => (
                      <li key={c.label} className="flex items-start justify-between gap-2">
                        <div className={c.flagged ? 'text-red-700 font-semibold' : 'text-[#1A1A1A]'}>
                          {c.flagged ? '⚠' : '✓'} {c.label}
                        </div>
                        <div className="text-[9px] italic text-[#55524A]">{c.ref}</div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Top flags list */}
                <div className="rounded-lg border border-[#E0DBD4] bg-white p-4">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8A7560]">All flags ({report.flags.length})</div>
                  {report.flags.length === 0 ? (
                    <div className="text-[11px] italic text-[#55524A]">No biased phrasing detected at the lexical or title layers.</div>
                  ) : (
                    <ul className="max-h-[240px] space-y-1 overflow-y-auto pr-1 text-[11px]">
                      {report.flags.map((f, i) => (
                        <li key={i} className={`rounded border-l-2 p-1.5 ${SEVERITY_BORDER[f.severity]} ${SEVERITY_BG[f.severity]}`}>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono font-semibold">{f.matched}</span>
                            <span className="text-[9px] uppercase text-[#55524A]">
                              {CATEGORY_LABEL[f.category] || f.category} · {f.severity}
                            </span>
                          </div>
                          {f.remediation && <div className="mt-0.5 text-[10px] text-[#55524A]">→ {f.remediation}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
            {!report && (
              <div className="rounded-lg border border-dashed border-[#E0DBD4] bg-white p-8 text-center text-[12px] text-[#55524A]">
                Paste a JD or load a sample, then click <strong>Run bias check</strong>.
              </div>
            )}
          </div>
        </div>

        {/* Hypothesis testing — Axiomera-style 56-hypothesis structural fit */}
        <div className="mt-6">
          <HypothesisPanel
            jdText={text}
            language={language === 'pl' ? 'pl' : 'pl'}
            title="Axiomera 56-hypothesis structural test"
          />
        </div>
      </div>
    </div>
  );
}
