import Link from 'next/link';

export const metadata = { title: 'JD Suite v5' };

const PHASES = [
  {
    id: 'P0a',
    label: 'Bias check',
    href: '/v5/bias-check',
    desc: '4-layer bias engine (lexical + title + EIGE + Iceland implicit) with opt-in policy packs (ÍST 85, NZ Pay Equity, UK Birmingham). EN + PL.',
  },
  {
    id: 'P0e',
    label: 'Library hierarchy',
    href: '/v5/library',
    desc: 'Family + Function + Level browser across every JD in your organisations. Multi-facet filters, status overlays, deep-links to admin.',
  },
  {
    id: 'P0f',
    label: 'Policy packs',
    href: '/v5/bias-check?packs=ist85,nz-payequity,uk-birmingham',
    desc: 'ÍST 85 (Iceland), NZ Pay Equity, UK Birmingham bonus rules — composable on top of the bias check.',
  },
];

export default function V5Home() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] p-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A7560]">
          Parallel module · runs alongside JD Suite v4
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[#1A1A1A]">
          JD Suite <span className="italic text-[#8A7560]">v5</span>
        </h1>
        <p className="mt-2 max-w-[700px] text-[14px] leading-relaxed text-[#55524A]">
          The workspace where job descriptions become regulator-defensible.
          Built against the EU Pay Transparency Directive 2023/970 with
          first-class gender-bias detection per Gaucher 2011, EIGE, and Iceland 2024.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {PHASES.map((p) => (
            <Link
              key={p.id}
              href={p.href}
              className="block rounded-lg border border-[#8A7560] bg-white p-4 transition hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[#1A1A1A] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                    shipped
                  </span>
                  <span className="text-[10px] font-mono text-[#55524A]">{p.id}</span>
                </div>
                <span className="text-[11px] font-medium text-[#8A7560]">Open →</span>
              </div>
              <div className="mt-2 font-display text-[15px] font-semibold text-[#1A1A1A]">
                {p.label}
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-[#55524A]">{p.desc}</div>
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-[#E0DBD4] bg-white p-4 text-[12px] text-[#55524A]">
          v4 (the existing JD Suite) keeps running at the regular sidebar links — admin, JDs,
          orgs, pay groups, audit. v5 adds bias-check + library hierarchy as parallel previews
          at <code>/v5/*</code>. Future phases will be added here only when they are real and
          working.
        </div>
      </div>
    </div>
  );
}
