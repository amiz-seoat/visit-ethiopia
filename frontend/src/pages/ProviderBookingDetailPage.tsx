import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addProviderBookingNote,
  checkInProviderBooking,
  completeProviderBooking,
  getProviderBooking,
  noShowProviderBooking,
  type ProviderBookingRow,
} from '../api/providerBookings'
import { PageError, PageLoader } from '../components/ui/PageStatus'
import { getErrorMessage } from '../services/api'
import {
  bookingStatusClass,
  bookingStatusLabel,
  formatMinorAmount,
} from '../utils/bookingHelpers'

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fulfillmentLabel(status?: string) {
  if (!status) return 'Pending'
  return status.replace(/_/g, ' ')
}

export function ProviderBookingDetailPage() {
  const { organizationId, bookingId } = useParams<{
    organizationId: string
    bookingId: string
  }>()
  const [booking, setBooking] = useState<ProviderBookingRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmAction, setConfirmAction] = useState<
    null | 'check-in' | 'complete' | 'no-show'
  >(null)
  const [noteText, setNoteText] = useState('')
  const busyRef = useRef(false)

  const load = useCallback(async () => {
    if (!organizationId || !bookingId) return
    setLoading(true)
    setError('')
    setDenied(false)
    try {
      localStorage.setItem('activeOrganizationId', organizationId)
      const data = await getProviderBooking(organizationId, bookingId)
      setBooking(data)
    } catch (err) {
      const statusCode =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined
      if (statusCode === 403) {
        setDenied(true)
        setError('You do not have permission to view this booking.')
      } else {
        setError(getErrorMessage(err, 'Failed to load booking'))
      }
      setBooking(null)
    } finally {
      setLoading(false)
    }
  }, [organizationId, bookingId])

  useEffect(() => {
    load()
  }, [load])

  const runAction = async (action: 'check-in' | 'complete' | 'no-show') => {
    if (!organizationId || !bookingId || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setActionError('')
    setActionMessage('')
    setConfirmAction(null)
    try {
      let result
      if (action === 'check-in') {
        result = await checkInProviderBooking(organizationId, bookingId)
        setActionMessage(result.idempotent ? 'Already checked in.' : 'Guest checked in.')
      } else if (action === 'complete') {
        result = await completeProviderBooking(organizationId, bookingId)
        setActionMessage(result.idempotent ? 'Already completed.' : 'Booking marked completed.')
      } else {
        result = await noShowProviderBooking(organizationId, bookingId)
        setActionMessage(result.idempotent ? 'Already marked no-show.' : 'Marked as no-show.')
      }
      setBooking(result.booking)
    } catch (err) {
      setActionError(getErrorMessage(err, 'Operation failed'))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId || !bookingId || busyRef.current || !noteText.trim()) return
    busyRef.current = true
    setBusy(true)
    setActionError('')
    setActionMessage('')
    try {
      const updated = await addProviderBookingNote(
        organizationId,
        bookingId,
        noteText.trim()
      )
      setBooking(updated)
      setNoteText('')
      setActionMessage('Note added.')
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not add note'))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  if (loading) return <PageLoader message="Loading booking..." />
  if (denied) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-6">
          {error}
        </div>
        <Link
          to={`/provider/workspace/${organizationId}/bookings`}
          className="inline-block mt-4 text-amber-700 underline text-sm"
        >
          Back to bookings
        </Link>
      </div>
    )
  }
  if (error || !booking) {
    return (
      <div className="container mx-auto px-4 py-12">
        <PageError message={error || 'Booking not found'} />
        <div className="text-center mt-4">
          <Link
            to={`/provider/workspace/${organizationId}/bookings`}
            className="text-amber-700 underline"
          >
            Back to bookings
          </Link>
        </div>
      </div>
    )
  }

  const snap = booking.priceSnapshot
  const fulfillment = booking.fulfillmentStatus || 'pending'
  const financiallyConfirmed = booking.status === 'confirmed'
  const canCheckIn = financiallyConfirmed && fulfillment === 'confirmed'
  const canComplete =
    financiallyConfirmed && (fulfillment === 'confirmed' || fulfillment === 'checked_in')
  const canNoShow = financiallyConfirmed && fulfillment === 'confirmed'
  const readOnlyOps =
    !financiallyConfirmed ||
    fulfillment === 'completed' ||
    fulfillment === 'no_show' ||
    fulfillment === 'cancelled' ||
    ['cancelled', 'expired', 'failed', 'partially_refunded'].includes(booking.status)

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Link
          to={`/provider/workspace/${organizationId}/bookings`}
          className="text-sm text-emerald-700 hover:underline"
        >
          ← Bookings
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3 mt-2 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Booking {booking.reference}</h1>
            <p className="text-xs text-gray-500 font-mono mt-1">{booking._id}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`text-xs px-2 py-1 rounded capitalize ${bookingStatusClass(booking.status)}`}
            >
              {bookingStatusLabel(booking.status)}
            </span>
            <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-800 capitalize">
              Fulfillment: {fulfillmentLabel(fulfillment)}
            </span>
          </div>
        </div>

        {actionMessage && (
          <div className="mb-4 rounded-md bg-green-50 border border-green-200 text-green-800 p-3 text-sm">
            {actionMessage}
          </div>
        )}
        {actionError && (
          <div role="alert" className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-800 p-3 text-sm">
            {actionError}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-4 space-y-4">
          <h2 className="font-semibold text-lg">Customer</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium">{booking.customer?.fullName || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium">{booking.customer?.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Phone</dt>
              <dd className="font-medium">{booking.customer?.phone || '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-4 space-y-4">
          <h2 className="font-semibold text-lg">Tour & departure</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Tour</dt>
              <dd className="font-medium">{booking.tour?.title || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Departure</dt>
              <dd className="font-medium">{formatDate(booking.departure?.departureDate)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Package</dt>
              <dd className="font-medium">
                {booking.package?.name || booking.package?.key || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Quantity</dt>
              <dd className="font-medium">{booking.quantity ?? '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-4 space-y-4">
          <h2 className="font-semibold text-lg">Pricing (snapshot)</h2>
          <p className="text-xs text-gray-500">
            Server-authored price snapshot. Providers cannot change amounts.
          </p>
          {snap ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-gray-500">Unit</dt>
                <dd className="font-medium">
                  {formatMinorAmount(snap.unitPriceMinor, snap.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Total</dt>
                <dd className="font-medium">
                  {formatMinorAmount(snap.totalMinor, snap.currency)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-500">No price snapshot</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-4 space-y-4">
          <h2 className="font-semibold text-lg">Payment & inventory</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Payment status</dt>
              <dd className="font-medium capitalize">{booking.payment?.status || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Amount</dt>
              <dd className="font-medium">
                {booking.payment
                  ? formatMinorAmount(
                      booking.payment.amountMinor,
                      booking.payment.currency
                    )
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Inventory reserved</dt>
              <dd className="font-medium">
                {booking.inventory?.reserved ? 'Yes' : 'No'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Checked in</dt>
              <dd className="font-medium">{formatDate(booking.checkedInAt)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Completed</dt>
              <dd className="font-medium">{formatDate(booking.fulfillmentCompletedAt)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">No-show</dt>
              <dd className="font-medium">{formatDate(booking.noShowAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <h2 className="font-semibold text-lg mb-2">Fulfillment operations</h2>
          <p className="text-xs text-gray-500 mb-4">
            These actions update operational status only. They never change payment,
            refunds, or inventory seats.
          </p>
          {readOnlyOps ? (
            <p className="text-sm text-gray-600">
              No fulfillment actions available for this booking state.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {canCheckIn && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmAction('check-in')}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-60"
                >
                  Check in
                </button>
              )}
              {canComplete && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmAction('complete')}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-60"
                >
                  Mark completed
                </button>
              )}
              {canNoShow && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmAction('no-show')}
                  className="border border-red-500 text-red-600 hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-md disabled:opacity-60"
                >
                  Mark no-show
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <h2 className="font-semibold text-lg mb-3">Provider notes</h2>
          {(booking.providerNotes || []).length === 0 ? (
            <p className="text-sm text-gray-500 mb-4">No notes yet.</p>
          ) : (
            <ul className="space-y-3 mb-4">
              {(booking.providerNotes || []).map((n) => (
                <li key={n._id || n.createdAt} className="border rounded-md p-3 text-sm">
                  <p className="text-gray-800">{n.note}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
          {!['expired', 'failed'].includes(booking.status) ? (
            <form onSubmit={submitNote} className="space-y-2">
              <label htmlFor="provider-note" className="block text-sm font-medium text-gray-700">
                Add note
              </label>
              <textarea
                id="provider-note"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                maxLength={1000}
                rows={3}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Operational note for your team"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !noteText.trim()}
                className="bg-slate-800 text-white text-sm px-4 py-2 rounded-md disabled:opacity-60"
              >
                Save note
              </button>
            </form>
          ) : null}
        </div>

        <p className="text-xs text-gray-500">
          Provider financial cancellation is not enabled. Payment and inventory remain
          server-owned.
        </p>
      </div>

      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fulfillment-confirm-title"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 id="fulfillment-confirm-title" className="text-lg font-bold mb-2">
              Confirm action
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {confirmAction === 'check-in' && 'Mark this booking as checked in?'}
              {confirmAction === 'complete' && 'Mark this booking as completed?'}
              {confirmAction === 'no-show' &&
                'Mark this booking as a no-show? This does not issue a refund.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 border rounded-md text-sm"
                onClick={() => setConfirmAction(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm disabled:opacity-60"
                onClick={() => runAction(confirmAction)}
                disabled={busy}
              >
                {busy ? 'Working…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
