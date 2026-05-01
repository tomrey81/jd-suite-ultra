/**
 * Axiomera vs Legacy 16-Criterion comparison page (admin only).
 * Gated by ENABLE_AXIOMERA_ENGINE.
 *
 * Shows latest Axiomera run, latest 16-criterion EvalResult, and side-by-side
 * dimension breakdown so admins can validate shadow-mode results before user
 * exposure.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@jd-suite/db';
import { FLAGS } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Axiomera comparison — JD Suite Ultra' };

type AxiomeraRunRow = {
  id: string;
  createdAt: Date;
  rPkt: number;
  rZone: number;
  rConfidence: unknown;
  sPkt: number;
  sLevel: string;
  sSource: string;
  ePkt: number;
  eScore: unknown;
  cogScore: unknown;
  emoScore: unknown;
  phyScore: unknown;
  eConfidence: unknown;
  wcPkt: number;
  wcLevel: string;
  totalRSE: number;
  grade: number;
  band: string;
  ciGlobal: unknown;
  contradictionFlag: boolean;
  needsReview: boolean;
  rActiveKeys: unknown;
  eActiveKeys: unknown;
  rContradictions: unknown;
};

function num(x: unknown, digits = 3): string {
  if (x === null || x === undefined) return '—';
  if (typeof x === 'number') return x.toFixed(digits);
  // Decimal type from Prisma serializes as { toString }
  const s = String(x);
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(digits) : s;
}

function arr(x: unknown): string[] {
  if (Array.isArray(x)) return x.map(String);
  return [];
}

export default async function AxiomeraComparisonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!FLAGS.AXIOMERA_ENGINE) {
    notFound();
  }

  const { id } = await params;
  const jd = await db.jobDescription.findUnique({
    where: { id },
    select: {
      id: true,
      jobTitle: true,
      jobCode: true,
      orgUnit: true,
      status: true,
      org: { select: { name: true } },
      evalResults: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          version: true,
          overallScore: true,
          criteria: true,
          createdAt: true,
        },
      },
    },
  });

  if (!jd) notFound();

  const dbAny = db as unknown as {
    axiomeraRun: { findMany: (args: unknown) => Promise<AxiomeraRunRow[]> };
  };
  const axiomeraRuns = await dbAny.axiomeraRun.findMany({
    where: { jdId: id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const latestAxiomera = axiomeraRuns[0];
  const latestEval = jd.evalResults[0];

  return (
    <>
      <header className="admin-page-head">
        <div>
          <Link href={`/admin/jds/${id}`} className="admin-back-link">
            ← Back to JD detail
          </Link>
          <h1>Axiomera comparison</h1>
          <p className="admin-page-sub">
            {jd.jobTitle || 'Untitled'} · {jd.org?.name ?? 'No org'} · {jd.status}
          </p>
        </div>
      </header>

      {!latestAxiomera && !latestEval ? (
        <div className="admin-card admin-empty">
          No evaluations yet. Run the Axiomera engine via{' '}
          <code>POST /api/jd/{id}/axiomera</code> and the legacy engine via{' '}
          <code>POST /api/ai/evaluate</code>.
        </div>
      ) : null}

      {latestAxiomera ? (
        <section className="admin-card" style={{ marginBottom: '1rem' }}>
          <h2>Axiomera Evaluation (latest)</h2>
          <p className="admin-muted">
            Run {latestAxiomera.id.slice(0, 8)} · {new Date(latestAxiomera.createdAt).toISOString()}
          </p>
          <table className="admin-table">
            <tbody>
              <tr>
                <th>Grade</th>
                <td>
                  <strong>{latestAxiomera.grade}</strong> · band {latestAxiomera.band}
                </td>
              </tr>
              <tr>
                <th>Total R+S+E</th>
                <td>{latestAxiomera.totalRSE} pts</td>
              </tr>
              <tr>
                <th>R — Responsibility (47.2%)</th>
                <td>
                  {latestAxiomera.rPkt} pts · zone {latestAxiomera.rZone} · CI{' '}
                  {num(latestAxiomera.rConfidence)}
                </td>
              </tr>
              <tr>
                <th>S — Skills (33.3%)</th>
                <td>
                  {latestAxiomera.sPkt} pts · {latestAxiomera.sLevel} · source{' '}
                  {latestAxiomera.sSource}
                </td>
              </tr>
              <tr>
                <th>E — Effort (19.5%)</th>
                <td>
                  {latestAxiomera.ePkt} pts · COG {num(latestAxiomera.cogScore, 2)} · EMO{' '}
                  {num(latestAxiomera.emoScore, 2)} · PHY {num(latestAxiomera.phyScore, 2)} · CI{' '}
                  {num(latestAxiomera.eConfidence)}
                </td>
              </tr>
              <tr>
                <th>WC — Working Conditions</th>
                <td>
                  {latestAxiomera.wcPkt} pts · {latestAxiomera.wcLevel} (separate compensation, not
                  in grade)
                </td>
              </tr>
              <tr>
                <th>CI global</th>
                <td>
                  {num(latestAxiomera.ciGlobal)} (review threshold 0.6;{' '}
                  {latestAxiomera.needsReview ? (
                    <strong>review required</strong>
                  ) : (
                    <span>OK</span>
                  )}
                  )
                </td>
              </tr>
              <tr>
                <th>Contradiction flag</th>
                <td>{latestAxiomera.contradictionFlag ? 'YES' : 'no'}</td>
              </tr>
              <tr>
                <th>R active markers ({arr(latestAxiomera.rActiveKeys).length} / 19)</th>
                <td>
                  <code style={{ fontSize: '0.85em' }}>
                    {arr(latestAxiomera.rActiveKeys).join(', ') || '—'}
                  </code>
                </td>
              </tr>
              <tr>
                <th>E active markers ({arr(latestAxiomera.eActiveKeys).length} / 45)</th>
                <td>
                  <code style={{ fontSize: '0.85em' }}>
                    {arr(latestAxiomera.eActiveKeys).join(', ') || '—'}
                  </code>
                </td>
              </tr>
              {arr(latestAxiomera.rContradictions).length > 0 ? (
                <tr>
                  <th>R contradictions</th>
                  <td style={{ color: '#a23' }}>
                    {arr(latestAxiomera.rContradictions).join(' · ')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="admin-card admin-empty" style={{ marginBottom: '1rem' }}>
          No Axiomera runs yet. POST <code>/api/jd/{id}/axiomera</code> to evaluate.
        </section>
      )}

      {latestEval ? (
        <section className="admin-card" style={{ marginBottom: '1rem' }}>
          <h2>Legacy 16-Criterion Evaluation (latest)</h2>
          <p className="admin-muted">
            Eval {latestEval.id.slice(0, 8)} · v{latestEval.version} ·{' '}
            {new Date(latestEval.createdAt).toISOString()}
          </p>
          <table className="admin-table">
            <tbody>
              <tr>
                <th>Overall completeness</th>
                <td>
                  <strong>{latestEval.overallScore} / 100</strong>
                </td>
              </tr>
            </tbody>
          </table>
          <details style={{ marginTop: '0.5rem' }}>
            <summary>Per-criterion details</summary>
            <pre
              style={{
                fontSize: '0.8em',
                maxHeight: '24rem',
                overflow: 'auto',
                padding: '0.5rem',
                background: '#f5f3ee',
                borderRadius: '4px',
              }}
            >
              {JSON.stringify(latestEval.criteria, null, 2)}
            </pre>
          </details>
        </section>
      ) : (
        <section className="admin-card admin-empty" style={{ marginBottom: '1rem' }}>
          No legacy evaluations yet. POST <code>/api/ai/evaluate</code> to run the 16-criterion
          engine.
        </section>
      )}

      <section className="admin-card" style={{ marginBottom: '1rem' }}>
        <h2>Reading guide</h2>
        <p>
          The two engines use different scales and answer different questions. Direct comparison is
          approximate.
        </p>
        <ul>
          <li>
            <strong>Axiomera grade</strong> answers: &quot;What is the objective grade with
            audit-defensible R/S/E/WC reasoning?&quot;
          </li>
          <li>
            <strong>Legacy 16-criterion</strong> answers: &quot;Where are the gaps in this JD for a
            pay-equity comparison?&quot;
          </li>
          <li>
            Both run on the same JD content. Use Axiomera for grading defensibility; use 16-criterion
            for content-completeness drill-down.
          </li>
        </ul>
      </section>

      {axiomeraRuns.length > 1 ? (
        <section className="admin-card">
          <h2>Axiomera run history</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Grade</th>
                <th>R</th>
                <th>S</th>
                <th>E</th>
                <th>WC</th>
                <th>CI</th>
                <th>Review?</th>
              </tr>
            </thead>
            <tbody>
              {axiomeraRuns.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ')}</td>
                  <td>
                    {r.grade} ({r.band})
                  </td>
                  <td>
                    {r.rPkt} (Z{r.rZone})
                  </td>
                  <td>
                    {r.sPkt} ({r.sLevel})
                  </td>
                  <td>{r.ePkt}</td>
                  <td>
                    {r.wcPkt} ({r.wcLevel})
                  </td>
                  <td>{num(r.ciGlobal)}</td>
                  <td>{r.needsReview ? 'YES' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </>
  );
}
