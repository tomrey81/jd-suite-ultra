import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'JD Suite — Job descriptions, built for Total Rewards',
  description:
    'A working environment for Total Rewards experts. Author, audit, and benchmark job descriptions aligned to the EU Pay Transparency Directive 2023/970.',
};

export const dynamic = 'force-dynamic';

export default async function WelcomePage() {
  const session = await auth();
  const isSignedIn = !!session?.user?.id;
  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#1A1A1A]">
      {/* Top bar */}
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5">
        <div className="font-display text-lg font-semibold tracking-tight">JD Suite</div>
        <nav className="flex items-center gap-2">
          {isSignedIn ? (
            <Link
              href="/"
              className="rounded-md bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white hover:bg-black"
            >
              Open JD Suite →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-4 py-2 text-sm font-medium text-[#1A1A1A] hover:bg-black/5"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-[#8A7560] px-4 py-2 text-sm font-medium text-white hover:bg-[#6f5d4c]"
              >
                Request access
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-6 py-16 md:grid-cols-[1.1fr_0.9fr] md:gap-14 md:py-24">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[#8A7560]/30 bg-white/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A7560]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#8A7560]" />
              Early access — by invitation
            </div>
            <h1 className="font-display text-[44px] font-semibold leading-[1.05] tracking-tight md:text-[58px]">
              Job descriptions,
              <br />
              <span className="italic text-[#8A7560]">built for</span>{' '}
              Total Rewards.
            </h1>
            <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-[#3A3A3A]">
              A working environment for compensation, reward and HR experts.
              Author, audit, and benchmark job descriptions aligned to the
              EU Pay Transparency Directive 2023/970 — without templates that
              fight you, and without spreadsheets that drift.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {isSignedIn ? (
                <Link
                  href="/"
                  className="rounded-md bg-[#1A1A1A] px-5 py-3 text-sm font-medium text-white transition-transform hover:scale-[1.02] hover:bg-black"
                >
                  Open JD Suite →
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="rounded-md bg-[#1A1A1A] px-5 py-3 text-sm font-medium text-white transition-transform hover:scale-[1.02] hover:bg-black"
                  >
                    Request access →
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-md border border-[#1A1A1A]/15 px-5 py-3 text-sm font-medium text-[#1A1A1A] hover:border-[#1A1A1A]/40"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.14em] text-[#6E6E6E]">
              <span>EU Pay Transparency 2023/970</span>
              <span className="h-1 w-1 rounded-full bg-[#8A7560]/40" />
              <span>WorldatWork-aligned grading</span>
              <span className="h-1 w-1 rounded-full bg-[#8A7560]/40" />
              <span>Audit-trailed</span>
            </div>
          </div>

          {/* Visual: layered geometric panel */}
          <div className="relative isolate flex aspect-[4/5] items-center justify-center md:aspect-auto md:min-h-[520px]">
            {/* Background gradient blob */}
            <div
              aria-hidden
              className="absolute inset-0 -z-20 rounded-[28px]"
              style={{
                background:
                  'radial-gradient(120% 80% at 80% 20%, #E9D9C0 0%, #D9BFA0 35%, #8A7560 70%, #2D2218 100%)',
              }}
            />
            {/* Diagonal accent */}
            <div
              aria-hidden
              className="absolute inset-x-6 top-6 -z-10 h-[40%] rotate-[-3deg] rounded-[20px] bg-[#1A1A1A] mix-blend-multiply opacity-30"
            />
            {/* Floating "card" */}
            <div className="relative z-10 w-[88%] max-w-[420px] rounded-2xl border border-white/40 bg-white/95 p-6 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-[#8A7560]">
                <span>Sample · EUPTD Enterprises</span>
                <span className="rounded-full bg-[#8A7560]/10 px-2 py-0.5">DC 84%</span>
              </div>
              <div className="font-display text-[22px] font-semibold leading-tight italic">
                Total Rewards Manager
              </div>
              <div className="mt-1 text-[12px] text-[#6E6E6E]">
                EUPTD Enterprises Studios · EMEA
              </div>
              <hr className="my-4 border-[#1A1A1A]/10" />
              <ul className="space-y-2 text-[12px] leading-relaxed text-[#3A3A3A]">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#8A7560]" />
                  Designs annual reward strategy across 6 entities
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#8A7560]" />
                  Owns pay transparency reporting (Art. 9, EUPTD)
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#8A7560]" />
                  Partners with finance on incentive plan modelling
                </li>
              </ul>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-[#FAF7F2] p-2">
                  <div className="text-[9px] uppercase tracking-wider text-[#6E6E6E]">Grade</div>
                  <div className="text-sm font-bold text-[#1A1A1A]">G14</div>
                </div>
                <div className="rounded-md bg-[#FAF7F2] p-2">
                  <div className="text-[9px] uppercase tracking-wider text-[#6E6E6E]">Family</div>
                  <div className="text-sm font-bold text-[#1A1A1A]">HR</div>
                </div>
                <div className="rounded-md bg-[#FAF7F2] p-2">
                  <div className="text-[9px] uppercase tracking-wider text-[#6E6E6E]">Audit</div>
                  <div className="text-sm font-bold text-[#1A1A1A]">12</div>
                </div>
              </div>
            </div>
            {/* Floating tag below */}
            <div className="absolute bottom-6 left-6 z-20 hidden rounded-full bg-[#1A1A1A] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white md:block">
              Built by Total Rewards · for Total Rewards
            </div>
          </div>
        </div>
      </section>

      {/* Three-column value props */}
      <section className="border-y border-black/5 bg-white">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-6 py-16 md:grid-cols-3 md:gap-12">
          {[
            {
              k: '01',
              t: 'Compliance, baked-in',
              d: 'Every JD is anchored to ISCO-08, ESCO and the EU Pay Transparency Directive — so audits don\'t become rewrites.',
            },
            {
              k: '02',
              t: 'A library that learns',
              d: 'Sample JDs you can fork, an AI editor that respects your house style, and pay groups that surface inconsistencies.',
            },
            {
              k: '03',
              t: 'Studio-grade outputs',
              d: 'Print-ready PDFs, .docx exports, audit history, and guest-review tokens. No spreadsheet drift.',
            },
          ].map((b) => (
            <div key={b.k}>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8A7560]">
                {b.k}
              </div>
              <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">{b.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#3A3A3A]">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-6 py-20 text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Total Rewards experts —{' '}
          <span className="italic text-[#8A7560]">come build with us.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-[560px] text-[15px] text-[#3A3A3A]">
          Access is invitation-only while we shape the platform with practitioners.
          Have an access code? Create your account in under a minute.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {isSignedIn ? (
            <Link
              href="/"
              className="rounded-md bg-[#1A1A1A] px-5 py-3 text-sm font-medium text-white hover:bg-black"
            >
              Open JD Suite →
            </Link>
          ) : (
            <Link
              href="/register"
              className="rounded-md bg-[#1A1A1A] px-5 py-3 text-sm font-medium text-white hover:bg-black"
            >
              Request access →
            </Link>
          )}
          <a
            href="https://www.linkedin.com/in/tomaszrey"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-[#1A1A1A]/15 px-5 py-3 text-sm font-medium hover:border-[#1A1A1A]/40"
          >
            Connect with Tomasz on LinkedIn
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-3 px-6 py-6 text-[11px] text-[#6E6E6E] md:flex-row">
          <div>JD Suite · {new Date().getFullYear()}</div>
          <div>
            Built by{' '}
            <a
              href="https://www.linkedin.com/in/tomaszrey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#8A7560] hover:underline"
            >
              Tomasz Rey
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
