'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CHECKLIST,
  PILLAR_META,
  rollupByPillar,
  overallScore,
  deadline2027Status,
  BENCHMARKS,
  isStale,
  ageInDays,
  STALENESS_DAYS,
  type Answer,
  type Lang,
  type Pillar,
} from '@/lib/euptd/checklist';

interface AnswerRecord {
  answer: Answer;
  note: string | null;
  updatedAt: string;
  assignedToId: string | null;
}

interface Member { id: string; name: string | null; email: string; }

const STATUS_COLOR: Record<string, { fg: string; bg: string; bar: string; label: { en: string; pl: string } }> = {
  strong:      { fg: 'text-success', bg: 'bg-success-bg', bar: '#2DA44E', label: { en: 'Strong',     pl: 'Mocne' } },
  partial:     { fg: 'text-warning', bg: 'bg-warning-bg', bar: '#D97706', label: { en: 'Partial',    pl: 'Częściowe' } },
  weak:        { fg: 'text-danger',  bg: 'bg-danger-bg',  bar: '#DC2626', label: { en: 'Weak',       pl: 'Słabe' } },
  unanswered:  { fg: 'text-text-muted', bg: 'bg-surface-page', bar: '#8A7560', label: { en: 'Unanswered', pl: 'Nieuzupełnione' } },
};

const ANSWER_LABEL: Record<Answer, { en: string; pl: string }> = {
  yes:     { en: 'Yes',     pl: 'Tak' },
  partial: { en: 'Partial', pl: 'Częściowo' },
  no:      { en: 'No',      pl: 'Nie' },
  na:      { en: 'N/A',     pl: 'N/D' },
};

const I18N = {
  title:        { en: 'EUPTD Pay Transparency Readiness', pl: 'Gotowość na EUPTD — przejrzystość wynagrodzeń' },
  subtitle:     {
    en: 'Self-assessment across the four Mercer pillars. Mapped to EU Pay Transparency Directive 2023/970 obligations.',
    pl: 'Samoocena w czterech filarach Mercer. Powiązana z obowiązkami Dyrektywy 2023/970 o przejrzystości wynagrodzeń.',
  },
  overall:      { en: 'Overall readiness', pl: 'Ogólna gotowość' },
  inForceIn:    { en: 'days to directive in force', pl: 'dni do wejścia dyrektywy' },
  reportingIn:  { en: 'days to first reporting', pl: 'dni do pierwszego raportowania' },
  exportPdf:    { en: 'PDF',  pl: 'PDF' },
  exportXlsx:   { en: 'Excel', pl: 'Excel' },
  exportCsv:    { en: 'CSV',  pl: 'CSV' },
  saved:        { en: 'Saved',                 pl: 'Zapisano' },
  saving:       { en: 'Saving…',               pl: 'Zapisywanie…' },
  noteLabel:    { en: 'Notes (optional)',      pl: 'Notatki (opcjonalne)' },
  notePh:       { en: 'Add evidence, links, owner…', pl: 'Dodaj dowody, linki, właściciela…' },
  jumpToTool:   { en: 'Open →',                pl: 'Otwórz →' },
  bestRow:      {
    en: "Strengthen the weakest pillar first — that's where regulators look.",
    pl: 'Wzmocnić najsłabszy filar w pierwszej kolejności — tam patrzą regulatorzy.',
  },
  noAnswers:    {
    en: 'Pick Yes / Partial / No / N/A for each item below. Progress is auto-saved per row.',
    pl: 'Wybrać Tak / Częściowo / Nie / N/D dla każdej pozycji poniżej. Postęp zapisuje się automatycznie po wierszu.',
  },
  benchmarksTitle: { en: 'Industry benchmarks', pl: 'Wskaźniki rynkowe' },
  benchmarksSub:   {
    en: 'How peer organisations are doing on pay transparency. Compare against your readiness.',
    pl: 'Jak inne organizacje radzą sobie z przejrzystością wynagrodzeń. Porównać z gotowością Państwa.',
  },
  assignedTo:      { en: 'Assigned to', pl: 'Przypisany do' },
  unassigned:      { en: 'Unassigned',  pl: 'Nieprzypisany' },
  staleWarning:    { en: 'Items stale (≥90 days)', pl: 'Pozycje przeterminowane (≥90 dni)' },
  reviewNeeded:    { en: 'Review needed', pl: 'Wymaga przeglądu' },
};

