import Link from 'next/link';

export const metadata = { title: 'About JD Suite — Let\'s start' };

interface BusinessCase {
  role: string;
  industry: string;
  before: string;
  beforeIssues: string[];
  after: string;
  afterImprovements: string[];
  outcome: string;
}

const CASES: BusinessCase[] = [
  {
    role: 'Senior Sales Engineering Lead',
    industry: 'B2B SaaS · 250 FTE',
    before:
      'Aggressive, ambitious individual contributor who thrives in a competitive, fast-paced environment. Confident, decisive leader, comfortable taking autonomous decisions under pressure. You will analyse technical requirements and present strategic plans to executive stakeholders. Required: 8+ years progressively senior technical sales experience.',
    beforeIssues: [
      'Heavy gender-coded language (aggressive, dominant, fearless) — Iceland implicit-bias flags',
      'No measurable scope, no people-management indicator, no decision authority limit',
      '"Strategic plans to executive stakeholders" is unverifiable',
      'Bias check: agentic skew +0.78 (hard warn), EIGE emotional effort missing',
      'Not pay-equity evaluable — auditor would reject',
    ],
    after:
      'Owns technical pre-sales engagement for enterprise accounts in EMEA. Leads architecture reviews with prospect CTO/VP Engineering on deals 250k–2M EUR ARR. Manages 4 sales engineers (hire, perform-review, mentor) and is accountable for the SE team\'s win rate on technical evaluation. Acts as final technical signoff on RFP responses; escalates pricing exceptions to Head of Sales. Required: 8+ years technical sales engineering experience including at least 3 years managing technical pre-sales staff.',
    afterImprovements: [
      'Concrete scope: 4 reports, 250k–2M EUR ARR deals, EMEA',
      'Decision rights explicit: technical signoff yes, pricing exceptions escalated',
      'People management measurable (hire, review, mentor) — Axiomera R1 anchor',
      'Bias check: agentic ±0.12 (balanced), EIGE cognitive + emotional both covered',
      'EUPTD Art 4(1) — all 4 criteria (skills/effort/responsibility/conditions) addressable',
    ],
    outcome:
      'Eligible for ILO 16-criteria evaluation; pay band defensible against EUPTD Art 9 reporting and Art 10 joint pay assessment.',
  },
  {
    role: 'Customer Care Specialist',
    industry: 'Healthcare provider · 1200 FTE',
    before:
      'Friendly, patient team player to handle customer enquiries by phone and email. Able to work under pressure. Polish required, English nice-to-have. High school diploma. Previous customer service experience preferred.',
    beforeIssues: [
      '"Pink-job undervaluation" trap (Iceland 2024 §11) — emotional effort hidden',
      'No mention of safeguarding, distressed-caller handling, or confidentiality scope',
      'EIGE E2 emotional effort completely absent — canonical care-role miss',
      'Hypothesis test: 22 UNKNOWN / 56 — JD silent on most decision and responsibility dimensions',
      'Risk: undervalued vs male-dominated comparator roles in pay structure',
    ],
    after:
      'First point of contact for patients and families navigating chronic-illness care. Handles 60–90 inbound contacts/day across phone, email and patient portal. Triages emotionally distressed callers, including bereavement and end-of-life enquiries — escalates to clinical staff per protocol. Owns confidentiality compliance (GDPR Art 9 special-category health data) for own caseload. Polish C1 written + spoken. English B1 for international referrals. Vocational diploma in healthcare administration OR 2 years equivalent experience.',
    afterImprovements: [
      'Emotional effort named explicitly: bereavement, distress, end-of-life conversations',
      'Confidentiality scope quantified: GDPR Art 9 special-category data',
      'Volume scope quantified: 60–90 contacts/day',
      'Bias check: 0 flags, EIGE all three coverages confirmed',
      'Hypothesis test: 14 TRUE / 8 FALSE / 0 UNKNOWN on care + emotional dimensions',
    ],
    outcome:
      'Job evaluation now reflects emotional load and confidentiality responsibility — closes the typical pink-job pay gap by 8–14% in EUPTD-aligned methods.',
  },
  {
    role: 'Construction Site Coordinator',
    industry: 'Civil engineering · 600 FTE',
    before:
      'Dynamic individual to coordinate works on construction sites. Must be able to lift heavy materials and work outdoors in all weather. Strong leadership and a can-do attitude. Construction experience essential.',
    beforeIssues: [
      'Vague: "coordinate works" — what scope, how many crews, what budget?',
      '"Lift heavy materials" without quantification — fails EUPTD Art 4(4) objectivity',
      'No people management number, no financial authority, no scope of impact',
      'Implicit-bias flag: "dynamic, can-do, strong leadership" — gender-coded macho framing',
      'Working conditions named but no link to ISCO_2 anchor (EWCS Tabela 23)',
    ],
    after:
      'Coordinates 2–3 concurrent residential build sites in Mazowieckie region. Manages day-to-day work of 8–15 trade subcontractors per site (no direct hire/fire — schedule + quality control). Approves variations up to 25k PLN against project budget; escalates above to Project Manager. Reports to Senior Site Manager. Outdoor work approx. 70% of time; lifts up to 25 kg occasionally; exposure to dust, noise (above 85 dB requires hearing protection per BHP regulations).',
    afterImprovements: [
      'Scope quantified: 2–3 sites, 8–15 subcontractors, region named',
      'Financial authority bounded: 25k PLN approval limit',
      'Physical demands measurable: 25 kg, 70% outdoor, 85 dB threshold',
      'ISCO_2 anchor (71 — Construction trades) maps to EWCS WC = 350 pts',
      'No "macho leadership" trigger — neutral, factual framing',
    ],
    outcome:
      'Working conditions properly compensated (Axiomera WC1 50pts vs the under-scored 0pts of the original), and the JD is defensible against EUPTD Art 4(4) gender-neutral analytical method requirement.',
  },
];

