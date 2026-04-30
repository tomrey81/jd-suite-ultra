export const metadata = { title: 'JD Suite — Terms of Service' };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2] p-8">
      <div className="mx-auto max-w-[760px] rounded-xl bg-white p-10 shadow-sm">
        <a href="/" className="text-[11px] text-[#8A7560] hover:underline">← Back</a>
        <h1 className="mt-4 font-display text-3xl font-semibold text-[#1A1A1A]">Terms of Service</h1>
        <p className="mt-1 text-[11px] uppercase tracking-widest text-[#8A7560]">v0.1 · effective 2026-04-29</p>

        <div className="prose mt-6 space-y-4 text-[14px] leading-relaxed text-[#3A3A3A]">
          <p>
            JD Suite is a private-beta workspace for Total Rewards experts. By creating an account,
            you accept these terms. The product is provided as-is during early access. We may change
            features, schemas, or pricing at any time before general availability, with notice in-app.
          </p>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">1. Account & access</h2>
          <p>
            Access is by invitation. You are responsible for keeping your credentials secret and for
            all activity on your account. Sharing accounts is not permitted. Notify us immediately of
            unauthorised access.
          </p>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">2. Your content</h2>
          <p>
            Job descriptions, organisation data, and supporting documents you upload remain yours.
            We do not use your content to train third-party models. We process it only to provide
            the service: parsing, scoring, audit trail, exports.
          </p>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">3. Acceptable use</h2>
          <p>
            Don&apos;t use JD Suite to draft job descriptions for illegal positions, to harass
            employees or candidates, or to circumvent applicable labour or pay-equity law.
          </p>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">4. AI assistance</h2>
          <p>
            JD Suite uses Anthropic Claude for analysis and suggestions. AI output is suggested,
            never auto-applied. You are accountable for any text you accept into a published JD.
          </p>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">5. Limits of liability</h2>
          <p>
            JD Suite is a tool that helps you produce defensible JDs. It does not constitute legal
            advice. Always consult qualified counsel for labour-law and EUPTD compliance decisions.
            To the maximum extent permitted by law, our aggregate liability is limited to the fees
            paid (during early access: zero).
          </p>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">6. Changes</h2>
          <p>
            We&apos;ll post material changes in-app and email you via the address on file at least
            14 days before they take effect. Continued use after the effective date means acceptance.
          </p>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">7. Contact</h2>
          <p>
            Tomasz Rey — <a href="https://www.linkedin.com/in/tomaszrey" className="text-[#8A7560]">linkedin.com/in/tomaszrey</a>.
            For data-protection requests, see the Privacy Policy.
          </p>
        </div>
      </div>
    </main>
  );
}
