import { db } from '@jd-suite/db';
import { notFound } from 'next/navigation';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/lib/default-template';
import type { TemplateSection } from '@jd-suite/types';

export const dynamic = 'force-dynamic';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d?: Date | string | null) {
  return new Date(d ?? Date.now()).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// Map 16-criteria to Axiomera's 4 EUPTD dimensions
const DIM_MAP: Record<string, string[]> = {
  Responsibility: [
    'decision', 'authority', 'financial', 'accountability', 'leadership',
    'supervision', 'impact', 'budget', 'people',
  ],
  'Skills & Knowledge': [
    'education', 'experience', 'qualification', 'knowledge', 'language',
    'skill', 'system', 'proficiency', 'technical',
  ],
  'Effort & Complexity': [
    'complexity', 'planning', 'problem', 'cognitive', 'emotional',
    'communication', 'analytical', 'creative', 'effort',
  ],
  'Working Conditions': [
    'physical', 'environment', 'schedule', 'travel', 'working condition',
    'hazard', 'stress', 'ergonomic',
  ],
};

const DIM_MAX: Record<string, number> = {
  Responsibility: 362,
  'Skills & Knowledge': 127,
  'Effort & Complexity': 118,
  'Working Conditions': 40,
};

const DIM_COLORS: Record<string, string> = {
  Responsibility: '#8A7560',
  'Skills & Knowledge': '#A08C78',
  'Effort & Complexity': '#B8A492',
  'Working Conditions': '#C8B9AC',
};

interface CriterionResult {
  criterion: string;
  category?: string;
  status: 'sufficient' | 'partial' | 'insufficient';
  score?: number;
  points?: number;
  note?: string;
  feedback?: string;
}

function mapDimensions(criteria: CriterionResult[]) {
  return Object.entries(DIM_MAP).map(([dim, keywords]) => {
    const matches = criteria.filter((c) =>
      keywords.some(
        (k) =>
          c.criterion?.toLowerCase().includes(k) ||
          c.category?.toLowerCase().includes(k),
      ),
    );
    const max = DIM_MAX[dim];
    let points = 0;
    if (matches.length > 0) {
      const suf = matches.filter((c) => c.status === 'sufficient').length / matches.length;
      const par = matches.filter((c) => c.status === 'partial').length / matches.length;
      points = Math.round((suf + par * 0.5) * max * 0.88);
    }
    return { dim, points, max, pct: Math.min(100, max > 0 ? Math.round((points / max) * 100) : 0) };
  });
}

// ── CSS string (avoids Tailwind dependency in print context) ─────────────────

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --gold: #8A7560; --cream: #F6F4EF; --black: #1A1A1A; --mid: #888; --border: #DDD7CE; }
  html { background: var(--cream); }
  body {
    background: var(--cream);
    color: var(--black);
    font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
    font-size: 13px;
    line-height: 1.65;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @media print {
    @page { size: A4; margin: 16mm 20mm; }
    .no-print { display: none !important; }
    body { background: #fff !important; }
    .doc { padding: 0 !important; max-width: 100% !important; }
    .page-break { page-break-before: always; }
  }
  .doc { max-width: 880px; margin: 0 auto; padding: 36px 44px 60px; min-height: 100vh; }
  /* Header */
  .dh { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
  .brand { font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--black); }
  .ddate { font-size: 11px; color: var(--mid); }
  hr.thick { border: none; border-top: 1.5px solid var(--black); margin: 14px 0 28px; }
  hr.light { border: none; border-top: 1px solid var(--border); margin: 22px 0; }
  /* Title */
  .job-title { font-family: 'Playfair Display', Georgia, serif; font-size: 33px; font-weight: 700; font-style: italic; line-height: 1.15; margin-bottom: 6px; }
  .esco { font-size: 11px; color: var(--mid); margin-bottom: 20px; }
  .esco em { color: var(--gold); font-style: normal; }
  /* Cards */
  .cards { display: flex; gap: 12px; margin-bottom: 20px; }
  .card { flex: 1; background: #fff; border: 1px solid var(--border); border-radius: 6px; padding: 11px 16px; display: flex; align-items: center; gap: 14px; }
  .card-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.13em; color: #999; flex: 1; }
  .card-val { font-size: 21px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .badge { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 2px 7px; border-radius: 20px; border: 1px solid; white-space: nowrap; }
  .badge-green { color: #2A6B48; border-color: #2A6B48; background: #EEF8F3; }
  .badge-amber { color: #8B5E1A; border-color: #8B5E1A; background: #FEF5E9; }
  .badge-red   { color: #9E2B1D; border-color: #9E2B1D; background: #FEF0EF; }
  .badge-gray  { color: #666; border-color: #aaa; background: #F5F5F5; }
  /* Meta pills */
  .metas { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
  .meta { font-size: 10px; color: #555; background: #fff; border: 1px solid var(--border); border-radius: 4px; padding: 3px 9px; }
  .meta strong { color: var(--black); }
  /* Sections */
  .sec { margin-bottom: 22px; }
  .sec-title { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: var(--gold); border-bottom: 1px solid var(--border); padding-bottom: 5px; margin-bottom: 11px; }
  .field { margin-bottom: 10px; }
  .f-label { font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #777; margin-bottom: 2px; }
  .f-val { font-size: 13px; color: var(--black); white-space: pre-wrap; word-break: break-word; line-height: 1.65; }
  /* Eval */
  .eval-hdr { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #999; margin-bottom: 14px; }
  .crit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 20px; }
  .crit { background: #fff; border: 1px solid var(--border); border-radius: 4px; padding: 6px 9px; }
  .crit-name { font-size: 10px; color: #555; margin-bottom: 2px; line-height: 1.3; }
  .crit-note { font-size: 9px; color: #888; margin-top: 2px; line-height: 1.3; }
  .cs-sufficient { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2A6B48; }
  .cs-partial     { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #8B5E1A; }
  .cs-insufficient{ font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #9E2B1D; }
  /* Dimension table */
  .dim-section-hdr { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: #999; margin: 16px 0 10px; }
  table.dims { width: 100%; border-collapse: collapse; }
  table.dims thead th { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #aaa; padding: 3px 0 6px; text-align: left; }
  table.dims thead th.r { text-align: right; }
  table.dims tbody td { padding: 10px 0 4px; vertical-align: middle; }
  .d-name { font-size: 13px; font-weight: 600; }
  .bar-track { height: 5px; background: #EAE5DF; border-radius: 3px; width: 160px; overflow: hidden; }
  .bar-fill  { height: 100%; border-radius: 3px; }
  .d-max    { font-size: 11px; color: #aaa; text-align: right; padding-right: 16px; font-variant-numeric: tabular-nums; }
  .d-pts    { font-size: 16px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
  .d-note   { font-size: 10px; font-style: italic; color: #888; padding: 2px 0 9px; border-bottom: 1px solid #F0EAE3; line-height: 1.5; }
  /* Totals */
  .totals { display: flex; align-items: center; justify-content: flex-end; gap: 40px; padding-top: 14px; border-top: 1.5px solid var(--black); margin-top: 4px; }
  .tot { text-align: right; }
  .tot-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #aaa; }
  .tot-val { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
  /* Score bars */
  .score-row { display: flex; gap: 12px; margin-top: 18px; }
  .score-box { flex: 1; border-radius: 4px; padding: 8px 12px; }
  .score-box-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
  .score-box-n { font-size: 22px; font-weight: 700; }
  /* Footnotes */
  .fn { margin-top: 36px; padding-top: 14px; border-top: 1px solid var(--border); }
  .fn p { font-size: 9.5px; color: #bbb; margin-bottom: 3px; line-height: 1.4; }
  /* Print button */
  .print-btn {
    position: fixed; bottom: 28px; right: 28px;
    display: flex; align-items: center; gap: 8px;
    background: var(--black); color: var(--cream);
    border: none; border-radius: 10px; padding: 12px 22px;
    font-size: 13px; font-weight: 600; cursor: pointer;
    font-family: inherit; box-shadow: 0 4px 20px rgba(0,0,0,.35);
    transition: opacity .15s; z-index: 9999;
  }
  .print-btn:hover { opacity: .82; }
  .png-btn {
    position: fixed; bottom: 28px; right: 180px;
    display: flex; align-items: center; gap: 8px;
    background: var(--gold); color: #fff;
    border: none; border-radius: 10px; padding: 12px 22px;
    font-size: 13px; font-weight: 600; cursor: pointer;
    font-family: inherit; box-shadow: 0 4px 20px rgba(0,0,0,.25);
    transition: opacity .15s; z-index: 9999;
  }
  .png-btn:hover { opacity: .82; }
`;

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string; format?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const auto = sp?.auto === '1';
  const format = sp?.format ?? 'pdf'; // pdf | png | jpg

  const jd = await db.jobDescription.findFirst({
    where: { id },
    include: {
      template: true,
      evalResults: { orderBy: { createdAt: 'desc' }, take: 1 },
      owner: { select: { name: true, email: true } },
    },
  });

  if (!jd) notFound();

  const sections: TemplateSection[] =
    (jd.template?.sections as TemplateSection[]) || DEFAULT_TEMPLATE_SECTIONS;
  const data = (jd.data as Record<string, string>) || {};
  const evalResult = jd.evalResults[0];
  const criteria: CriterionResult[] = evalResult
    ? ((evalResult.criteria as unknown as CriterionResult[]) ?? [])
    : [];

  const dims = criteria.length > 0 ? mapDimensions(criteria) : [];
  const gradePoints = dims.slice(0, 3).reduce((s, d) => s + d.points, 0);
  const totalPoints = dims.reduce((s, d) => s + d.points, 0);

  const suf = criteria.filter((c) => c.status === 'sufficient').length;
  const par = criteria.filter((c) => c.status === 'partial').length;
  const gap = criteria.filter((c) => c.status === 'insufficient').length;
  const dqs = criteria.length > 0 ? Math.round(((suf + par * 0.5) / criteria.length) * 100) : null;

  const jobTitle = data.jobTitle || jd.jobTitle || 'Untitled Role';
  const orgUnit = data.orgUnit || jd.orgUnit || '';
  const jobFamily = data.jobFamily || '';

  const statusBadge =
    jd.status === 'APPROVED' ? 'badge-green'
    : jd.status === 'DRAFT' ? 'badge-amber'
    : jd.status === 'ARCHIVED' ? 'badge-gray'
    : 'badge-amber';

  const dqsBadge = dqs === null ? null : dqs >= 75 ? 'badge-green' : dqs >= 50 ? 'badge-amber' : 'badge-red';
  const dqsLabel = dqs === null ? null : dqs >= 75 ? 'Good' : dqs >= 50 ? 'Needs work' : 'Insufficient';

  const autoScript = auto
    ? `window.addEventListener('load', () => { setTimeout(() => window.print(), 600); });`
    : '';

  const pngScript = `
    async function exportPng(fmt) {
      const root = document.getElementById('jd-doc');
      try {
        const { toPng, toJpeg } = await import('https://esm.sh/html-to-image@1.11.11');
        const fn = fmt === 'jpg' ? toJpeg : toPng;
        const opts = { backgroundColor: '#F6F4EF', quality: fmt === 'jpg' ? 0.92 : 1, pixelRatio: 2 };
        const dataUrl = await fn(root, opts);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = '${`JD_${(jobTitle).replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}`}.' + fmt;
        a.click();
      } catch(e) { alert('Image export failed: ' + e.message); }
    }
  `;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{jobTitle} — Quadrance JD Suite</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,700&family=DM+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        {autoScript && (
          <script dangerouslySetInnerHTML={{ __html: autoScript }} />
        )}
      </head>
      <body>
        <div className="doc" id="jd-doc">

          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="dh">
            <div className="brand">Quadrance</div>
            <div className="ddate">{fmtDate(jd.updatedAt)}</div>
          </div>
          <hr className="thick" />

          {/* ── Job title ──────────────────────────────────────────── */}
          <div className="job-title">{jobTitle}</div>
          <div className="esco">
            {[jobFamily, orgUnit].filter(Boolean).join(' · ') || 'Job Description'}
            {evalResult && <> · <em>EU Pay Transparency Directive 2023/970</em></>}
          </div>

          {/* ── Quality cards ──────────────────────────────────────── */}
          <div className="cards">
            {dqs !== null && dqsBadge && dqsLabel && (
              <div className="card">
                <div className="card-label">Pay Equity Quality</div>
                <div className="card-val">{dqs}%</div>
                <div className={`badge ${dqsBadge}`}>{dqsLabel}</div>
              </div>
            )}
            <div className="card">
              <div className="card-label">Document Status</div>
              <div style={{ fontSize: 11, color: '#888', flex: 1 }}>
                {sections.filter((s) => s.fields.some((f) => data[f.id]?.trim())).length}/
                {sections.length} sections complete
              </div>
              <div className={`badge ${statusBadge}`}>{jd.status.replace('_', ' ')}</div>
            </div>
          </div>

          {/* ── Meta pills ─────────────────────────────────────────── */}
          <div className="metas">
            {orgUnit && <div className="meta"><strong>Unit:</strong> {orgUnit}</div>}
            {data.jobCode && <div className="meta"><strong>Code:</strong> {data.jobCode}</div>}
            {data.positionType && <div className="meta"><strong>Type:</strong> {data.positionType}</div>}
            {jd.owner?.name && <div className="meta"><strong>Owner:</strong> {jd.owner.name}</div>}
            {data.approvedBy && <div className="meta"><strong>Approved by:</strong> {data.approvedBy}</div>}
            {data.approvalDate && <div className="meta"><strong>Date:</strong> {data.approvalDate}</div>}
          </div>

          <hr className="light" />

          {/* ── JD Content sections ────────────────────────────────── */}
          {sections.map((sec) => {
            const filled = sec.fields.filter((f) => data[f.id]?.trim());
            if (!filled.length) return null;
            return (
              <div key={sec.id} className="sec">
                <div className="sec-title">{sec.title}</div>
                {filled.map((f) => (
                  <div key={f.id} className="field">
                    <div className="f-label">{f.label}</div>
                    <div className="f-val">{data[f.id]}</div>
                  </div>
                ))}
              </div>
            );
          })}

          {/* ── Pay Equity Evaluation ──────────────────────────────── */}
          {evalResult && criteria.length > 0 && (
            <>
              <hr className="thick" />
              <div className="eval-hdr">
                Pay Equity Evaluation — ILO 16-Criteria Framework
              </div>

              {/* 16-criteria grid */}
              <div className="crit-grid">
                {criteria.map((c, i) => (
                  <div key={i} className="crit">
                    <div className="crit-name">{c.criterion}</div>
                    <div className={`cs-${c.status}`}>{c.status}</div>
                    {c.feedback && <div className="crit-note">{c.feedback.slice(0, 80)}{c.feedback.length > 80 ? '…' : ''}</div>}
                  </div>
                ))}
              </div>

              {/* Score summary */}
              <div className="score-row">
                <div className="score-box" style={{ background: '#EEF8F3', border: '1px solid #B8DFC9' }}>
                  <div className="score-box-lbl" style={{ color: '#2A6B48' }}>Sufficient</div>
                  <div className="score-box-n">{suf}</div>
                </div>
                <div className="score-box" style={{ background: '#FEF5E9', border: '1px solid #F4C87A' }}>
                  <div className="score-box-lbl" style={{ color: '#8B5E1A' }}>Partial</div>
                  <div className="score-box-n">{par}</div>
                </div>
                <div className="score-box" style={{ background: '#FEF0EF', border: '1px solid #F5B4B0' }}>
                  <div className="score-box-lbl" style={{ color: '#9E2B1D' }}>Gaps</div>
                  <div className="score-box-n">{gap}</div>
                </div>
              </div>

              {/* EUPTD 4-dimension table */}
              {dims.length > 0 && (
                <>
                  <hr className="light" />
                  <div className="dim-section-hdr">EUPTD Article 4 Dimensions</div>
                  <table className="dims">
                    <thead>
                      <tr>
                        <th style={{ width: '28%' }}>Dimension</th>
                        <th style={{ width: '36%' }}>Distribution</th>
                        <th className="r" style={{ width: '16%' }}>Max</th>
                        <th className="r" style={{ width: '20%' }}>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dims.map(({ dim, points, max, pct }) => (
                        <tr key={dim}>
                          <td><div className="d-name">{dim}</div></td>
                          <td>
                            <div className="bar-track">
                              <div
                                className="bar-fill"
                                style={{ width: `${pct}%`, background: DIM_COLORS[dim] }}
                              />
                            </div>
                          </td>
                          <td className="d-max">{max}</td>
                          <td className="d-pts">{points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="totals">
                    <div className="tot">
                      <div className="tot-label">Grade Points (R+S+E)</div>
                      <div className="tot-val">{gradePoints}</div>
                    </div>
                    <div className="tot">
                      <div className="tot-label">Total Points</div>
                      <div className="tot-val">{totalPoints}</div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Footnotes ──────────────────────────────────────────── */}
          <div className="fn">
            <p>¹ Grading methodology compliant with EU Pay Transparency Directive (2023/970).</p>
            {dims.some((d) => d.dim === 'Working Conditions' && d.points > 0) && (
              <p>² Working Conditions scored as compensating factor per Article 4(4).</p>
            )}
            <p>³ Generated by Quadrance JD Suite · {new Date().toISOString().slice(0, 10)} · quadrance.app</p>
          </div>
        </div>

        {/* ── Action buttons (hidden on print) ─────────────────────── */}
        <script dangerouslySetInnerHTML={{ __html: pngScript }} />
        <button
          className="no-print png-btn"
          onClick={`exportPng('${format === 'jpg' ? 'jpg' : 'png'}')`}
        >
          ↓ Save as {format === 'jpg' ? 'JPG' : 'PNG'}
        </button>
        <button
          className="no-print print-btn"
          onClick="window.print()"
        >
          ↓ Save as PDF
        </button>
      </body>
    </html>
  );
}
