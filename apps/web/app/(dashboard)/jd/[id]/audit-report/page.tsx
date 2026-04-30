'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Axis {
  key: string; label: string; color: string;
  score: number; status: 'sufficient' | 'partial' | 'insufficient';
  ok: number; partial: number; gap: number;
  gapItems: Array<{ id: number; name: string; gap: string }>;
}

interface Section {
  id: string; label: string; completeness: number; filled: number; total: number;
  missingFields: string[];
}

interface Bias {
  language: 'en' | 'pl';
  lexiconVersion: string;
  agenticCount: number;
  communalCount: number;
  skewScore: number;
  skewLevel: 'balanced' | 'soft_warn' | 'hard_warn';
  flagsCount: number;
  eigeCoverage: { cognitive: boolean; emotional: boolean; physical: boolean };
  implicit: { pinkJobUndervaluation: boolean; machoLeadership: boolean; elektromonterTrap: boolean };
  topFlags: Array<{ category: string; severity: string; matched: string; notes: string }>;
}

interface Report {
  ok: boolean;
  jd: { id: string; jobTitle: string; status: string; folder: string | null; createdAt: string; updatedAt: string };
  overall: { combined: number; overallCompleteness: number; overallEval: number };
  verdict: { level: 'ready' | 'review' | 'not_ready'; headline: string; detail: string };
  axes: Axis[];
  sections: Section[];
  bias: Bias;
  eval: { summary: string; criteria: Array<{ id: number; status: string; gaps: string[] }> } | null;
  generatedAt: string;
}

const VERDICT_STYLE: Record<Report['verdict']['level'], { bg: string; border: string; emoji: string; tag: string }> = {
  ready: { bg: '#ECFDF5', border: '#059669', emoji: '✓', tag: 'Ready' },
  review: { bg: '#FFFBEB', border: '#D97706', emoji: '⚠', tag: 'Needs review' },
  not_ready: { bg: '#FEF2F2', border: '#DC2626', emoji: '✗', tag: 'Not ready' },
};

