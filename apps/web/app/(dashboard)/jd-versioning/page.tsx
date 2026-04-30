import Link from 'next/link';

export const metadata = { title: 'Job Descriptions Versioning — JD Suite' };

export default function JDVersioningPage() {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[980px]">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">
          Final Review
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
          Job Descriptions Versioning
        </h1>
        <p className="mt-2 max-w-[680px] text-[14px] leading-relaxed text-text-secondary">
          Compare any two snapshots of a job description, two different JDs side by side,
          or pasted text against an existing JD. Used for sign-off, audit, and tracking
          drift between approved and live versions.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Link
            href="/compare"
            className="group rounded-xl border border-border-default bg-white p-5 transition-all hover:border-brand-gold hover:shadow-sm"
          >
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-brand-gold">
              ⇄ Version diff
            </div>
            <h2 className="font-display text-base font-semibold text-text-primary group-hover:text-brand-gold">
              Compare versions of one JD
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted">
              Pick two snapshots of the same JD from its history. Field-level diff shows what
              changed, who changed it, and when. Use this for sign-off or audit replay.
            </p>
          </Link>

          <Link
            href="/compare/text"
            className="group rounded-xl border border-border-default bg-white p-5 transition-all hover:border-brand-gold hover:shadow-sm"
          >
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-brand-gold">
              ⇌ Text diff
            </div>
            <h2 className="font-display text-base font-semibold text-text-primary group-hover:text-brand-gold">
              Compare two JD texts
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted">
              Quick text diff between any two JDs in your library, or pasted text against an
              existing JD. Useful when comparing a draft to its prior approved version, or
              spotting drift from a template.
            </p>
          </Link>
        </div>

        <div className="mt-6 rounded-lg border border-info/20 bg-info-bg/40 p-4 text-[12px] text-info">
          <strong>Audit trail.</strong> Every JD operation (field edit, AI assist, status change,
          export, evaluation) is timestamped with author and stored in the JD&apos;s version
          history. Open any JD and use the version history panel to see the full chain.
        </div>
      </div>
    </div>
  );
}
