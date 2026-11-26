import nodemailer from 'nodemailer';

/**
 * Transactional email.
 *
 * Configure either:
 *   EMAIL_USER + EMAIL_PASS                 (Gmail with an app password), or
 *   EMAIL_HOST + EMAIL_PORT + EMAIL_USER + EMAIL_PASS  (any SMTP provider)
 * Optional: EMAIL_FROM (address), EMAIL_FROM_NAME (default "Visit Ethiopia").
 */
export function isEmailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const auth = { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS };
  transporter = process.env.EMAIL_HOST
    ? nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT || 587),
        secure: Number(process.env.EMAIL_PORT) === 465,
        auth,
      })
    : nodemailer.createTransport({ service: 'Gmail', auth });
  return transporter;
}

const sendEmail = async (options) => {
  if (!isEmailConfigured()) {
    throw new Error('Email is not configured (EMAIL_USER/EMAIL_PASS missing)');
  }
  const fromName = process.env.EMAIL_FROM_NAME || 'Visit Ethiopia';
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  try {
    const info = await getTransporter().sendMail({
      from: `${fromName} <${fromAddress}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html,
    });
    console.log(`[email] sent "${options.subject}" (${info.messageId || 'ok'})`);
  } catch (err) {
    // Never log credentials or full SMTP transcripts.
    console.error(`[email] failed "${options.subject}": ${err.message}`);
    throw err;
  }
};

/** Fire-and-forget helper for non-critical notifications. */
export function sendEmailInBackground(options) {
  if (!isEmailConfigured()) return;
  sendEmail(options).catch(() => {});
}

export default sendEmail;
