import { useState } from 'react';
import { X } from 'lucide-react';
import {
  formatMoney,
  getAdminBookingDetail,
  listAdminBookings,
} from '../../../api/adminConsole';
import { cancelBooking } from '../../../api/bookings';
import { getErrorMessage } from '../../../services/api';
import { PageLoader } from '../../ui/PageStatus';
import {
  Notice, PanelHeader, Pager, StatusBadge, fmtDate, inputCls, useAdminData, useDebounced,
} from './shared';

const STATUSES = ['', 'payment_pending', 'pending', 'confirmed', 'completed', 'cancelled', 'partially_refunded', 'expired', 'failed'];
const TYPES = ['', 'tour', 'hotel', 'transport'];
const CANCELLABLE = ['payment_pending', 'pending', 'confirmed'];

export function BookingsPanel({ initialStatus = '' }: { initialStatus?: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const q = useDebounced(search);

  const { data, loading, error, reload } = useAdminData(
    () => listAdminBookings({ status, type, search: q, from, to: to ? `${to}T23:59:59Z` : '', page, limit: 25 }),
    [status, type, q, from, to, page]
  );
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  return (
    <div>
      <PanelHeader title="Bookings" subtitle="Every booking on the platform. Status changes follow the payment lifecycle; use Cancel / refund for exceptions." />
      {msg && <Notice kind="success">{msg}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <div className="flex flex-wrap gap-2 mb-3">
        <input className={`${inputCls} w-64`} placeholder="Search email, name or reference…" value={search}
          onChange={(e) => reset(setSearch)(e.target.value)} aria-label="Search bookings" />
        <select className={inputCls} value={status} onChange={(e) => reset(setStatus)(e.target.value)} aria-label="Status">
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All statuses'}</option>)}
        </select>
        <select className={inputCls} value={type} onChange={(e) => reset(setType)(e.target.value)} aria-label="Type">
          {TYPES.map((s) => <option key={s} value={s}>{s || 'All types'}</option>)}
        </select>
        <label className="text-xs text-gray-500 flex items-center gap-1">From
          <input type="date" className={inputCls} value={from} onChange={(e) => reset(setFrom)(e.target.value)} /></label>
        <label className="text-xs text-gray-500 flex items-center gap-1">To
          <input type="date" className={inputCls} value={to} onChange={(e) => reset(setTo)(e.target.value)} /></label>
      </div>

      {loading && !data ? <PageLoader message="Loading bookings..." /> : data && (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2">Ref</th><th className="px-3 py-2">Listing</th><th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Status</th><th className="px-3 py-2">Payment</th><th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((b) => (
                  <tr key={b._id} className="hover:bg-amber-50/40 cursor-pointer" onClick={() => setOpenId(b._id)}>
                    <td className="px-3 py-2 font-mono text-xs">{b.reference}</td>
                    <td className="px-3 py-2"><div className="font-medium text-gray-900">{b.itemTitle}</div><div className="text-xs text-gray-500 capitalize">{b.bookingType}</div></td>
                    <td className="px-3 py-2"><div>{b.customer?.name || '—'}</div><div className="text-xs text-gray-500">{b.customer?.email}</div></td>
                    <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                    <td className="px-3 py-2">
                      {b.payment ? (
                        <div className="flex flex-wrap gap-1 items-center">
                          <StatusBadge status={b.payment.status} />
                          {b.payment.flagged && <StatusBadge status="flagged" />}
                          <span className="text-xs text-gray-500">{b.payment.provider}</span>
                        </div>
                      ) : <span className="text-xs text-gray-400">none</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(b.totalMinor, b.currency)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fmtDate(b.createdAt, true)}</td>
                  </tr>
                ))}
                {!data.data.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">No bookings match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </>
      )}

      {openId && (
        <BookingDrawer id={openId} onClose={() => setOpenId(null)}
          onChanged={(m) => { setMsg(m); reload(); }} />
      )}
    </div>
  );
}

function BookingDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: (msg: string) => void }) {
  const { data: b, loading, error, reload } = useAdminData(() => getAdminBookingDetail(id), [id]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const doCancel = async () => {
    if (!b) return;
    const paid = b.payments?.some((p: any) => p.status === 'completed');
    const ok = window.confirm(
      paid
        ? 'Cancel this paid booking? The refund policy amount will be refunded to the customer through the payment provider. This cannot be undone.'
        : 'Cancel this booking and release its inventory? This cannot be undone.'
    );
    if (!ok) return;
    setBusy(true);
    setActionError('');
    try {
      const res = await cancelBooking(id, { reason: reason.trim() || 'Cancelled by admin', idempotencyKey: `admin-cancel-${id}` });
      const refund = res.refund?.amountMinor ? ` Refund ${formatMoney(res.refund.amountMinor, res.refund.currency)} (${res.refund.status}).` : '';
      onChanged(`Booking ${id.slice(-8).toUpperCase()} cancelled.${refund}`);
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Cancellation failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Booking detail">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between">
          <h3 className="font-semibold">Booking {id.slice(-8).toUpperCase()}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-5 text-sm">
          {error && <Notice kind="error">{error}</Notice>}
          {loading && !b ? <PageLoader message="Loading..." /> : b && (
            <>
              <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
                <dt className="text-gray-500">Listing</dt><dd className="col-span-2 font-medium">{b.itemTitle} <span className="text-gray-500 capitalize">({b.bookingType})</span></dd>
                <dt className="text-gray-500">Status</dt><dd className="col-span-2 flex gap-2"><StatusBadge status={b.status} />{b.fulfillmentStatus && <StatusBadge status={b.fulfillmentStatus} />}</dd>
                <dt className="text-gray-500">Customer</dt><dd className="col-span-2">{b.user?.firstName} {b.user?.lastName} · {b.user?.email}</dd>
                <dt className="text-gray-500">Contact</dt><dd className="col-span-2">{b.contactInfo?.fullName || b.contactInfo?.name} {b.contactInfo?.phone}</dd>
                <dt className="text-gray-500">Provider</dt><dd className="col-span-2">{b.organization?.name || '—'}</dd>
                <dt className="text-gray-500">Total</dt><dd className="col-span-2 tabular-nums">{formatMoney(b.priceSnapshot?.totalMinor, b.priceSnapshot?.currency)}</dd>
                <dt className="text-gray-500">Created</dt><dd className="col-span-2">{fmtDate(b.createdAt, true)}</dd>
                {b.expiresAt && ['payment_pending', 'pending'].includes(b.status) && <><dt className="text-gray-500">Hold expires</dt><dd className="col-span-2">{fmtDate(b.expiresAt, true)}</dd></>}
                {b.cancellationReason && <><dt className="text-gray-500">Cancel reason</dt><dd className="col-span-2">{b.cancellationReason}</dd></>}
              </dl>

              <section>
                <h4 className="font-semibold mb-2">Payments</h4>
                {(b.payments || []).map((p: any) => (
                  <div key={p.id} className="border rounded-md p-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={p.status} />
                      {p.metadata?.needsRefundReview && <StatusBadge status="flagged" />}
                      <span className="text-gray-600">{p.provider}</span>
                      <span className="ml-auto tabular-nums">{formatMoney(p.amountMinor, p.currency)}</span>
                    </div>
                    {p.amountRefundedMinor > 0 && <p className="text-xs text-blue-700 mt-1">Refunded {formatMoney(p.amountRefundedMinor, p.currency)}</p>}
                    {p.attempts?.length > 0 && (
                      <ul className="mt-2 text-xs text-gray-500 space-y-0.5">
                        {p.attempts.map((a: any) => <li key={a.id}>{fmtDate(a.createdAt, true)} · attempt {a.status}{a.failureCode ? ` (${a.failureCode})` : ''}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
                {!b.payments?.length && <p className="text-gray-500">No payments.</p>}
              </section>

              {b.refunds?.length > 0 && (
                <section>
                  <h4 className="font-semibold mb-2">Refunds</h4>
                  <ul className="space-y-1">
                    {b.refunds.map((r: any) => (
                      <li key={r.id} className="flex items-center gap-2"><StatusBadge status={r.status} />
                        <span className="tabular-nums">{formatMoney(r.amountMinor, r.currency)}</span>
                        <span className="text-xs text-gray-500">{fmtDate(r.createdAt, true)}</span></li>
                    ))}
                  </ul>
                </section>
              )}

              {b.audits?.length > 0 && (
                <section>
                  <h4 className="font-semibold mb-2">History</h4>
                  <ol className="border-l pl-3 space-y-1 text-xs text-gray-600">
                    {b.audits.map((a: any) => <li key={a.id}>{fmtDate(a.createdAt, true)} · {String(a.action).replace(/_/g, ' ')}{a.newFulfillmentStatus ? ` → ${a.newFulfillmentStatus}` : ''}</li>)}
                  </ol>
                </section>
              )}

              {CANCELLABLE.includes(b.status) && (
                <section className="border-t pt-4">
                  <h4 className="font-semibold mb-1">Cancel / refund</h4>
                  <p className="text-xs text-gray-500 mb-2">Uses the same lifecycle as customer cancellations: inventory is released and any refund follows the listing's policy through the payment provider.</p>
                  {actionError && <Notice kind="error">{actionError}</Notice>}
                  <textarea className={`${inputCls} w-full`} rows={2} maxLength={300} placeholder="Reason (shown in the booking history)"
                    value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button disabled={busy} onClick={doCancel}
                    className="mt-2 bg-red-600 text-white rounded-md px-3 py-1.5 hover:bg-red-700 disabled:opacity-50">
                    {busy ? 'Cancelling…' : 'Cancel booking'}
                  </button>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
