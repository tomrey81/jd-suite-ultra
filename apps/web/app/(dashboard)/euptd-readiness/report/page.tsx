'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CHECKLIST, PILLAR_META, rollupByPillar, overallScore, deadline2027Status, type Answer, type Lang, type Pillar } from '@/lib/euptd/checklist';

interface AnswerRecord { answer: Answer; note: string | null; updatedAt: string; }

const I18N = {
  title:           { en: 'EUPTD Readiness Report', pl: 'Raport gotowości EUPTD' },
  prepared:        { en: 'Prepared by',            pl: 'Przygotowano przez' },
  generated:       { en: 'Generated',              pl: 'Wygenerowano' },
  pillarsSummary:  { en: 'Pillars summary',        pl: 'Podsumowanie filarów' },
  detailed:        { en: 'Detailed responses',     pl: 'Szczegółowe odpowiedzi' },
  notes:           { en: 'Notes',                  pl: 'Notatki' },
  recommendations: { en: 'Recommendations',        pl: 'Rekomendacje' },
  noAnswer:        { en: 'No answer recorded',     pl: 'Brak odpowiedzi' },
  legend:          { en: 'Methodology',            pl: 'Metodologia' },
  print:           { en: 'Save as PDF (Print)',    pl: 'Zapisz jako PDF (Drukuj)' },
  back:            { en: '← Back to assessment',   pl: '← Powrót do oceny' },
  source:          {
    en: 'Inspired by Mercer Pay Transparency Readiness 4-pillar model. Mapped to EU Pay Transparency Directive 2023/970.',
    pl: 'Inspirowany 4-filarowym modelem Mercer Pay Transparency Readiness. Powiązany z Dyrektywą UE 2023/970.',
  },
  weightLegend:    {
    en: 'Each item has a weight (●–●●●). Pillar score = weighted average of Yes (100), Partial (50), No (0). N/A excluded.',
    pl: 'Każda pozycja ma wagę (●–●●●). Wynik filaru = średnia ważona z Tak (100), Częściowo (50), Nie (0). N/D wykluczone.',
  },
  noResponses:     {
    en: 'No responses yet — go to the assessment page and answer at least the high-weight items first.',
    pl: 'Brak odpowiedzi — przejść do strony oceny i odpowiedzieć przynajmniej na pozycje o wysokiej wadze.',
  },
};

