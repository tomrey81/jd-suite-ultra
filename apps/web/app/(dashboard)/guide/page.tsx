export const dynamic = 'force-dynamic';

/**
 * Best Practices — JD writing guide.
 *
 * Visual brand notes:
 * — Header pattern matches /about: small uppercase eyebrow + serif h1 +
 *   supporting paragraph. No "hero card" wrapper.
 * — Single accent colour: brand-gold. No danger-red, info-blue, or
 *   cat-skills tints anywhere.
 * — Cards: white background, hairline border, generous padding.
 * — No decorative emoji; use consistent typographic glyphs.
 */

const SECTION = 'mb-12';
const CARD = 'rounded-lg border border-border-default bg-white';
const EYEBROW = 'text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold';

const RULES = [
  {
    num: '01',
    title: 'Kill the company monologue',
    desc: 'Move your 300-word company description to the careers page. The JD is about the role, not your origin story.',
    bad: '"Founded in 1987, our award-winning company with offices in 14 countries..."',
    good: 'Link to the Company Page. Start with the role.',
  },
  {
    num: '02',
    title: 'Write to a person, not a persona',
    desc: 'Use "you" instead of "the ideal candidate." Candidates should see themselves in the role.',
    bad: '"The ideal candidate will possess strong analytical skills..."',
    good: '"You will analyse market data to shape pricing strategy."',
  },
  {
    num: '03',
    title: 'Show a day in the life',
    desc: 'Describe what they will actually do on a Tuesday, not abstract responsibilities.',
    bad: '"Responsible for stakeholder management"',
    good: '"You will run weekly syncs with 3 product teams and present monthly insights to the VP."',
  },
  {
    num: '04',
    title: 'Cut the buzzword bingo',
    desc: 'If you wouldn\'t say it out loud in a conversation, don\'t write it in a JD.',
    bad: '"Synergize cross-functional paradigms to drive transformational outcomes"',
    good: '"Work with engineering and marketing to launch new features faster"',
  },
  {
    num: '05',
    title: 'Separate must-haves from nice-to-haves',
    desc: 'Research shows women apply only when they meet 100% of requirements; men apply at 60%. Be explicit about what is truly required.',
    bad: '10 bullet points all starting with "Must have…"',
    good: '"Required: X, Y. Bonus if you also know: Z"',
  },
  {
    num: '06',
    title: 'Add time allocation',
    desc: 'Show how much time goes to each area. This is what candidates actually want to know.',
    bad: '"Manage projects, write code, mentor juniors, handle operations"',
    good: '"60% hands-on engineering, 20% code review and mentoring, 20% planning"',
  },
  {
    num: '07',
    title: 'Set 6-month expectations',
    desc: 'Tell them what success looks like. This attracts motivated candidates and repels drifters.',
    bad: '"Growth opportunities available"',
    good: '"In 6 months you will have shipped 2 features and own the search pipeline."',
  },
];

const ARMSTRONG_PRINCIPLES = [
  {
    title: 'Describe the job, not the person',
    desc: 'A JD defines what the role requires, not who should fill it. Personal attributes belong in person specifications, not JDs.',
  },
  {
    title: 'Focus on outputs, not inputs',
    desc: 'State what the role must achieve, not how. This prevents procedural bloat and allows flexibility in execution.',
  },
  {
    title: 'Use factor-based evaluation',
    desc: 'Evaluate roles across consistent factors: knowledge, decision-making, responsibility, effort, working conditions. This is the basis of pay equity.',
  },
  {
    title: 'Keep it auditable',
    desc: 'Every statement in a JD should be verifiable. If you can\'t measure it or observe it, it shouldn\'t be there.',
  },
];

