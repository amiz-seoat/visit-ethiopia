import { useEffect, useState } from 'react';
import { MailCheck, RefreshCw } from 'lucide-react';
import { resendVerificationEmail } from '../../api/auth';
import { getErrorMessage } from '../../services/api';

const COOLDOWN_S = 60;

/**
 * "Check your inbox" panel with a resend button (60 s cooldown).
 * Used after signup and when an unverified user tries to sign in.
 */
export function VerifyEmailNotice({
  email,
  title = 'Verify your email to continue',
  intro,
  tone = 'amber',
}: {
  email: string;
  title?: string;
  intro?: string;
  tone?: 'amber' | 'green';
}) {
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async () => {
    setSending(true);
    setError('');
    setSentMsg('');
    try {
      const msg = await resendVerificationEmail(email);
      setSentMsg(msg || 'A new verification link is on its way.');
      setCooldown(COOLDOWN_S);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send the email. Please try again shortly.'));
    } finally {
      setSending(false);
    }
  };

  const box =
    tone === 'green'
      ? 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100'
      : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100';

  return (
    <div className={`mb-5 rounded-lg border p-4 text-sm ${box}`} role="status" aria-live="polite">
      <div className="flex gap-3">
        <MailCheck className="mt-0.5 shrink-0" size={20} aria-hidden />
        <div className="space-y-2">
          <p className="font-semibold">{title}</p>
          <p>
            {intro ?? 'We sent a verification link to'}{' '}
            <span className="font-medium break-all">{email}</span>. Open it to activate your account. The link is
            valid for 24 hours.
          </p>
          <ul className="list-disc pl-5 space-y-0.5 opacity-90">
            <li>Can&apos;t find it? Check your spam or promotions folder.</li>
            <li>Make sure the email address above is correct.</li>
          </ul>
          {sentMsg && <p className="font-medium">{sentMsg}</p>}
          {error && <p className="text-red-700 dark:text-red-300">{error}</p>}
          <button
            type="button"
            onClick={resend}
            disabled={sending || cooldown > 0}
            className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
          >
            <RefreshCw size={14} className={sending ? 'animate-spin' : ''} aria-hidden />
            {sending ? 'Sending…' : cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend verification email'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailNotice;