export default function ReadinessReportPage() {
  const [lang, setLang] = useState<Lang>('en');
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [loading, setLoading] = useState(true);

  const { daysToDirectiveInForce, daysToReporting } = useMemo(deadline2027Status, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/euptd-readiness');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setAnswers(data.answers || {});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const plain: Record<string, Answer> = useMemo(() => {
    const out: Record<string, Answer> = {};
    for (const [k, v] of Object.entries(answers)) out[k] = v.answer;
    return out;
  }, [answers]);

  const rollups = rollupByPillar(plain);
  const overall = overallScore(plain);
  const T = (k: keyof typeof I18N) => I18N[k][lang];

  // Build "Top recommendations" — items answered "no" or "partial", sorted by weight × pillar weakness
  const recs = useMemo(() => {
    const items = CHECKLIST
      .filter((it) => {
        const a = answers[it.id]?.answer;
        return a === 'no' || a === 'partial';
      })
      .map((it) => {
        const p = rollups.find((r) => r.pillar === it.pillar);
        return {
          ...it,
          severity: it.weight * (it.pillar && p && p.score < 50 ? 3 : it.pillar && p && p.score < 75 ? 2 : 1),
          currentAnswer: answers[it.id]?.answer,
        };
      })
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 8);
    return items;
  }, [answers, rollups]);

  if (loading) return <div className="flex h-full items-center justify-center text-[13px] text-text-muted">Loading…</div>;

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] print:bg-white">
      {/* Toolbar — print-hidden */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-default bg-white px-6 py-3 print:hidden">
        <Link href="/euptd-readiness" className="text-[11px] text-brand-gold hover:underline">{T('back')}</Link>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border-default p-0.5">
            {(['en', 'pl'] as Lang[]).map((l) => (
              <button key={l} onClick={() => setLang(l)}
                className={`rounded px-2 py-1 text-[11px] font-medium ${lang === l ? 'bg-text-primary text-white' : 'text-text-muted'}`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button onClick={() => window.print()}
            className="rounded-md bg-brand-gold px-4 py-1.5 text-[11px] font-medium text-white">
            ↓ {T('print')}
          </button>
        </div>
      </div>

      {/* Page body */}
      <div className="mx-auto max-w-[860px] px-8 py-10 text-[#1A1A1A] print:py-6">
        {/* Cover */}
        <div className="border-b border-[#1A1A1A] pb-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A7560]">JD Suite · EUPTD readiness</div>
          <h1 className="mt-1 font-display text-3xl font-semibold leading-tight">
            {T('title')}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-[#55524A]">
            <span><strong>{T('generated')}:</strong> {new Date().toLocaleString()}</span>
            <span><strong>EUPTD in force:</strong> {Math.max(0, daysToDirectiveInForce).toLocaleString()} days</span>
            <span><strong>First reporting:</strong> {Math.max(0, daysToReporting).toLocaleString()} days</span>
          </div>
        </div>

        {/* Overall verdict */}
        <section className="mt-6 rounded-lg border-2 p-5"
          style={{
            background: overall >= 75 ? '#ECFDF5' : overall >= 50 ? '#FFFBEB' : '#FEF2F2',
            borderColor: overall >= 75 ? '#059669' : overall >= 50 ? '#D97706' : '#DC2626',
          }}>
          <div className="flex items-center gap-4">
            <div className="text-3xl leading-none"
              style={{ color: overall >= 75 ? '#059669' : overall >= 50 ? '#D97706' : '#DC2626' }}>
              {overall >= 75 ? '✓' : overall >= 50 ? '⚠' : '✗'}
            </div>
            <div className="flex-1">
              <div className="font-display text-xl font-bold"
                style={{ color: overall >= 75 ? '#059669' : overall >= 50 ? '#D97706' : '#DC2626' }}>
                {lang === 'pl'
                  ? (overall >= 75 ? 'Gotowi do EUPTD' : overall >= 50 ? 'Częściowo gotowi' : 'Nie gotowi')
                  : (overall >= 75 ? 'EUPTD-ready' : overall >= 50 ? 'Partially ready' : 'Not ready')}
              </div>
              <div className="mt-1 text-[12px] text-[#3A3A3A]">
                {lang === 'pl'
                  ? `Średnia z 4 filarów: ${overall}%. Cel: 75%+ przed czerwcem 2026.`
                  : `Mean across 4 pillars: ${overall}%. Target: 75%+ before June 2026.`}
              </div>
            </div>
            <div className="font-display text-3xl font-bold tabular-nums"
              style={{ color: overall >= 75 ? '#059669' : overall >= 50 ? '#D97706' : '#DC2626' }}>
              {overall}%
            </div>
          </div>
        </section>

        {/* Pillar summary */}
        <SectionHeading num="1" title={T('pillarsSummary')} />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 print:grid-cols-2">
          {rollups.map((r) => {
            const meta = PILLAR_META[r.pillar];
            const col = r.score >= 75 ? '#059669' : r.score >= 50 ? '#D97706' : '#DC2626';
            return (
              <div key={r.pillar} className="rounded-md border bg-white p-3 break-inside-avoid"
                style={{ borderLeft: `4px solid ${meta.color}` }}>
                <div className="flex items-center justify-between">
                  <span className="font-display text-[14px] font-semibold">{meta.label[lang]}</span>
                  <span className="font-mono text-[14px] font-bold tabular-nums" style={{ color: col }}>
                    {r.status === 'unanswered' ? '—' : `${r.score}%`}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EDE9E0]">
                  <div className="h-full" style={{ width: `${r.score}%`, background: col }} />
                </div>
                <div className="mt-1 text-[10px] text-[#55524A]">
                  {r.answered}/{r.total} {lang === 'pl' ? 'odpowiedzi' : 'answered'} · {r.yes} {lang === 'pl' ? 'Tak' : 'Yes'} · {r.partial} {lang === 'pl' ? 'Częściowo' : 'Partial'} · {r.no} {lang === 'pl' ? 'Nie' : 'No'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Top recommendations */}
        {recs.length > 0 && (
          <>
            <SectionHeading num="2" title={T('recommendations')} />
            <ol className="mt-2 space-y-2 text-[12px] leading-relaxed">
              {recs.map((rec, i) => {
                const meta = PILLAR_META[rec.pillar];
                return (
                  <li key={rec.id} className="rounded border-l-4 bg-white p-3 pl-4 break-inside-avoid"
                    style={{ borderColor: meta.color }}>
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-display text-[13px] font-semibold">
                        {i + 1}. {rec.question[lang]}
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-[#55524A]">
                        {meta.label[lang]} · {rec.currentAnswer === 'no' ? (lang === 'pl' ? 'Brak' : 'No') : (lang === 'pl' ? 'Częściowo' : 'Partial')}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-[#55524A]">→ {rec.hint[lang]}</div>
                    {rec.ref && <div className="mt-0.5 text-[9px] uppercase text-[#8A7560]">{rec.ref}</div>}
                    {answers[rec.id]?.note && (
                      <div className="mt-1 text-[10px] italic text-[#3A3A3A]">
                        <strong>{T('notes')}:</strong> {answers[rec.id].note}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}

        {/* Detailed responses */}
        <SectionHeading num="3" title={T('detailed')} />
        {Object.keys(answers).length === 0 ? (
          <div className="mt-2 rounded border border-warning bg-warning-bg p-3 text-[11px] text-warning">
            {T('noResponses')}
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            {(Object.keys(PILLAR_META) as Pillar[]).map((pillar) => {
              const meta = PILLAR_META[pillar];
              const items = CHECKLIST.filter((i) => i.pillar === pillar);
              return (
                <div key={pillar} className="break-inside-avoid">
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: meta.color }}>
                    {meta.label[lang]}
                  </div>
                  <table className="w-full border-collapse text-[10.5px]">
                    <thead>
                      <tr className="border-b-2 border-[#1A1A1A]">
                        <th className="w-12 py-1 text-left">ID</th>
                        <th className="py-1 text-left">{lang === 'pl' ? 'Pytanie' : 'Question'}</th>
                        <th className="w-16 py-1 text-center">{lang === 'pl' ? 'Waga' : 'Weight'}</th>
                        <th className="w-20 py-1 text-center">{lang === 'pl' ? 'Odpowiedź' : 'Answer'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => {
                        const a = answers[it.id];
                        const ansLabel = a
                          ? (a.answer === 'yes' ? (lang === 'pl' ? 'Tak' : 'Yes')
                            : a.answer === 'partial' ? (lang === 'pl' ? 'Częściowo' : 'Partial')
                            : a.answer === 'no' ? (lang === 'pl' ? 'Nie' : 'No')
                            : 'N/A')
                          : '—';
                        const ansCol = a
                          ? (a.answer === 'yes' ? '#059669' : a.answer === 'partial' ? '#D97706' : a.answer === 'no' ? '#DC2626' : '#8A7560')
                          : '#8A7560';
                        return (
                          <tr key={it.id} className="border-b border-[#E0DBD4] align-top">
                            <td className="py-1 font-mono text-[9px] text-[#8A7560]">{it.id}</td>
                            <td className="py-1 pr-2">
                              <div>{it.question[lang]}</div>
                              {a?.note && <div className="mt-0.5 text-[9px] italic text-[#55524A]">↳ {a.note}</div>}
                            </td>
                            <td className="py-1 text-center text-[9px]">{Array(it.weight).fill('●').join('')}</td>
                            <td className="py-1 text-center font-bold" style={{ color: ansCol }}>{ansLabel}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {/* Methodology footer */}
        <SectionHeading num="4" title={T('legend')} />
        <p className="mt-2 text-[11px] leading-relaxed text-[#55524A]">{T('source')}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#55524A]">{T('weightLegend')}</p>

        <footer className="mt-10 border-t border-[#E0DBD4] pt-4 text-[10px] leading-relaxed text-[#55524A]">
          <p>
            Generated by <strong>JD Suite</strong> · EUPTD Readiness v1 · {new Date().toISOString()}
          </p>
          <p className="mt-1">
            {lang === 'pl'
              ? 'Niniejszy raport jest narzędziem roboczym. Ostateczne potwierdzenie zgodności z EUPTD wymaga konsultacji prawnej.'
              : 'This report is a working artefact. Final EUPTD compliance sign-off requires qualified legal counsel.'}
          </p>
        </footer>
      </div>

      <style jsx global>{`
        @media print {
          aside, nav { display: none !important; }
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