export default function AboutPage() {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[980px]">
        {/* Header */}
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">
          Let&apos;s start
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
          About JD Suite
        </h1>
        <p className="mt-2 max-w-[680px] text-[14px] leading-relaxed text-text-secondary">
          JD Suite turns vague, recruitment-style job descriptions into structured documents
          that can be defended against the EU Pay Transparency Directive (2023/970), audited for
          bias, and used as input to a pay equity evaluation.
        </p>

        {/* What it is */}
        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <FeatureCard
            title="Structured authoring"
            description="A JD template defines exactly what fields a role-evaluable JD must contain. Lint &amp; analyse runs continuously against the template."
          />
          <FeatureCard
            title="Bias detection"
            description="Lexical, title, structural and Iceland implicit-bias layers. EIGE coverage on cognitive / emotional / physical effort."
          />
          <FeatureCard
            title="Hypothesis testing"
            description="56 binary structural hypotheses (Axiomera/PRISM methodology) tested against the JD text — TRUE / FALSE / UNKNOWN with evidence quotes."
          />
        </section>

        {/* Good practices */}
        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold text-text-primary">Good practices</h2>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-text-secondary">
            <li className="flex gap-2">
              <span className="text-brand-gold">→</span>
              <span><strong>Quantify scope.</strong> A responsibility without a number (people, budget, sites, contacts/day) is not evaluable. "Manages a team" is not the same as "manages 4 reports".</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-gold">→</span>
              <span><strong>Decision rights belong in writing.</strong> What can this role approve alone? What must be escalated? Where are the limits?</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-gold">→</span>
              <span><strong>Name emotional effort explicitly.</strong> Care, customer service, teaching and conflict-handling roles routinely lose pay-equity points because the JD is silent about emotional load.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-gold">→</span>
              <span><strong>Avoid agentic-coded marketing language.</strong> "Aggressive, dominant, fearless, rockstar" trigger Iceland 2024 implicit-bias flags and skew the JD toward a male comparator.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-gold">→</span>
              <span><strong>Working conditions are anchored to ISCO_2.</strong> Don&apos;t infer them from job zone — use the EWCS 2024 empirical mapping (it&apos;s how construction roles get fairly compensated vs office roles).</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-gold">→</span>
              <span><strong>UNKNOWN is honest.</strong> The hypothesis tester is allowed to say "JD is silent on this dimension". Don&apos;t fix it by guessing — fix it by going back to the line manager with a specific question.</span>
            </li>
          </ul>
        </section>

        {/* Business cases */}
        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold text-text-primary">
            Business cases — poor JD → evaluable JD
          </h2>
          <p className="mt-1 text-[12px] text-text-muted">
            Three real-world transformations. Each one shows the original wording, the issues found,
            the improved version, and the impact on pay-equity defensibility.
          </p>

          <div className="mt-5 space-y-5">
            {CASES.map((c, i) => (
              <div key={c.role} className="rounded-xl border border-border-default bg-white">
                <div className="flex items-baseline justify-between gap-3 border-b border-border-default px-5 py-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">
                      Case {i + 1}
                    </div>
                    <h3 className="mt-0.5 font-display text-base font-semibold text-text-primary">
                      {c.role}
                    </h3>
                  </div>
                  <span className="text-[11px] text-text-muted">{c.industry}</span>
                </div>

                <div className="grid gap-0 md:grid-cols-2 md:divide-x md:divide-border-default">
                  {/* Before */}
                  <div className="border-b border-border-default p-5 md:border-b-0">
                    <div className="mb-2 inline-block rounded-full bg-danger-bg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-danger">
                      Before — not evaluable
                    </div>
                    <blockquote className="border-l-2 border-danger/30 pl-3 text-[12px] italic leading-relaxed text-text-secondary">
                      {c.before}
                    </blockquote>
                    <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-text-secondary">
                      {c.beforeIssues.map((iss, j) => (
                        <li key={j} className="flex gap-1.5">
                          <span className="shrink-0 text-danger">✗</span>
                          <span>{iss}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* After */}
                  <div className="p-5">
                    <div className="mb-2 inline-block rounded-full bg-success-bg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-success">
                      After — evaluable
                    </div>
                    <blockquote className="border-l-2 border-success/30 pl-3 text-[12px] italic leading-relaxed text-text-secondary">
                      {c.after}
                    </blockquote>
                    <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-text-secondary">
                      {c.afterImprovements.map((imp, j) => (
                        <li key={j} className="flex gap-1.5">
                          <span className="shrink-0 text-success">✓</span>
                          <span>{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="border-t border-border-default bg-brand-gold/5 px-5 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-brand-gold">
                    Outcome
                  </div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-text-primary">{c.outcome}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-10 mb-8 rounded-xl border border-border-default bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-text-primary">Ready to start?</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-text-muted">
            Pick the path that matches what you have today.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/jd/input"
              className="rounded-full bg-brand-gold px-4 py-2 text-xs font-medium tracking-wide text-white hover:bg-brand-gold/90"
            >
              Upload Job Description
            </Link>
            <Link
              href="/jd/new"
              className="rounded-full border border-border-default bg-white px-4 py-2 text-xs font-medium tracking-wide text-text-secondary hover:border-brand-gold"
            >
              Start blank
            </Link>
            <Link
              href="/templates"
              className="rounded-full border border-border-default bg-white px-4 py-2 text-xs font-medium tracking-wide text-text-secondary hover:border-brand-gold"
            >
              Browse templates
            </Link>
            <Link
              href="/guide"
              className="rounded-full border border-border-default bg-white px-4 py-2 text-xs font-medium tracking-wide text-text-secondary hover:border-brand-gold"
            >
              Best Practices
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-white p-4">
      <h3 className="font-display text-sm font-semibold text-text-primary">{title}</h3>
      <p
        className="mt-1.5 text-[11px] leading-relaxed text-text-muted"
        dangerouslySetInnerHTML={{ __html: description }}
      />
    </div>
  );
}
