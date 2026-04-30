const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

transporter.verify()
  .then(() => console.log('✓ SMTP connected'))
  .catch(err => console.warn('⚠ SMTP not configured:', err.message));

// Strip CR/LF from any value interpolated into a header (defense in depth
// even though nodemailer's MIME encoder normalizes line breaks).
const headerSafe = (s) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ');

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function sendSubmissionNotification(submission) {
  const safeName = headerSafe(submission.name);
  return transporter.sendMail({
    from: `"Admin Panel" <${process.env.SMTP_USER}>`,
    to: process.env.NOTIFICATION_EMAIL,
    replyTo: submission.email,
    subject: `New submission: ${safeName}`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;padding:24px">
        <h2 style="margin:0 0 16px">New submission</h2>
        <p><b>Name:</b> ${escapeHtml(submission.name)}</p>
        <p><b>Email:</b> <a href="mailto:${escapeHtml(submission.email)}">${escapeHtml(submission.email)}</a></p>
        <p><b>Subject:</b> ${escapeHtml(submission.subject || '—')}</p>
        ${submission.message ? `<div style="margin-top:16px;padding:12px;background:#f5f5f5;border-left:3px solid #444"><p style="white-space:pre-wrap;margin:0">${escapeHtml(submission.message)}</p></div>` : ''}
        <p style="margin-top:24px;color:#888;font-size:12px">${new Date().toISOString()}</p>
      </div>
    `,
  });
}

async function sendPasswordChangeConfirmation(token, baseUrl) {
  const link = `${baseUrl}/api/admin/confirm-password?token=${encodeURIComponent(token)}`;
  return transporter.sendMail({
    from: `"Admin Panel" <${process.env.SMTP_USER}>`,
    to: process.env.NOTIFICATION_EMAIL,
    subject: 'Confirm admin password change',
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2>Confirm password change</h2>
        <p>Someone (you, hopefully) requested an admin password change.</p>
        <p>Click the link below within 30 minutes to confirm. If you didn't request this, ignore this email.</p>
        <p style="margin:24px 0">
          <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:4px">Confirm change</a>
        </p>
        <p style="color:#888;font-size:12px">Or copy this URL: ${escapeHtml(link)}</p>
      </div>
    `,
  });
}

module.exports = { sendSubmissionNotification, sendPasswordChangeConfirmation };
