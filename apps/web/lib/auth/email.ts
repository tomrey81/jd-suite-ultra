// Minimal email sender. Uses Resend if RESEND_API_KEY is set, otherwise
// logs the message to stdout (so dev/CI works without external creds).
//
// The API surface is intentionally tiny: send({ to, subject, html, text }).
// Swap providers later by changing only this file.

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const FROM = process.env.MAIL_FROM || 'JD Suite <onboarding@resend.dev>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://jd-suite-pro.vercel.app';

export async function sendEmail(args: SendArgs): Promise<{ ok: boolean; provider: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Dev mode: log instead of send. Crucially, this means the magic link
    // appears in the Vercel logs — usable for self-service smoke tests.
    // eslint-disable-next-line no-console
    console.warn('[mail] RESEND_API_KEY not set — message not sent. Logging instead.');
    // eslint-disable-next-line no-console
    console.log(`[mail][to=${args.to}] ${args.subject}\n${args.text}`);
    return { ok: true, provider: 'console' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, provider: 'resend', error: data?.message || `HTTP ${res.status}` };
    }
    return { ok: true, provider: 'resend' };
  } catch (err) {
    return { ok: false, provider: 'resend', error: (err as Error).message };
  }
}

export const ResetEmail = {
  subject: 'JD Suite — reset your password',
  text: (link: string) =>
    `Hi,

We received a request to reset your JD Suite password. Click the link below to set a new password:

${link}

This link expires in 30 minutes. If you didn't request a reset, ignore this email — your account stays as it is.

— JD Suite, built by Tomasz Rey
${APP_URL}`,
  html: (link: string) => `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background:#FAF7F2; color:#1A1A1A;">
  <div style="font-family: Georgia, serif; font-size: 24px; font-weight: 600; margin-bottom: 8px;">JD Suite</div>
  <p style="font-size: 14px; line-height: 1.6;">
    We received a request to reset your password. Click the button below to set a new one.
  </p>
  <p style="margin: 28px 0;">
    <a href="${link}" style="display: inline-block; background: #1A1A1A; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">Reset password →</a>
  </p>
  <p style="font-size: 12px; color: #55524A; line-height: 1.5;">
    This link expires in 30 minutes. If you didn't request a reset, ignore this email.<br />
    Or copy and paste this URL: <span style="word-break:break-all;">${link}</span>
  </p>
  <hr style="border: 0; border-top: 1px solid #E0DBD4; margin: 24px 0;" />
  <p style="font-size: 11px; color: #8A7560;">
    Built by <a href="https://www.linkedin.com/in/tomaszrey" style="color: #8A7560;">Tomasz Rey</a>
  </p>
</div>`,
};

export const MagicLinkEmail = {
  subject: 'JD Suite — your sign-in link',
  text: (link: string) =>
    `Hi,

Click the link below to sign in to JD Suite:

${link}

This link expires in 15 minutes and can be used once. If you didn't request it, ignore this email.

— JD Suite, built by Tomasz Rey
${APP_URL}`,
  html: (link: string) => `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background:#FAF7F2; color:#1A1A1A;">
  <div style="font-family: Georgia, serif; font-size: 24px; font-weight: 600; margin-bottom: 8px;">JD Suite</div>
  <p style="font-size: 14px; line-height: 1.6;">
    Click below to sign in. No password needed.
  </p>
  <p style="margin: 28px 0;">
    <a href="${link}" style="display: inline-block; background: #8A7560; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">Sign in →</a>
  </p>
  <p style="font-size: 12px; color: #55524A; line-height: 1.5;">
    This link expires in 15 minutes and can be used once. If you didn't request it, ignore this email.<br />
    Or copy and paste this URL: <span style="word-break:break-all;">${link}</span>
  </p>
  <hr style="border: 0; border-top: 1px solid #E0DBD4; margin: 24px 0;" />
  <p style="font-size: 11px; color: #8A7560;">
    Built by <a href="https://www.linkedin.com/in/tomaszrey" style="color: #8A7560;">Tomasz Rey</a>
  </p>
</div>`,
};