export default function EUPTDReadinessPage() {
  const [lang, setLang] = useState<Lang>('en');
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [showBenchmarks, setShowBenchmarks] = useState(true);

  const { daysToDirectiveInForce, daysToReporting } = useMemo(deadline2027Status, []);
  const T = (k: keyof typeof I18N) => I18N[k][lang];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/euptd-readiness');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setAnswers(data.answers || {});
        setMembers(data.members || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const plainAnswers: Record<string, Answer> = useMemo(() => {
    const out: Record<string, Answer> = {};
    for (const [k, v] of Object.entries(answers)) out[k] = v.answer;
    return out;
  }, [answers]);

  const rollups = useMemo(() => rollupByPillar(plainAnswers), [plainAnswers]);
  const overall = useMemo(() => overallScore(plainAnswers), [plainAnswers]);

  const staleCount = useMemo(() => {
    return Object.values(answers).filter((a) => isStale(a.updatedAt)).length;
  }, [answers]);

  async function setAnswer(itemId: string, answer: Answer) {
    setSavingItem(itemId);
    setAnswers((prev) => ({
      ...prev,
      [itemId]: {
        answer,
        note: prev[itemId]?.note ?? null,
        updatedAt: new Date().toISOString(),
        assignedToId: prev[itemId]?.assignedToId ?? null,
      },
    }));
    try {
      await fetch('/api/euptd-readiness', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, answer }),
      });
    } finally {
      setSavingItem(null);
    }
  }

  async function setNote(itemId: string, note: string) {
    const current = answers[itemId];
    if (!current) return;
    setAnswers((prev) => ({ ...prev, [itemId]: { ...current, note } }));
    setSavingItem(itemId);
    try {
      await fetch('/api/euptd-readiness', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, answer: current.answer, note }),
      });
    } finally {
      setSavingItem(null);
    }
  }

  async function setAssignee(itemId: string, assignedToId: string | null) {
    const current = answers[itemId];
    setSavingItem(itemId);
    setAnswers((prev) => ({
      ...prev,
      [itemId]: {
        answer: current?.answer ?? 'na',
        note: current?.note ?? null,
        updatedAt: current?.updatedAt ?? new Date().toISOString(),
        assignedToId,
      },
    }));
    try {
      await fetch('/api/euptd-readiness', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, assignedToId }),
      });
    } finally {
      setSavingItem(null);
    }
  }

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const exportUrl = (format: 'csv' | 'xlsx') =>
    `/api/euptd-readiness/export?format=${format}&lang=${lang}`;

  return (
    <div className="flex h-full flex-col bg-[#FAF7F2]">
      {/* Header */}
      <div className="border-b border-border-default bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A7560]">EUPTD · Mercer 4-pillar model</div>
            <h1 className="font-display text-2xl font-bold text-text-primary">{T('title')}</h1>
            <p className="mt-1 max-w-[700px] text-[13px] text-text-secondary">{T('subtitle')}</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="flex rounded-md border border-border-default p-0.5">
              {(['en', 'pl'] as Lang[]).map((l) => (
                <button key={l} onClick={() => setLang(l)}
                  className={`rounded px-2 py-1 text-[11px] font-medium ${lang === l ? 'bg-text-primary text-white' : 'text-text-muted'}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            {/* Export menu */}
            <div className="flex gap-1 rounded-md border border-border-default p-0.5">
              <a href={exportUrl('xlsx')} target="_blank" rel="noopener noreferrer"
                className="rounded px-2.5 py-1 text-[11px] font-medium text-text-primary hover:bg-surface-page">
                ↓ {T('exportXlsx')}
              </a>
              <a href={exportUrl('csv')} target="_blank" rel="noopener noreferrer"
                className="rounded px-2.5 py-1 text-[11px] font-medium text-text-primary hover:bg-surface-page">
                ↓ {T('exportCsv')}
              </a>
              <Link href="/euptd-readiness/report"
                className="rounded bg-brand-gold px-2.5 py-1 text-[11px] font-medium text-white">
                ↓ {T('exportPdf')}
              </Link>
            </div>
          </div>
        </div>

        {/* Headline strip */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPI label={T('overall')} value={`${overall}%`} accent={overall >= 75 ? '#2DA44E' : overall >= 50 ? '#D97706' : '#DC2626'} />
          {rollups.map((r) => {
            const meta = PILLAR_META[r.pillar];
            const status = STATUS_COLOR[r.status];
            return (
              <PillarKPI key={r.pillar}
                label={meta.label[lang]}
                value={r.status === 'unanswered' ? '—' : `${r.score}%`}
                color={meta.color}
                statusLabel={status.label[lang]}
                statusBg={status.bg}
                statusFg={status.fg}
                progress={r.score}
                progressBar={status.bar}
              />
            );
          })}
        </div>

        {/* Deadline strip */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-text-muted">
          <span>📅 <strong>{Math.max(0, daysToDirectiveInForce).toLocaleString()}</strong> {T('inForceIn')}</span>
          <span>📅 <strong>{Math.max(0, daysToReporting).toLocaleString()}</strong> {T('reportingIn')}</span>
          {staleCount > 0 && (
            <span className="rounded bg-warning-bg px-2 py-0.5 text-warning">
              ⏳ {staleCount} {T('staleWarning')}
            </span>
          )}
          <span>Mercer Global Talent Trends 2024-2025</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1100px] p-6">
          {loading ? (
            <div className="text-center text-[12px] text-text-muted">Loading…</div>
          ) : (
            <>
              <div className="mb-4 rounded-md bg-info-bg p-3 text-[11px] text-info">
                {T('noAnswers')} · {T('bestRow')}
              </div>

              {/* ── Benchmarks chart ───────────────────────────────────────── */}
              <section className="mb-6 rounded-lg border border-border-default bg-white">
                <button onClick={() => setShowBenchmarks((v) => !v)}
                  className="flex w-full items-center justify-between border-b border-border-default px-4 py-2.5 text-left">
                  <div>
                    <div className="font-display text-[14px] font-semibold text-text-primary">
                      {T('benchmarksTitle')}
                    </div>
                    <div className="text-[10px] text-text-muted">{T('benchmarksSub')}</div>
                  </div>
                  <span className="text-text-muted">{showBenchmarks ? '▾' : '▸'}</span>
                </button>

                {showBenchmarks && (
                  <div className="grid gap-4 p-4 sm:grid-cols-2">
                    {BENCHMARKS.map((b) => (
                      <div key={b.id} className="rounded-md border border-border-default bg-surface-page p-3">
                        <div className="mb-2 text-[11px] font-semibold leading-tight text-text-primary">
                          {b.label[lang]}
                        </div>
                        <ul className="space-y-1.5">
                          {b.values.map((v) => (
                            <li key={v.region} className="flex items-center gap-2">
                              <span className="w-24 shrink-0 truncate text-[10px] text-text-muted">{v.region}</span>
                              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white">
                                <div className="h-full rounded-full bg-[#8A7560]"
                                  style={{ width: `${v.pct}%` }} />
                              </div>
                              <span className="w-9 text-right font-mono text-[11px] font-bold tabular-nums text-text-primary">
                                {v.pct}%
                              </span>
                            </li>
                          ))}
                          {/* Comparison line: your overall score */}
                          <li className="flex items-center gap-2 border-t border-border-default pt-1.5">
                            <span className="w-24 shrink-0 truncate text-[10px] font-bold text-brand-gold">
                              {lang === 'pl' ? 'Państwa wynik' : 'Your score'}
                            </span>
                            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white">
                              <div className="h-full rounded-full bg-brand-gold"
                                style={{ width: `${overall}%` }} />
                            </div>
                            <span className="w-9 text-right font-mono text-[11px] font-bold tabular-nums text-brand-gold">
                              {overall}%
                            </span>
                          </li>
                        </ul>
                        <div className="mt-2 text-[9px] italic text-text-muted">{b.source[lang]}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Pillars ───────────────────────────────────────────────── */}
              <div className="space-y-6">
                {(Object.keys(PILLAR_META) as Pillar[]).map((pillar) => {
                  const meta = PILLAR_META[pillar];
                  const items = CHECKLIST.filter((i) => i.pillar === pillar);
                  const r = rollups.find((x) => x.pillar === pillar)!;
                  const status = STATUS_COLOR[r.status];
                  return (
                    <section key={pillar} className="rounded-lg border border-border-default bg-white">
                      <div className="flex items-center justify-between border-b border-border-default px-5 py-3"
                        style={{ borderLeft: `4px solid ${meta.color}` }}>
                        <div className="flex items-center gap-3">
                          <span className="text-xl" style={{ color: meta.color }}>{meta.icon}</span>
                          <div>
                            <div className="font-display text-[15px] font-bold text-text-primary">{meta.label[lang]}</div>
                            <div className="text-[10px] text-text-muted">
                              {r.answered}/{r.total} {lang === 'pl' ? 'odpowiedzi' : 'answered'} · {r.yes} {ANSWER_LABEL.yes[lang]} · {r.partial} {ANSWER_LABEL.partial[lang]} · {r.no} {ANSWER_LABEL.no[lang]}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${status.bg} ${status.fg}`}>
                            {status.label[lang]}
                          </span>
                          <span className="font-mono text-[16px] font-bold tabular-nums" style={{ color: status.bar }}>
                            {r.status === 'unanswered' ? '—' : `${r.score}%`}
                          </span>
                        </div>
                      </div>

                      <ul className="divide-y divide-border-default">
                        {items.map((it) => {
                          const a = answers[it.id];
                          const isOpen = openItem === it.id;
                          const stale = a && isStale(a.updatedAt);
                          const age = a ? ageInDays(a.updatedAt) : null;
                          const assignedMember = a?.assignedToId ? memberById.get(a.assignedToId) : null;
                          return (
                            <li key={it.id} className={stale ? 'border-l-2 border-warning bg-warning-bg/30' : undefined}>
                              <div className="flex items-start gap-3 px-5 py-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 text-[10px] text-text-muted">
                                    <span className="font-mono">{it.id}</span>
                                    {it.ref && <span className="rounded bg-surface-page px-1 py-0">{it.ref}</span>}
                                    <span title={`weight ${it.weight}`}>{Array(it.weight).fill('●').join('')}</span>
                                    {stale && (
                                      <span className="rounded border border-warning bg-warning-bg px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-warning">
                                        ⏳ {age}d · {T('reviewNeeded')}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 text-[13px] font-semibold leading-snug text-text-primary">
                                    {it.question[lang]}
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-text-muted">{it.hint[lang]}</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-3">
                                    {it.tool && (
                                      <Link href={it.tool.href} className="text-[11px] text-brand-gold hover:underline">
                                        → {it.tool.label[lang]}
                                      </Link>
                                    )}
                                    {/* Assignee picker */}
                                    <label className="flex items-center gap-1 text-[10px] text-text-muted">
                                      <span>{T('assignedTo')}:</span>
                                      <select
                                        value={a?.assignedToId || ''}
                                        onChange={(e) => setAssignee(it.id, e.target.value || null)}
                                        className="rounded border border-border-default bg-white px-1.5 py-0.5 text-[10px]">
                                        <option value="">— {T('unassigned')} —</option>
                                        {members.map((m) => (
                                          <option key={m.id} value={m.id}>
                                            {m.name || m.email}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    {assignedMember && (
                                      <span className="rounded-full bg-surface-page px-1.5 py-0.5 text-[9px] font-medium text-text-primary">
                                        ▸ {assignedMember.name || assignedMember.email}
                                      </span>
                                    )}
                                  </div>
                                  {(isOpen || a?.note) && (
                                    <div className="mt-2">
                                      <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                        {T('noteLabel')}
                                      </div>
                                      <textarea value={a?.note || ''}
                                        onChange={(e) => setNote(it.id, e.target.value)}
                                        placeholder={T('notePh')}
                                        rows={2}
                                        className="w-full rounded border border-border-default bg-surface-page px-2 py-1.5 text-[11px] outline-none focus:border-brand-gold" />
                                    </div>
                                  )}
                                </div>

                                <div className="flex shrink-0 flex-col items-end gap-1.5">
                                  <div className="flex gap-1">
                                    {(['yes', 'partial', 'no', 'na'] as Answer[]).map((opt) => {
                                      const selected = a?.answer === opt;
                                      const colour = opt === 'yes' ? '#2DA44E' : opt === 'partial' ? '#D97706' : opt === 'no' ? '#DC2626' : '#8A7560';
                                      return (
                                        <button key={opt} onClick={() => setAnswer(it.id, opt)}
                                          className={`rounded border px-2 py-1 text-[10px] font-semibold transition-colors ${selected ? 'text-white' : 'text-text-secondary hover:border-brand-gold'}`}
                                          style={{
                                            background: selected ? colour : 'white',
                                            borderColor: selected ? colour : '#E0DBD4',
                                          }}>
                                          {ANSWER_LABEL[opt][lang]}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="flex items-center gap-2 text-[9px] text-text-muted">
                                    {savingItem === it.id ? (
                                      <span>{T('saving')}</span>
                                    ) : a ? (
                                      <span>✓ {T('saved')} {new Date(a.updatedAt).toLocaleTimeString()}</span>
                                    ) : (
                                      <span>—</span>
                                    )}
                                    <button onClick={() => setOpenItem(isOpen ? null : it.id)}
                                      className="text-brand-gold hover:underline">
                                      {isOpen ? '▴' : '▾ ' + T('noteLabel')}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>

              <div className="mt-6 rounded-md bg-info-bg p-3 text-[11px] leading-relaxed text-info">
                <strong>{lang === 'pl' ? 'Cykl przeglądu' : 'Review cadence'}:</strong>{' '}
                {lang === 'pl'
                  ? <>Pozycje nieaktualizowane od {STALENESS_DAYS} dni są oznaczone do przeglądu. Eksport XLSX/CSV zawiera kolumnę &quot;ostatnia zmiana&quot; — przydatne do raportowania kwartalnego.</>
                  : <>Items not touched in {STALENESS_DAYS}+ days are flagged for review. The XLSX/CSV export includes a &quot;last updated&quot; column — useful for quarterly reporting.</>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-border-default bg-white p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function PillarKPI({ label, value, color, statusLabel, statusBg, statusFg, progress, progressBar }: {
  label: string; value: string; color: string;
  statusLabel: string; statusBg: string; statusFg: string;
  progress: number; progressBar: string;
}) {
  return (
    <div className="rounded-lg border border-border-default bg-white p-3"
      style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-semibold text-text-primary" title={label}>{label}</span>
        <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusBg} ${statusFg}`}>
          {statusLabel}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="font-mono text-xl font-bold tabular-nums" style={{ color: progressBar }}>{value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EDE9E0]">
        <div className="h-full" style={{ width: `${progress}%`, background: progressBar }} />
      </div>
    </div>
  );
}
