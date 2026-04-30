export const dynamic = 'force-dynamic';

export default function GuidePage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[900px] px-8 py-10">
        {/* Hero */}
        <div className="mb-10 rounded-xl border border-border-default bg-white p-8">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-brand-gold">
            JD Guide
          </div>
          <h1 className="mb-3 font-display text-3xl font-bold leading-tight text-text-primary">
            How to Write a Job Description<br />
            <span className="text-brand-gold">That Actually Works</span>
          </h1>
          <p className="max-w-[680px] text-[15px] leading-relaxed text-text-secondary">
            Most job descriptions are bloated, vague, and full of wording inflation.
            Here is a lean, evidence-based approach combining LinkedIn Talent Solutions research,
            the ESCO European classification framework, and Michael Armstrong&apos;s reward management principles.
          </p>
        </div>

        {/* The Problem */}
        <div className="mb-8 rounded-xl border border-danger bg-danger-bg p-6">
          <h2 className="mb-3 font-display text-lg font-bold text-danger">The Problem: Wording Inflation</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-white p-4 text-center">
              <div className="font-display text-3xl font-bold text-danger">30%</div>
              <p className="mt-1 text-xs text-text-secondary">
                of workers leave within 90 days because the JD didn&apos;t match reality
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 text-center">
              <div className="font-display text-3xl font-bold text-danger">41%</div>
              <p className="mt-1 text-xs text-text-secondary">
                cite &quot;mismatched day-to-day expectations&quot; as the reason for quitting
              </p>
            </div>
            <div className="rounded-lg bg-white p-4 text-center">
              <div className="font-display text-3xl font-bold text-danger">73%</div>
              <p className="mt-1 text-xs text-text-secondary">
                of JDs contain inflated titles or responsibilities that don&apos;t reflect the actual role
              </p>
            </div>
          </div>
        </div>

        {/* LinkedIn Insights */}
        <div className="mb-8 rounded-xl border border-border-default bg-white p-6">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-lg">&#x1F4BC;</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-info">LinkedIn Talent Solutions Research</span>
          </div>
          <h2 className="mb-4 font-display text-xl font-bold text-text-primary">7 Rules for Job Descriptions That Win</h2>

          <div className="space-y-4">
            {[
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
                desc: 'Research shows women apply only when they meet 100% of requirements. Men apply at 60%. Be explicit about what is truly required.',
                bad: '10 bullet points all starting with "Must have..."',
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
            ].map(({ num, title, desc, bad, good }) => (
              <div key={num} className="rounded-lg border border-border-default p-4">
                <div className="mb-2 flex items-baseline gap-3">
                  <span className="font-display text-2xl font-bold text-brand-gold">{num}</span>
                  <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
                </div>
                <p className="mb-3 text-xs leading-relaxed text-text-secondary">{desc}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-md bg-danger-bg p-2.5">
                    <div className="mb-1 text-[9px] font-bold uppercase text-danger">Don&apos;t</div>
                    <p className="text-[11px] italic leading-relaxed text-text-secondary">{bad}</p>
                  </div>
                  <div className="rounded-md bg-success-bg p-2.5">
                    <div className="mb-1 text-[9px] font-bold uppercase text-success">Do</div>
                    <p className="text-[11px] italic leading-relaxed text-text-secondary">{good}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[10px] text-text-muted">
            Source:{' '}
            <a
              href="https://www.linkedin.com/business/talent/blog/talent-acquisition/job-descriptions-that-win"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-gold underline"
            >
              LinkedIn Talent Blog &mdash; Job Descriptions That Win
            </a>
          </p>
        </div>

        {/* ESCO Approach */}
        <div className="mb-8 rounded-xl border border-cat-skills/30 bg-white p-6">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-lg">&#x1F1EA;&#x1F1FA;</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-cat-skills">European Classification Framework</span>
          </div>
          <h2 className="mb-4 font-display text-xl font-bold text-text-primary">The ESCO Approach to Lean JDs</h2>

          <p className="mb-4 text-sm leading-relaxed text-text-secondary">
            ESCO (European Skills, Competences, Qualifications and Occupations) classifies 3,039 occupations
            and 13,939 skills across 28 languages. It provides a standardised vocabulary that eliminates
            ambiguity and wording inflation by anchoring every role to a validated taxonomy.
          </p>

          <div className="mb-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-cat-skills/20 bg-surface-page p-4">
              <h3 className="mb-2 text-xs font-bold text-cat-skills">Why ESCO matters for JDs</h3>
              <ul className="space-y-1.5 text-[11px] leading-relaxed text-text-secondary">
                <li>- Standardised skill language across EU &mdash; no more inventing competencies</li>
                <li>- Every occupation mapped to ISCO-08 &mdash; international comparability</li>
                <li>- Skills linked to qualifications &mdash; EQF levels replace vague &quot;degree required&quot;</li>
                <li>- Reusability levels (transversal, cross-sector, sector-specific) prevent skill sprawl</li>
                <li>- Eliminates title inflation &mdash; &quot;Senior Global VP&quot; maps to a real ESCO occupation</li>
              </ul>
            </div>
            <div className="rounded-lg border border-cat-skills/20 bg-surface-page p-4">
              <h3 className="mb-2 text-xs font-bold text-cat-skills">The lean JD formula</h3>
              <ul className="space-y-1.5 text-[11px] leading-relaxed text-text-secondary">
                <li><strong>1.</strong> Start with the ESCO occupation code (e.g., 2512 &mdash; Software Developer)</li>
                <li><strong>2.</strong> List only skills tagged as &quot;essential&quot; in ESCO for that occupation</li>
                <li><strong>3.</strong> Add 2&ndash;3 organisation-specific skills as &quot;optional&quot;</li>
                <li><strong>4.</strong> Use ESCO skill descriptions verbatim &mdash; they are already lean</li>
                <li><strong>5.</strong> Map qualifications to EQF levels, not degree names</li>
                <li><strong>6.</strong> Result: 60% shorter JDs with 100% of the meaningful content</li>
              </ul>
            </div>
          </div>

          <div className="rounded-lg bg-info-bg p-4 text-xs leading-relaxed text-info">
            <strong>JD Suite integration:</strong> When you use the JD Analyser, it automatically matches your role
            to the nearest ESCO occupation and ISCO-08 code, flagging skills that are inflated or missing
            from the standard classification. This is your first line of defence against wording inflation.
          </div>

          <p className="mt-4 text-[10px] text-text-muted">
            Source:{' '}
            <a
              href="https://esco.ec.europa.eu/en/about-esco/what-esco"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-gold underline"
            >
              European Commission &mdash; ESCO Classification
            </a>
          </p>
        </div>

        {/* Michael Armstrong */}
        <div className="mb-8 rounded-xl border border-brand-gold/30 bg-white p-6">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-brand-gold">
            Expert Perspective
          </div>
          <h2 className="mb-5 font-display text-xl font-bold text-text-primary">
            Michael Armstrong on Job Evaluation
          </h2>

          <div className="mb-6 flex gap-6">
            {/* Photo placeholder with stylised initials */}
            <div className="flex h-[140px] w-[120px] shrink-0 flex-col items-center justify-center rounded-xl bg-surface-header text-center">
              <div className="font-display text-3xl font-bold text-brand-gold-light">MA</div>
              <div className="mt-1 text-[8px] uppercase tracking-widest text-text-on-dark/50">
                Michael<br />Armstrong
              </div>
              <div className="mt-2 text-[7px] text-text-on-dark/30">CIPD Companion</div>
            </div>

            <div>
              <p className="mb-3 text-sm leading-relaxed text-text-secondary">
                <strong>Michael Armstrong</strong> is a UK-based HR thought leader and author specialising in
                reward management, strategic HRM, and performance management. He is best known for{' '}
                <em>Armstrong&apos;s Handbook of Reward Management Practice</em> and{' '}
                <em>Armstrong&apos;s Handbook of Human Resource Management Practice</em>, both widely used by HR
                professionals across Europe and internationally.
              </p>
              <p className="text-sm leading-relaxed text-text-secondary">
                His work has significantly influenced modern approaches to job evaluation, grading structures,
                and pay frameworks, particularly in analytical and competency-based systems.
                He is a Companion and former Chief Examiner of the CIPD, and his books have sold over a million
                copies in 21 languages.
              </p>
            </div>
          </div>

          {/* Key principles */}
          <div className="mb-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-brand-gold">
              Armstrong&apos;s principles for JD quality
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {[
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
              ].map(({ title, desc }) => (
                <div key={title} className="rounded-lg border border-brand-gold/15 bg-surface-page p-3.5">
                  <h4 className="mb-1 text-xs font-semibold text-text-primary">{title}</h4>
                  <p className="text-[11px] leading-relaxed text-text-secondary">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* The joke */}
          <div className="rounded-xl border-2 border-dashed border-brand-gold/30 bg-brand-gold-lighter p-5">
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-brand-gold">
              Industry humour
            </div>
            <div className="text-sm leading-relaxed text-text-primary">
              <p className="mb-3">
                Michael Armstrong is such a job evaluation expert that startupers message him on LinkedIn
                asking how to price a &quot;Senior Global Executive Vice Ultra Director.&quot;
              </p>
              <p className="mb-3">He replies politely:</p>
              <blockquote className="mb-3 border-l-[3px] border-brand-gold pl-4 font-display text-[15px] italic text-text-primary">
                &mdash; It&apos;s simple. If the title has more words than actual responsibilities,
                the valuation drops by half for every &quot;Global.&quot;
              </blockquote>
              <p>
                Apparently, ever since then, half of LinkedIn has shortened their job titles to just:{' '}
                <strong>&quot;Working.&quot;</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="mb-8 rounded-xl border border-success bg-success-bg p-6">
          <h2 className="mb-4 font-display text-xl font-bold text-success">
            The Lean JD Checklist
          </h2>
          <div className="grid gap-2 md:grid-cols-2">
            {[
              'Title matches ESCO/ISCO occupation (not inflated)',
              'Purpose statement is 2-3 sentences max',
              'Responsibilities use active verbs (6-10 items)',
              'Requirements split into must-have vs nice-to-have',
              'Skills use ESCO standard terminology',
              'Qualifications reference EQF levels, not just degrees',
              'Time allocation shown for major areas',
              'No buzzwords (synergy, leverage, paradigm, etc.)',
              'Written in second person ("you will...")',
              'Company description is max 1 sentence or linked',
              '6-month success criteria included',
              'Total length under 700 words',
              'All statements are auditable and verifiable',
              'Gender-neutral language throughout',
              'Working conditions stated (EU Directive 2023/970)',
              'Pay equity factors addressed (knowledge, effort, responsibility, conditions)',
            ].map((item) => (
              <label key={item} className="flex items-start gap-2 rounded-md bg-white p-2.5">
                <input type="checkbox" className="mt-0.5 shrink-0" />
                <span className="text-xs leading-relaxed text-text-primary">{item}</span>
              </label>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-xl border border-border-default bg-white p-6 text-center">
          <h2 className="mb-2 font-display text-lg font-bold text-text-primary">Ready to write a lean JD?</h2>
          <p className="mb-4 text-xs text-text-secondary">
            Use JD Analyser to check your existing JDs against ESCO standards, or start fresh with JD Builder.
          </p>
          <div className="flex justify-center gap-3">
            <a
              href="/analyse"
              className="inline-flex items-center gap-1.5 rounded-md bg-cat-skills px-5 py-2.5 text-sm font-medium text-white"
            >
              &#x2316; Analyse a JD
            </a>
            <a
              href="/jd/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-surface-header px-5 py-2.5 text-sm font-medium text-text-on-dark"
            >
              &#x2726; Build from scratch
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-[10px] leading-relaxed text-text-muted">
          JD Suite | EU Pay Transparency Directive 2023/970 | Built by{' '}
          <a
            href="https://www.linkedin.com/in/tomaszrey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-gold hover:underline"
          >
            Tomasz Rey
          </a>
          <br />
          Sources: LinkedIn Talent Solutions, ESCO/European Commission, Michael Armstrong &mdash; Handbook of Reward Management Practice
        </div>
      </div>
    </div>
  );
}