const CHECKLIST = [
  'Title matches ESCO/ISCO occupation (not inflated)',
  'Purpose statement is 2–3 sentences max',
  'Responsibilities use active verbs (6–10 items)',
  'Requirements split into must-have vs nice-to-have',
  'Skills use ESCO standard terminology',
  'Qualifications reference EQF levels, not just degrees',
  'Time allocation shown for major areas',
  'No buzzwords (synergy, leverage, paradigm, etc.)',
  'Written in second person ("you will…")',
  'Company description is max 1 sentence or linked',
  '6-month success criteria included',
  'Total length under 700 words',
  'All statements are auditable and verifiable',
  'Gender-neutral language throughout',
  'Working conditions stated (EU Directive 2023/970)',
  'Pay equity factors addressed (knowledge, effort, responsibility, conditions)',
];

export default function GuidePage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[920px] px-8 py-10">
        {/* Page header — matches /about pattern */}
        <header className="mb-12">
          <div className={EYEBROW}>Let&apos;s Start</div>
          <h1 className="mt-2 font-display text-[34px] font-bold leading-[1.15] text-text-primary">
            How to write a job description that actually works
          </h1>
          <p className="mt-4 max-w-[680px] text-[14px] leading-relaxed text-text-secondary">
            Most job descriptions are bloated, vague, and full of wording inflation. Here is a lean,
            evidence-based approach combining LinkedIn Talent Solutions research, the ESCO European
            classification framework, and Michael Armstrong&apos;s reward management principles.
          </p>
        </header>

        {/* Wording inflation — neutral stats, not danger-red */}
        <section className={SECTION}>
          <div className="mb-3">
            <div className={EYEBROW}>The problem</div>
            <h2 className="mt-1 font-display text-[20px] font-semibold text-text-primary">Wording inflation</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { stat: '30%', desc: 'of workers leave within 90 days because the JD didn\u2019t match reality' },
              { stat: '41%', desc: 'cite mismatched day-to-day expectations as the reason for quitting' },
              { stat: '73%', desc: 'of JDs contain inflated titles or responsibilities that don\u2019t reflect the actual role' },
            ].map((s) => (
              <div key={s.stat} className={`${CARD} p-5`}>
                <div className="font-display text-[34px] font-bold leading-none text-brand-gold tabular-nums">
                  {s.stat}
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-text-secondary">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* LinkedIn research — neutral cards */}
        <section className={SECTION}>
          <div className="mb-4">
            <div className={EYEBROW}>LinkedIn Talent Solutions research</div>
            <h2 className="mt-1 font-display text-[22px] font-semibold text-text-primary">
              7 rules for job descriptions that win
            </h2>
          </div>

          <div className="space-y-3">
            {RULES.map(({ num, title, desc, bad, good }) => (
              <article key={num} className={`${CARD} p-5`}>
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-[22px] font-bold text-brand-gold tabular-nums">{num}</span>
                  <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-text-secondary">{desc}</p>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-md border border-border-default bg-surface-page p-3">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Don&apos;t</div>
                    <p className="mt-1 text-[11.5px] italic leading-relaxed text-text-secondary">{bad}</p>
                  </div>
                  <div className="rounded-md border border-brand-gold/30 bg-brand-gold-lighter p-3">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-brand-gold">Do</div>
                    <p className="mt-1 text-[11.5px] italic leading-relaxed text-text-primary">{good}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-4 text-[10px] text-text-muted">
            Source:{' '}
            <a
              href="https://www.linkedin.com/business/talent/blog/talent-acquisition/job-descriptions-that-win"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-gold underline-offset-2 hover:underline"
            >
              LinkedIn Talent Blog — Job Descriptions That Win
            </a>
          </p>
        </section>

        {/* ESCO */}
        <section className={SECTION}>
          <div className="mb-4">
            <div className={EYEBROW}>European classification framework</div>
            <h2 className="mt-1 font-display text-[22px] font-semibold text-text-primary">
              The ESCO approach to lean JDs
            </h2>
          </div>

          <p className="mb-5 text-[13.5px] leading-relaxed text-text-secondary">
            ESCO (European Skills, Competences, Qualifications and Occupations) classifies 3,039 occupations
            and 13,939 skills across 28 languages. It provides a standardised vocabulary that eliminates
            ambiguity and wording inflation by anchoring every role to a validated taxonomy.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <div className={`${CARD} p-5`}>
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-brand-gold">
                Why ESCO matters for JDs
              </h3>
              <ul className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-text-secondary">
                <li>— Standardised skill language across the EU; no more inventing competencies</li>
                <li>— Every occupation mapped to ISCO-08 for international comparability</li>
                <li>— Skills linked to qualifications; EQF levels replace vague &quot;degree required&quot;</li>
                <li>— Reusability levels (transversal, cross-sector, sector-specific) prevent skill sprawl</li>
                <li>— Eliminates title inflation; &quot;Senior Global VP&quot; maps to a real ESCO occupation</li>
              </ul>
            </div>
            <div className={`${CARD} p-5`}>
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-brand-gold">
                The lean JD formula
              </h3>
              <ol className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-text-secondary">
                <li><strong className="text-text-primary">1.</strong> Start with the ESCO occupation code (e.g. 2512 — Software Developer)</li>
                <li><strong className="text-text-primary">2.</strong> List only skills tagged as &quot;essential&quot; in ESCO for that occupation</li>
                <li><strong className="text-text-primary">3.</strong> Add 2–3 organisation-specific skills as &quot;optional&quot;</li>
                <li><strong className="text-text-primary">4.</strong> Use ESCO skill descriptions verbatim — they are already lean</li>
                <li><strong className="text-text-primary">5.</strong> Map qualifications to EQF levels, not degree names</li>
                <li><strong className="text-text-primary">6.</strong> Result: 60% shorter JDs with 100% of the meaningful content</li>
              </ol>
            </div>
          </div>

          <div className="mt-4 rounded-md border-l-2 border-brand-gold bg-brand-gold-lighter px-4 py-3 text-[12px] leading-relaxed text-text-primary">
            <strong className="text-brand-gold">JD Suite integration · </strong>
            When you use the JD Analyser, it automatically matches your role to the nearest ESCO occupation
            and ISCO-08 code, flagging skills that are inflated or missing from the standard classification.
            This is your first line of defence against wording inflation.
          </div>

          <p className="mt-4 text-[10px] text-text-muted">
            Source:{' '}
            <a
              href="https://esco.ec.europa.eu/en/about-esco/what-esco"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-gold underline-offset-2 hover:underline"
            >
              European Commission — ESCO Classification
            </a>
          </p>
        </section>

        {/* Michael Armstrong */}
        <section className={SECTION}>
          <div className="mb-4">
            <div className={EYEBROW}>Expert perspective</div>
            <h2 className="mt-1 font-display text-[22px] font-semibold text-text-primary">
              Michael Armstrong on job evaluation
            </h2>
          </div>

          <div className={`${CARD} p-6`}>
            <div className="flex flex-col gap-5 md:flex-row md:gap-6">
              {/* Brand-styled portrait card */}
              <div className="flex h-[140px] w-[120px] shrink-0 flex-col items-center justify-center rounded-lg border border-border-default bg-surface-page text-center">
                <div className="font-display text-[28px] font-bold text-brand-gold">MA</div>
                <div className="mt-1 text-[8px] uppercase tracking-widest text-text-muted">
                  Michael<br />Armstrong
                </div>
                <div className="mt-2 text-[7px] text-text-muted">CIPD Companion</div>
              </div>

              <div>
                <p className="text-[13px] leading-relaxed text-text-secondary">
                  <strong className="text-text-primary">Michael Armstrong</strong> is a UK-based HR thought leader
                  and author specialising in reward management, strategic HRM, and performance management. He is
                  best known for <em>Armstrong&apos;s Handbook of Reward Management Practice</em> and{' '}
                  <em>Armstrong&apos;s Handbook of Human Resource Management Practice</em>, both widely used by HR
                  professionals across Europe and internationally.
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-text-secondary">
                  His work has significantly influenced modern approaches to job evaluation, grading structures,
                  and pay frameworks, particularly in analytical and competency-based systems. He is a Companion
                  and former Chief Examiner of the CIPD; his books have sold over a million copies in 21 languages.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-brand-gold">
                Armstrong&apos;s principles for JD quality
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {ARMSTRONG_PRINCIPLES.map(({ title, desc }) => (
                  <div key={title} className="rounded-md border border-border-default bg-surface-page p-4">
                    <h4 className="text-[12.5px] font-semibold text-text-primary">{title}</h4>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-text-secondary">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-md border-l-2 border-brand-gold bg-brand-gold-lighter p-5">
              <div className={`${EYEBROW} mb-2`}>Industry humour</div>
              <p className="text-[13px] leading-relaxed text-text-primary">
                Michael Armstrong is such a job evaluation expert that startup founders message him on LinkedIn
                asking how to price a &quot;Senior Global Executive Vice Ultra Director.&quot; He replies politely:
              </p>
              <blockquote className="mt-3 border-l-[2px] border-brand-gold pl-4 font-display text-[14px] italic leading-relaxed text-text-primary">
                &mdash; It&apos;s simple. If the title has more words than actual responsibilities, the valuation
                drops by half for every &quot;Global.&quot;
              </blockquote>
              <p className="mt-3 text-[13px] leading-relaxed text-text-primary">
                Apparently, ever since then, half of LinkedIn has shortened their job titles to just{' '}
                <strong>&quot;Working.&quot;</strong>
              </p>
            </div>
          </div>
        </section>

        {/* Checklist — neutral, not success-green */}
        <section className={SECTION}>
          <div className="mb-4">
            <div className={EYEBROW}>Self-check</div>
            <h2 className="mt-1 font-display text-[22px] font-semibold text-text-primary">The lean JD checklist</h2>
          </div>
          <div className={`${CARD} p-5`}>
            <ul className="grid gap-1.5 md:grid-cols-2">
              {CHECKLIST.map((item) => (
                <li key={item}>
                  <label className="flex items-start gap-2.5 rounded-md border border-transparent px-2.5 py-1.5 transition-colors hover:border-border-default hover:bg-surface-page">
                    <input
                      type="checkbox"
                      className="mt-[3px] h-3.5 w-3.5 shrink-0 cursor-pointer accent-brand-gold"
                    />
                    <span className="text-[12.5px] leading-snug text-text-primary">{item}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA — brand-gold primary, ghost secondary */}
        <section className="mb-10">
          <div className={`${CARD} p-6 text-center`}>
            <h2 className="font-display text-[18px] font-semibold text-text-primary">Ready to write a lean JD?</h2>
            <p className="mt-2 text-[12.5px] text-text-secondary">
              Use the JD Analyser to check existing JDs against ESCO standards, or start fresh with the JD Editor.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <a
                href="/jd"
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-gold px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-brand-gold/90"
              >
                Analyse a JD
              </a>
              <a
                href="/jd/new"
                className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-white px-4 py-2 text-[13px] font-medium text-text-primary transition-colors hover:border-brand-gold hover:text-brand-gold"
              >
                Build from scratch
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border-default pt-5 text-center text-[10px] leading-relaxed text-text-muted">
          <div>
            JD Suite · EU Pay Transparency Directive 2023/970 · Built by{' '}
            <a
              href="https://www.linkedin.com/in/tomaszrey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-gold underline-offset-2 hover:underline"
            >
              Tomasz Rey
            </a>
          </div>
          <div className="mt-1">
            Sources: LinkedIn Talent Solutions · ESCO / European Commission · Michael Armstrong, Handbook of Reward Management Practice
          </div>
        </footer>
      </div>
    </div>
  );
}