export default function AuditReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skipAI, setSkipAI] = useState(false);

  async function load(opts: { skipAI?: boolean } = {}) {
    setLoading(true); setError(null);
    try {
      const url = `/api/jd/${id}/audit-report${opts.skipAI ? '?skipAI=1' : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Failed (${res.status})`);
      } else {
        setReport(data);
      }
    } catch (e) {
      setError((e as Error).message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load({ skipAI }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (loading) return (
    <div className="flex h-full items-center justify-center text-[13px] text-text-muted">
      Generating audit report — running EUPTD evaluation, bias scan, and completeness check…
    </div>
  );
  if (error) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="rounded-lg border border-danger bg-danger-bg p-6 text-[12px] text-danger">{error}</div>
    </div>
  );
  if (!report) return null;

  const v = VERDICT_STYLE[report.verdict.level];

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] print:bg-white">
      {/* Toolbar — hidden on print */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-default bg-white px-6 py-3 print:hidden">
        <div>
          <Link href={`/jd/${id}`} className="text-[11px] text-brand-gold hover:underline">← Back to JD</Link>
          <div className="font-display text-[15px] font-semibold text-text-primary">JD Audit Report</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setSkipAI(false); load({ skipAI: false }); }}
            className="rounded border border-border-default bg-white px-3 py-1.5 text-[11px]">
            ↻ Re-run with AI
          </button>
          <button onClick={() => window.print()}
            className="rounded-md bg-brand-gold px-4 py-1.5 text-[11px] font-medium text-white">
            ↓ Save as PDF (Print)
          </button>
        </div>
      </div>

      {/* Page wrapper — A4-ish width */}
      <div className="mx-auto max-w-[860px] px-8 py-10 text-[#1A1A1A] print:py-6">
        {/* Cover */}
        <div className="border-b border-[#1A1A1A] pb-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A7560]">JD Suite — audit report</div>
          <h1 className="mt-1 font-display text-3xl font-semibold leading-tight">
            {report.jd.jobTitle || 'Untitled'}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-[#55524A]">
            <span><strong>Status:</strong> {report.jd.status}</span>
            {report.jd.folder && <span><strong>Folder:</strong> {report.jd.folder}</span>}
            <span><strong>Last edit:</strong> {new Date(report.jd.updatedAt).toLocaleString()}</span>
            <span><strong>Generated:</strong> {new Date(report.generatedAt).toLocaleString()}</span>
            <span><strong>Lexicon:</strong> {report.bias.lexiconVersion}</span>
          </div>
        </div>

        {/* Verdict block */}
        <section className="mt-6 rounded-lg border-2 p-5"
          style={{ background: v.bg, borderColor: v.border }}>
          <div className="flex items-start gap-4">
            <div className="text-4xl leading-none" style={{ color: v.border }}>{v.emoji}</div>
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: v.border }}>{v.tag}</div>
              <div className="font-display text-2xl font-semibold leading-tight" style={{ color: v.border }}>
                {report.verdict.headline}
              </div>
              <div className="mt-1 text-[13px] leading-relaxed text-[#3A3A3A]">{report.verdict.detail}</div>
            </div>
            <div className="text-right">
              <div className="font-display text-3xl font-bold tabular-nums" style={{ color: v.border }}>
                {report.overall.combined}<span className="text-base">%</span>
              </div>
              <div className="text-[9px] uppercase tracking-wider text-[#55524A]">Overall</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ScoreLine label="Document completeness" score={report.overall.overallCompleteness} />
            <ScoreLine label="EUPTD readiness" score={report.overall.overallEval} />
          </div>
        </section>

        {/* Section 1 — EUPTD axes */}
        <SectionHeading num="1" title="EUPTD readiness — four axes" />
        <p className="text-[11px] leading-relaxed text-[#55524A]">
          EU Pay Transparency Directive 2023/970 (Art. 4) requires job descriptions to be evaluated against four objective,
          gender-neutral axes. Each is scored from the 16-criterion ILO/EIGE framework.
        </p>

        {report.axes.length === 0 || report.axes.every((a) => a.score === 0) ? (
          <div className="mt-3 rounded border border-[#E0DBD4] bg-white p-3 text-[11px] italic text-[#55524A]">
            EUPTD evaluation not available (AI skipped or failed). The document-completeness section below still applies.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {report.axes.map((a) => (
              <div key={a.key} className="rounded-md border border-[#E0DBD4] bg-white p-3 break-inside-avoid">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                  <span className="flex-1 font-display text-[14px] font-semibold">{a.label}</span>
                  <span className="rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: a.status === 'sufficient' ? '#ECFDF5' : a.status === 'partial' ? '#FFFBEB' : '#FEF2F2',
                             color: a.status === 'sufficient' ? '#059669' : a.status === 'partial' ? '#D97706' : '#DC2626' }}>
                    {a.status === 'sufficient' ? 'OK' : a.status === 'partial' ? 'Partial' : 'Gap'}
                  </span>
                  <span className="font-mono text-[12px] font-bold tabular-nums">{a.score}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EDE9E0]">
                  <div className="h-full rounded-full"
                    style={{ width: `${a.score}%`,
                             background: a.status === 'sufficient' ? '#059669' : a.status === 'partial' ? '#D97706' : '#DC2626' }} />
                </div>
                <div className="mt-2 flex gap-3 text-[9px] uppercase tracking-wider text-[#55524A]">
                  <span>{a.ok} OK</span>
                  <span>{a.partial} partial</span>
                  <span>{a.gap} gap{a.gap !== 1 ? 's' : ''}</span>
                </div>
                {a.gapItems.length > 0 && (
                  <ul className="mt-2 space-y-0.5 pl-3 text-[11px] text-[#3A3A3A]">
                    {a.gapItems.map((g) => (
                      <li key={g.id}>
                        <strong>{g.name}:</strong> {g.gap || '(missing — add this section)'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Section 2 — Bias */}
        <SectionHeading num="2" title="Gender-bias scan" />
        <p className="text-[11px] leading-relaxed text-[#55524A]">
          Lexical scan (Gaucher 2011 + Matfield) plus EIGE structural coverage and Iceland 2024 implicit-bias signals.
          Language detected: <strong>{report.bias.language.toUpperCase()}</strong>.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 print:grid-cols-3">
          <Stat label="Agentic words" value={report.bias.agenticCount} accent="#C0350A" />
          <Stat label="Communal words" value={report.bias.communalCount} accent="#2DA44E" />
          <Stat label={`Skew (${report.bias.skewLevel.replace('_', ' ')})`}
            value={(report.bias.skewScore > 0 ? '+' : '') + report.bias.skewScore.toFixed(2)}
            accent={report.bias.skewLevel === 'balanced' ? '#2DA44E' : report.bias.skewLevel === 'soft_warn' ? '#D97706' : '#DC2626'} />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3 print:grid-cols-3">
          <CovTile label="E1 cognitive" ok={report.bias.eigeCoverage.cognitive} />
          <CovTile label="E2 emotional" ok={report.bias.eigeCoverage.emotional} />
          <CovTile label="E3 physical" ok={report.bias.eigeCoverage.physical} />
        </div>
        {!report.bias.eigeCoverage.emotional && (
          <div className="mt-2 rounded border border-[#FCD34D] bg-[#FFFBEB] p-2 text-[11px] text-[#92400E]">
            <strong>EIGE Layer 3 warning:</strong> emotional effort (E2) is absent. In care, customer-facing,
            and teaching roles this is the canonical pink-job miss.
          </div>
        )}

        {/* Iceland implicit-bias */}
        {(report.bias.implicit.pinkJobUndervaluation || report.bias.implicit.machoLeadership || report.bias.implicit.elektromonterTrap) && (
          <div className="mt-3 rounded border-2 border-[#DC2626] bg-[#FEF2F2] p-3 break-inside-avoid">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#991B1B]">
              Iceland 2024 §11 implicit-bias signals
            </div>
            <ul className="mt-1 space-y-0.5 text-[11px] text-[#3A3A3A]">
              {report.bias.implicit.pinkJobUndervaluation && (
                <li>⚠ Pink-job undervaluation pattern detected — emotional/care work likely under-scored.</li>
              )}
              {report.bias.implicit.machoLeadership && (
                <li>⚠ Macho-coded leadership pattern — high agentic skew + missing emotional dimension.</li>
              )}
              {report.bias.implicit.elektromonterTrap && (
                <li>⚠ Elektromonter-trap pattern — physical-effort claim may not match the actual job.</li>
              )}
            </ul>
          </div>
        )}

        {report.bias.topFlags.length > 0 && (
          <div className="mt-3 rounded border border-[#E0DBD4] bg-white p-3 break-inside-avoid">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#55524A]">
              Top {report.bias.topFlags.length} flagged tokens
            </div>
            <ul className="grid gap-1 text-[11px] sm:grid-cols-2 print:grid-cols-2">
              {report.bias.topFlags.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-mono font-semibold">{f.matched}</span>
                  <span className="text-[10px] uppercase text-[#55524A]">{f.category} · {f.severity}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Section 3 — Document completeness per section */}
        <SectionHeading num="3" title="Document completeness — section by section" />
        <p className="text-[11px] leading-relaxed text-[#55524A]">
          What is filled in versus what the JD Suite template expects. Use this with section 1 to know whether weak
          EUPTD scores stem from missing content or from inadequate framing.
        </p>
        <div className="mt-3 space-y-1">
          {report.sections.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded border border-[#E0DBD4] bg-white px-3 py-2 break-inside-avoid">
              <span className="w-6 font-mono text-[10px] font-bold text-[#8A7560]">§{s.id}</span>
              <span className="flex-1 text-[12px] font-medium">{s.label}</span>
              <span className="text-[10px] tabular-nums text-[#55524A]">{s.filled}/{s.total}</span>
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-[#EDE9E0]">
                <div className="h-full rounded-full"
                  style={{ width: `${s.completeness}%`,
                           background: s.completeness >= 75 ? '#059669' : s.completeness >= 50 ? '#D97706' : '#DC2626' }} />
              </div>
              <span className="w-10 text-right font-mono text-[11px] font-bold tabular-nums">{s.completeness}%</span>
            </div>
          ))}
        </div>

        {/* Section 4 — Recommendations */}
        <SectionHeading num="4" title="Recommendations & next steps" />
        <ol className="mt-2 space-y-2 text-[12px] leading-relaxed">
          {report.axes
            .filter((a) => a.gap > 0 || a.partial > 0)
            .slice(0, 4)
            .map((a, i) => (
              <li key={a.key} className="rounded border-l-4 bg-white p-3 pl-4" style={{ borderColor: a.color }}>
                <div className="font-display text-[13px] font-semibold">
                  {i + 1}. Strengthen <span style={{ color: a.color }}>{a.label}</span> ({a.score}%)
                </div>
                <ul className="mt-1 space-y-0.5 pl-3 text-[11px] text-[#3A3A3A]">
                  {a.gapItems.slice(0, 3).map((g) => (
                    <li key={g.id}>• <strong>{g.name}:</strong> {g.gap || 'add concrete detail / evidence'}</li>
                  ))}
                </ul>
              </li>
            ))}
          {report.bias.skewLevel !== 'balanced' && (
            <li className="rounded border-l-4 border-[#C0350A] bg-white p-3 pl-4">
              <div className="font-display text-[13px] font-semibold">
                {(report.axes.filter((a) => a.gap > 0 || a.partial > 0).length || 0) + 1}. Re-balance language
              </div>
              <p className="mt-1 text-[11px] text-[#3A3A3A]">
                Skew score {report.bias.skewScore} ({report.bias.skewLevel.replace('_', ' ')}).
                Pair flagged agentic terms with communal alternatives or remove if not essential.
                Top hits: {report.bias.topFlags.slice(0, 5).map((f) => f.matched).join(', ')}.
              </p>
            </li>
          )}
          {!report.bias.eigeCoverage.emotional && (
            <li className="rounded border-l-4 border-[#D97706] bg-white p-3 pl-4">
              <div className="font-display text-[13px] font-semibold">
                Add visible emotional effort (E2)
              </div>
              <p className="mt-1 text-[11px] text-[#3A3A3A]">
                EIGE Layer 3 — if this role faces customers, patients, students, or distressed colleagues, name it.
                Otherwise the systematic undervaluation pattern from Iceland 2024 §11 will trigger pay-equity findings.
              </p>
            </li>
          )}
        </ol>

        {/* Footer */}
        <footer className="mt-10 border-t border-[#E0DBD4] pt-4 text-[10px] leading-relaxed text-[#55524A]">
          <p>
            Generated by <strong>JD Suite</strong> · audit-report v1 · lexicon {report.bias.lexiconVersion} ·{' '}
            {new Date(report.generatedAt).toISOString()}
          </p>
          <p className="mt-1">
            EUPTD readiness derives from the 16-criterion ILO / EIGE framework, mapped to the four EU Pay Transparency
            Directive 2023/970 axes: Skills, Effort, Responsibility, Working Conditions. Bias scan: Gaucher 2011
            seed lexicon + Matfield Decoder + EIGE structural checks + Iceland 2024 implicit-bias signals.
          </p>
          <p className="mt-1">
            This report is a working artefact. Final sign-off by qualified counsel for any regulator-facing use.
          </p>
        </footer>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          aside, nav, header { display: none !important; }
          .break-inside-avoid { break-inside: avoid; }
          h2, .font-display { break-after: avoid; }
        }
      `}</style>
    </div>
  );
}

function SectionHeading({ num, title }: { num: string; title: string }) {
  return (
    <h2 className="mt-8 mb-2 break-after-avoid font-display text-xl font-semibold text-[#1A1A1A]">
      <span className="mr-2 text-[#8A7560]">§{num}</span>{title}
    </h2>
  );
}

function ScoreLine({ label, score }: { label: string; score: number }) {
  const col = score >= 75 ? '#059669' : score >= 50 ? '#D97706' : '#DC2626';
  return (
    <div className="rounded border border-[#E0DBD4] bg-white/70 p-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[#55524A]">{label}</span>
        <span className="font-mono text-[12px] font-bold tabular-nums" style={{ color: col }}>{score}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#EDE9E0]">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: col }} />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded border border-[#E0DBD4] bg-white p-3 text-center">
      <div className="font-display text-2xl font-bold tabular-nums" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[#55524A]">{label}</div>
    </div>
  );
}

function CovTile({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="rounded border p-2 text-center"
      style={{ borderColor: ok ? '#059669' : '#DC2626', background: ok ? '#ECFDF5' : '#FEF2F2' }}>
      <div className="text-base font-bold">{ok ? '✓' : '✗'}</div>
      <div className="text-[10px] uppercase tracking-wider text-[#55524A]">{label}</div>
    </div>
  );
}
