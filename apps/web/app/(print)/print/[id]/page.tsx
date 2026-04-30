import { db } from '@jd-suite/db';
import { notFound } from 'next/navigation';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/lib/default-template';
import type { TemplateSection } from '@jd-suite/types';
import { PrintButtons } from './print-buttons';

export const dynamic = 'force-dynamic';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d?: Date | string | null) {
  return new Date(d ?? Date.now()).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

const DIM_KEYWORDS: Record<string, string[]> = {
  Responsibility: ['decision', 'authority', 'financial', 'accountability', 'leadership', 'supervision', 'impact', 'budget', 'people'],
  'Skills & Knowledge': ['education', 'experience', 'qualification', 'knowledge', 'language', 'skill', 'system', 'proficiency', 'technical'],
  'Effort & Complexity': ['complexity', 'planning', 'problem', 'cognitive', 'emotional', 'communication', 'analytical', 'creative', 'effort'],
  'Working Conditions': ['physical', 'environment', 'schedule', 'travel', 'working condition', 'hazard', 'stress'],
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
  feedback?: string;
}

function mapDimensions(criteria: CriterionResult[]) {
  return Object.entries(DIM_KEYWORDS).map(([dim, keywords]) => {
    const matches = criteria.filter((c) =>
      keywords.some((k) => c.criterion?.toLowerCase().includes(k) || c.category?.toLowerCase().includes(k)),
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
  const format = sp?.format === 'jpg' ? 'jpg' : 'png';

  const jd = await db.jobDescription.findFirst({
    where: { id },
    include: {
      template: true,
      evalResults: { orderBy: { createdAt: 'desc' }, take: 1 },
      owner: { select: { name: true } },
    },
  });

  if (!jd) notFound();

  const sections: TemplateSection[] =
    (jd.template?.sections as TemplateSection[]) ?? DEFAULT_TEMPLATE_SECTIONS;
  const data = (jd.data as Record<string, string>) ?? {};
  const evalResult = jd.evalResults[0];
  const criteria: CriterionResult[] =
    evalResult ? ((evalResult.criteria as unknown as CriterionResult[]) ?? []) : [];

  const dims = criteria.length > 0 ? mapDimensions(criteria) : [];
  const gradePoints = dims.slice(0, 3).reduce((s, d) => s + d.points, 0);
  const totalPoints = dims.reduce((s, d) => s + d.points, 0);

  const suf = criteria.filter((c) => c.status === 'sufficient').length;
  const par = criteria.filter((c) => c.status === 'partial').length;
  const gap = criteria.filter((c) => c.status === 'insufficient').length;
  const dqs = criteria.length > 0 ? Math.round(((suf + par * 0.5) / criteria.length) * 100) : null;

  const jobTitle = data.jobTitle || jd.jobTitle || 'Untitled Role';
  const orgUnit  = data.orgUnit  || jd.orgUnit  || '';
  const jobFamily = data.jobFamily || '';
  const safeTitle = jobTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `JD_${safeTitle}_${dateStr}`;

  const dqsBadge = dqs === null ? '' : dqs >= 75 ? '#2A6B48' : dqs >= 50 ? '#8B5E1A' : '#9E2B1D';
  const dqsBg   = dqs === null ? '' : dqs >= 75 ? '#EEF8F3' : dqs >= 50 ? '#FEF5E9' : '#FEF0EF';
  const dqsLabel = dqs === null ? '' : dqs >= 75 ? 'Good' : dqs >= 50 ? 'Needs work' : 'Insufficient';

  const statusColor = jd.status === 'APPROVED' ? '#2A6B48' : jd.status === 'DRAFT' ? '#8B5E1A' : '#666';
  const statusBg    = jd.status === 'APPROVED' ? '#EEF8F3' : jd.status === 'DRAFT' ? '#FEF5E9' : '#F5F5F5';

  return (
    <>
      {/* Global print page styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        body { margin: 0; background: #F6F4EF !important; }
        @media print {
          @page { size: A4; margin: 16mm 20mm; }
          .no-print { display: none !important; }
          body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}} />

      {/* ── Full JD Document ─────────────────────────────────────── */}
      <div
        id="jd-doc"
        style={{
          maxWidth: 880, margin: '0 auto', padding: '36px 44px 60px',
          background: '#F6F4EF', minHeight: '100vh',
          fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
          fontSize: 13, lineHeight: 1.65, color: '#1A1A1A',
          WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
        }}
      >
        {/* Auto-print script */}
        {auto && (
          <script dangerouslySetInnerHTML={{
            __html: `window.addEventListener('load',()=>{setTimeout(()=>window.print(),700)})`,
          }} />
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            JD Suite
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>{fmtDate(jd.updatedAt)}</div>
        </div>
        <hr style={{ border: 'none', borderTop: '1.5px solid #1A1A1A', margin: '14px 0 28px' }} />

        {/* Job title */}
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 33, fontWeight: 700, fontStyle: 'italic', lineHeight: 1.15, marginBottom: 6 }}>
          {jobTitle}
        </div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 20 }}>
          {[jobFamily, orgUnit].filter(Boolean).join(' · ') || 'Job Description'}
          {evalResult && <> · <span style={{ color: '#8A7560' }}>EU Pay Transparency Directive 2023/970</span></>}
        </div>

        {/* Quality cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {dqs !== null && (
            <div style={{ flex: 1, background: '#fff', border: '1px solid #DDD7CE', borderRadius: 6, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.13em', color: '#999', flex: 1 }}>Pay Equity Quality</div>
              <div style={{ fontSize: 21, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{dqs}%</div>
              <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 7px', borderRadius: 20, border: `1px solid ${dqsBadge}`, background: dqsBg, color: dqsBadge, whiteSpace: 'nowrap' }}>
                {dqsLabel}
              </div>
            </div>
          )}
          <div style={{ flex: 1, background: '#fff', border: '1px solid #DDD7CE', borderRadius: 6, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.13em', color: '#999', flex: 1 }}>Document Status</div>
            <div style={{ fontSize: 10, color: '#888' }}>
              {sections.filter((s) => s.fields.some((f) => data[f.id]?.trim())).length}/{sections.length} sections
            </div>
            <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 7px', borderRadius: 20, border: `1px solid ${statusColor}`, background: statusBg, color: statusColor }}>
              {jd.status.replace('_', ' ')}
            </div>
          </div>
        </div>

        {/* Meta pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
          {[
            orgUnit && ['Unit', orgUnit],
            data.jobCode && ['Code', data.jobCode],
            data.positionType && ['Type', data.positionType],
            jd.owner?.name && ['Owner', jd.owner.name],
            data.approvedBy && ['Approved by', data.approvedBy],
            data.approvalDate && ['Date', data.approvalDate],
          ].filter(Boolean).map((item, i) => {
            const [k, v] = item as [string, string];
            return (
              <div key={i} style={{ fontSize: 10, color: '#555', background: '#fff', border: '1px solid #DDD7CE', borderRadius: 4, padding: '3px 9px' }}>
                <strong style={{ color: '#1A1A1A' }}>{k}:</strong> {v}
              </div>
            );
          })}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #DDD7CE', margin: '22px 0' }} />

        {/* JD Sections */}
        {sections.map((sec) => {
          const filled = sec.fields.filter((f) => data[f.id]?.trim());
          if (!filled.length) return null;
          return (
            <div key={sec.id} style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#8A7560', borderBottom: '1px solid #DDD7CE', paddingBottom: 5, marginBottom: 11 }}>
                {sec.title}
              </div>
              {filled.map((f) => (
                <div key={f.id} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#777', marginBottom: 2 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 13, color: '#1A1A1A', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.65 }}>
                    {data[f.id]}
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {/* Pay Equity Evaluation */}
        {evalResult && criteria.length > 0 && (
          <>
            <hr style={{ border: 'none', borderTop: '1.5px solid #1A1A1A', margin: '22px 0' }} />
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#999', marginBottom: 14 }}>
              Pay Equity Evaluation — ILO 16-Criteria Framework
            </div>

            {/* 16-criteria grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginBottom: 20 }}>
              {criteria.map((c, i) => {
                const sc = c.status === 'sufficient' ? '#2A6B48' : c.status === 'partial' ? '#8B5E1A' : '#9E2B1D';
                return (
                  <div key={i} style={{ background: '#fff', border: '1px solid #DDD7CE', borderRadius: 4, padding: '6px 9px' }}>
                    <div style={{ fontSize: 10, color: '#555', lineHeight: 1.3, marginBottom: 2 }}>{c.criterion}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: sc }}>{c.status}</div>
                  </div>
                );
              })}
            </div>

            {/* Score summary */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Sufficient', n: suf, color: '#2A6B48', bg: '#EEF8F3', border: '#B8DFC9' },
                { label: 'Partial',    n: par, color: '#8B5E1A', bg: '#FEF5E9', border: '#F4C87A' },
                { label: 'Gaps',       n: gap, color: '#9E2B1D', bg: '#FEF0EF', border: '#F5B4B0' },
              ].map(({ label, n, color, bg, border }) => (
                <div key={label} style={{ flex: 1, borderRadius: 4, padding: '8px 12px', background: bg, border: `1px solid ${border}` }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{n}</div>
                </div>
              ))}
            </div>

            {/* EUPTD 4-dimension table */}
            {dims.length > 0 && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid #DDD7CE', margin: '12px 0' }} />
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#999', margin: '16px 0 10px' }}>
                  EUPTD Article 4 Dimensions
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
                  <thead>
                    <tr>
                      {['Dimension', 'Distribution', 'Max', 'Points'].map((h) => (
                        <th key={h} style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#aaa', padding: '3px 0 6px', textAlign: h === 'Max' || h === 'Points' ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dims.map(({ dim, points, max, pct }) => (
                      <tr key={dim}>
                        <td style={{ padding: '10px 0 4px', fontSize: 13, fontWeight: 600, width: '28%' }}>{dim}</td>
                        <td style={{ padding: '10px 0 4px', width: '36%' }}>
                          <div style={{ height: 5, background: '#EAE5DF', borderRadius: 3, width: 160, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: DIM_COLORS[dim] }} />
                          </div>
                        </td>
                        <td style={{ padding: '10px 0 4px', fontSize: 11, color: '#aaa', textAlign: 'right', paddingRight: 16, fontVariantNumeric: 'tabular-nums', width: '16%' }}>{max}</td>
                        <td style={{ padding: '10px 0 4px', fontSize: 16, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums', width: '20%' }}>{points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 40, paddingTop: 14, borderTop: '1.5px solid #1A1A1A', marginTop: 4 }}>
                  {[
                    { label: 'Grade Points (R+S+E)', val: gradePoints },
                    { label: 'Total Points', val: totalPoints },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#aaa' }}>{label}</div>
                      <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Footnotes */}
        <div style={{ marginTop: 36, paddingTop: 14, borderTop: '1px solid #DDD7CE' }}>
          <p style={{ fontSize: 9.5, color: '#bbb', marginBottom: 3, lineHeight: 1.4 }}>
            ¹ Grading methodology compliant with EU Pay Transparency Directive (2023/970).
          </p>
          {dims.some((d) => d.dim === 'Working Conditions' && d.points > 0) && (
            <p style={{ fontSize: 9.5, color: '#bbb', marginBottom: 3, lineHeight: 1.4 }}>
              ² Working Conditions scored as compensating factor per Article 4(4).
            </p>
          )}
          <p style={{ fontSize: 9.5, color: '#bbb', lineHeight: 1.4 }}>
            ³ Generated by JD Suite · {new Date().toISOString().slice(0, 10)} · Built by Tomasz Rey · linkedin.com/in/tomaszrey
          </p>
        </div>
      </div>

      {/* Action buttons (client component) */}
      <PrintButtons format={format} fileName={fileName} />
    </>
  );
}
