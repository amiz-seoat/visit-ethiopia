import { useState } from 'react';
import {
  formatMoney,
  listAdminPayments,
  resolvePaymentReview,
  verifyPaymentNow,
  type AdminPaymentRow,
} from '../../../api/adminConsole';
import { getErrorMessage } from '../../../services/api';
import { PageLoader } from '../../ui/PageStatus';
import { Notice, PanelHeader, Pager, StatusBadge, fmtDate, inputCls, useAdminData } from './shared';

const STATUSES = ['', 'pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'];
const RESOLUTIONS = [
  { value: 'refunded_externally', label: 'Refunded outside the platform (e.g. Chapa dashboard)' },
  { value: 'customer_rebooked', label: 'Customer was rebooked / honoured' },
  { value: 'no_refund_due', label: 'No refund due' },
];

export function PaymentsPanel({ initialFlagged = false }: { initialFlagged?: boolean }) {
  const [flagged, setFlagged] = useState(initialFlagged);
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('');
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState('');
  const [actionError, setActionError] = useState('');
  const [resolving, setResolving] = useState<AdminPaymentRow | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  const { data, loading, error, reload } = useAdminData(
    () => listAdminPayments({ flagged: flagged ? 'true' : undefined, status, provider, page, limit: 25 }),
    [flagged, status, provider, page]
  );

  const verify = async (p: AdminPaymentRow) => {
    setVerifying(p._id);
    setActionError('');
    try {
      const r = await verifyPaymentNow(p._id);
      setMsg(`Chapa says: ${r.outcome}. Payment ${r.paymentStatus}, booking ${r.bookingStatus}.`);
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Verification failed'));
    } finally {
      setVerifying(null);
    }
  };

  return (
    <div>
      <PanelHeader title="Payments" subtitle="Provider payments, refunds and the late-payment review queue." />
      {msg && <Notice kind="success">{msg}</Notice>}
      {(error || actionError) && <Notice kind="error">{error || actionError}</Notice>}

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <div className="inline-flex rounded-md border overflow-hidden text-sm" role="group" aria-label="Queue">
          <button className={`px-3 py-1.5 ${!flagged ? 'bg-amber-100 text-amber-900 font-medium' : 'bg-white'}`} onClick={() => { setFlagged(false); setPage(1); }}>All payments</button>
          <button className={`px-3 py-1.5 border-l ${flagged ? 'bg-amber-100 text-amber-900 font-medium' : 'bg-white'}`} onClick={() => { setFlagged(true); setPage(1); }}>Needs refund review</button>
        </div>
        <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All statuses'}</option>)}
        </select>
        <select className={inputCls} value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1); }} aria-label="Provider">
          <option value="">All providers</option><option value="chapa">Chapa</option><option value="mock">Mock (demo)</option>
        </select>
      </div>

      {flagged && (
        <Notice kind="info">
          These payments succeeded after their booking hold had expired or the booking could not be confirmed, so the customer
          paid without a confirmed booking. Refund the customer (or rebook them), then record the decision here. Recording a
          decision does not move money.
        </Notice>
      )}

      {loading && !data ? <PageLoader message="Loading payments..." /> : data && (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2">Booking</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Created</th><th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((p) => (
                  <tr key={p._id} className={p.flagged ? 'bg-orange-50/40' : ''}>
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs">{p.bookingReference}</div>
                      <div className="text-xs text-gray-500">{p.itemTitle}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{p.customerEmail || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1 items-center">
                        <StatusBadge status={p.status} />
                        {p.flagged && <StatusBadge status="flagged" />}
                        <span className="text-xs text-gray-500">{p.provider}</span>
                      </div>
                      {p.bookingStatus && <div className="text-xs text-gray-500 mt-0.5">booking: {p.bookingStatus.replace(/_/g, ' ')}</div>}
                      {p.refundReview && (
                        <div className="text-xs text-gray-600 mt-0.5" title={p.refundReview.note}>
                          Reviewed {fmtDate(p.refundReview.resolvedAt)}: {p.refundReview.resolution.replace(/_/g, ' ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(p.amountMinor, p.currency)}
                      {p.amountRefundedMinor > 0 && <div className="text-xs text-blue-700">−{formatMoney(p.amountRefundedMinor, p.currency)}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fmtDate(p.createdAt, true)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap space-x-2">
                      {p.provider === 'chapa' && ['pending', 'processing', 'failed'].includes(p.status) && (
                        <button className="text-xs border rounded px-2 py-1 hover:bg-gray-50 disabled:opacity-50" disabled={verifying === p._id}
                          onClick={() => verify(p)}>{verifying === p._id ? 'Checking…' : 'Re-check with Chapa'}</button>
                      )}
                      {p.flagged && (
                        <button className="text-xs bg-amber-600 text-white rounded px-2 py-1 hover:bg-amber-700" onClick={() => setResolving(p)}>
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!data.data.length && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">{flagged ? 'Nothing waiting for review.' : 'No payments match these filters.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </>
      )}

      {resolving && (
        <ResolveDialog payment={resolving} onClose={() => setResolving(null)}
          onDone={() => { setResolving(null); setMsg('Review recorded.'); reload(); }} />
      )}
    </div>
  );
}

function ResolveDialog({ payment, onClose, onDone }: { payment: AdminPaymentRow; onClose: () => void; onDone: () => void }) {
  const [resolution, setResolution] = useState(RESOLUTIONS[0].value);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      await resolvePaymentReview(payment._id, { resolution, note });
      onDone();
    } catch (e) {
      setErr(getErrorMessage(e, 'Could not record the review'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Resolve payment review">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-1">Resolve review · {payment.bookingReference}</h3>
        <p className="text-sm text-gray-600 mb-3">{formatMoney(payment.amountMinor, payment.currency)} from {payment.customerEmail || 'unknown customer'}</p>
        {err && <Notice kind="error">{err}</Notice>}
        <fieldset className="space-y-1.5 mb-3">
          {RESOLUTIONS.map((r) => (
            <label key={r.value} className="flex gap-2 text-sm items-start">
              <input type="radio" name="resolution" value={r.value} checked={resolution === r.value} onChange={() => setResolution(r.value)} className="mt-1" />
              {r.label}
            </label>
          ))}
        </fieldset>
        <textarea className={`${inputCls} w-full`} rows={3} maxLength={500} placeholder="Note (required): what was done, provider reference…"
          value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 py-1.5 text-sm border rounded-md" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md disabled:opacity-50" disabled={busy || !note.trim()} onClick={submit}>
            {busy ? 'Saving…' : 'Record decision'}
          </button>
        </div>
      </div>
    </div>
  );
}
