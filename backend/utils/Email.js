import nodemailer from 'nodemailer';

/**
 * Transactional email (verification, password reset, booking confirmations).
 *
 * Two transports, chosen automatically:
 *
 *  1. Brevo HTTPS API (recommended on Render free instances, which block
 *     outbound SMTP ports 25/465/587):
 *       BREVO_API_KEY  — from https://app.brevo.com/settings/keys/api
 *       EMAIL_FROM     — a sender address verified in Brevo (falls back to EMAIL_USER)
 *
 *  2. SMTP via nodemailer (local development, paid hosting):
 *       EMAIL_USER + EMAIL_PASS                        (Gmail with an app password), or
 *       EMAIL_HOST + EMAIL_PORT + EMAIL_USER + EMAIL_PASS  (any SMTP provider)
 *
 * Optional: EMAIL_FROM_NAME (default "Visit Ethiopia").
 * Credentials are never logged.
 */

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS) || 15000;

export function emailTransport() {
  if (process.env.BREVO_API_KEY && (process.env.EMAIL_FROM || process.env.EMAIL_USER)) return 'brevo';
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) return 'smtp';
  return null;
}

export function isEmailConfigured() {
  return emailTransport() !== null;
}

/** Test hook: replace fetch for the Brevo transport. */
let httpTransport = (...args) => fetch(...args);
export function setEmailHttpTransport(fn) {
  httpTransport = fn || ((...args) => fetch(...args));
}

async function sendViaBrevo({ fromName, fromAddress, to, subject, text, html }) {
  let res;
  try {
    res = await httpTransport(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromAddress },
        to: [{ email: to }],
        subject,
        ...(html ? { htmlContent: html } : {}),
        ...(text ? { textContent: text } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(err?.name === 'TimeoutError' ? 'Brevo request timed out' : 'Brevo request failed');
  }
  if (!res.ok) {
    // Brevo error bodies are safe (code + message, no credentials) and say what to fix,
    // e.g. "unauthorized" (bad key) or "sender not valid" (sender not verified).
    let detail = '';
    try {
      const body = await res.json();
      detail = [body.code, body.message].filter(Boolean).join(': ').slice(0, 200);
    } catch {
      /* ignore */
    }
    throw new Error(`Brevo returned ${res.status}${detail ? ` (${detail})` : ''}`);
  }
  const body = await res.json().catch(() => ({}));
  return body.messageId || 'ok';
}

let transporter = null;
function getSmtpTransporter() {
  if (transporter) return transporter;
  const auth = { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS };
  // Fail fast instead of hanging the request for minutes when SMTP is blocked.
  const timeouts = { connectionTimeout: TIMEOUT_MS, greetingTimeout: TIMEOUT_MS, socketTimeout: TIMEOUT_MS };
  transporter = process.env.EMAIL_HOST
    ? nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT || 587),
        secure: Number(process.env.EMAIL_PORT) === 465,
        auth,
        ...timeouts,
      })
    : nodemailer.createTransport({ service: 'Gmail', auth, ...timeouts });
  return transporter;
}

const sendEmail = async (options) => {
  const transport = emailTransport();
  if (!transport) {
    throw new Error('Email is not configured (set BREVO_API_KEY + EMAIL_FROM, or EMAIL_USER/EMAIL_PASS)');
  }
  const fromName = process.env.EMAIL_FROM_NAME || 'Visit Ethiopia';
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  try {
    let id;
    if (transport === 'brevo') {
      id = await sendViaBrevo({
        fromName,
        fromAddress,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html,
      });
    } else {
      const info = await getSmtpTransporter().sendMail({
        from: `${fromName} <${fromAddress}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html,
      });
      id = info.messageId || 'ok';
    }
    console.log(`[email] sent "${options.subject}" via ${transport} (${id})`);
  } catch (err) {
    // Never log credentials or full SMTP transcripts.
    console.error(`[email] failed "${options.subject}" via ${transport}: ${err.message}`);
    throw err;
  }
};

/** Fire-and-forget helper for non-critical notifications. */
export function sendEmailInBackground(options) {
  if (!isEmailConfigured()) return;
  sendEmail(options).catch(() => {});
}

export default sendEmail;
