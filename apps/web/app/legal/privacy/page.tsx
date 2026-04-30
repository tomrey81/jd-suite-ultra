export const metadata = { title: 'JD Suite — Privacy Policy' };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2] p-8">
      <div className="mx-auto max-w-[760px] rounded-xl bg-white p-10 shadow-sm">
        <a href="/" className="text-[11px] text-[#8A7560] hover:underline">← Back</a>
        <h1 className="mt-4 font-display text-3xl font-semibold text-[#1A1A1A]">Privacy Policy</h1>
        <p className="mt-1 text-[11px] uppercase tracking-widest text-[#8A7560]">v0.1 · effective 2026-04-29 · GDPR-aligned</p>

        <div className="prose mt-6 space-y-4 text-[14px] leading-relaxed text-[#3A3A3A]">
          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">1. Controller</h2>
          <p>
            Tomasz Rey is the data controller for JD Suite during early access. Contact:
            <a href="https://www.linkedin.com/in/tomaszrey" className="text-[#8A7560]"> linkedin.com/in/tomaszrey</a>.
          </p>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">2. What we collect</h2>
          <ul className="list-disc pl-5">
            <li>Account data: name, corporate email, country, function, organisation, hashed password.</li>
            <li>Consents: timestamped acceptance of these terms, GDPR processing, marketing &amp; newsletter opt-ins.</li>
            <li>Usage: pages viewed, features used, errors encountered (server logs).</li>
            <li>Content: job descriptions, organisation documents, audit-trail entries you create.</li>
          </ul>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">3. Lawful basis (GDPR Art. 6)</h2>
          <ul className="list-disc pl-5">
            <li><strong>Art. 6(1)(b)</strong> — performance of contract: account data, your content.</li>
            <li><strong>Art. 6(1)(a)</strong> — your consent: marketing emails, newsletter.</li>
            <li><strong>Art. 6(1)(f)</strong> — legitimate interest: anti-abuse logs, rate limits.</li>
          </ul>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">4. Sub-processors</h2>
          <ul className="list-disc pl-5">
            <li><strong>Vercel</strong> (hosting, EU region).</li>
            <li><strong>Neon</strong> (Postgres database, EU region).</li>
            <li><strong>Anthropic</strong> (Claude AI). Your prompts are sent to the EU endpoint.
              Anthropic does not retain inputs/outputs for training under our enterprise terms.</li>
            <li><strong>Resend</strong> (transactional email, when configured).</li>
          </ul>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">5. Retention</h2>
          <p>
            Account &amp; content data: until you delete your account, then 30 days for backup
            recovery. Audit-trail entries: 7 years (compliance with EUPTD record-keeping). Marketing
            consents: until withdrawn, plus 90 days proof-of-withdrawal.
          </p>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">6. Your rights</h2>
          <p>
            You can request access, rectification, deletion, restriction, portability, and
            objection at any time. Email <a href="https://www.linkedin.com/in/tomaszrey" className="text-[#8A7560]">Tomasz</a>;
            we respond within 30 days. You also have the right to lodge a complaint with your
            supervisory authority.
          </p>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">7. Marketing consent</h2>
          <p>
            We send marketing emails and newsletters only to people who opted in. Each email has an
            unsubscribe link; one click ends future sends. You can also flip the toggles in
            Settings, or email us.
          </p>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">8. Security</h2>
          <p>
            HTTPS everywhere. Passwords hashed with bcrypt (12 rounds). Magic-link &amp;
            password-reset tokens stored as SHA-256 hashes only, expire in minutes, single-use.
            EU-resident data, encrypted at rest by the database provider.
          </p>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">9. Cookies</h2>
          <p>
            One essential cookie holds your session (HTTP-only, secure, SameSite=lax). No tracking
            or analytics cookies during early access.
          </p>

          <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">10. Changes</h2>
          <p>
            Material changes are announced in-app and emailed at least 14 days before they apply.
            The effective date above is updated on every change.
          </p>
        </div>
      </div>
    </main>
  );
}
