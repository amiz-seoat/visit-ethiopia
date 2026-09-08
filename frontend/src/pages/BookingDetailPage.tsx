import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { cancelBooking, getBookingById } from '../api/bookings'
import { confirmPayment, getPaymentById } from '../api/payments'
import { PageError, PageLoader } from '../components/ui/PageStatus'
import { getErrorMessage } from '../services/api'
import type { Booking, PaymentRecord, V2Booking } from '../types'
import {
  bookingStatusClass,
  bookingStatusLabel,
  canCustomerCancelBooking,
  createIdempotencyKey,
  formatMinorAmount,
  isV2Booking,
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

function shortRef(id: string) {
  return id.slice(-8).toUpperCase()
}

export function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [justCreated] = useState(() =>
    Boolean((location.state as { justCreated?: boolean } | null)?.justCreated)
  )

  const [booking, setBooking] = useState<Booking | V2Booking | null>(null)
  const [payment, setPayment] = useState<PaymentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [paymentFailed, setPaymentFailed] = useState(false)
  const [showSuccessBanner, setShowSuccessBanner] = useState(false)

  const confirmingRef = useRef(false)
  const cancellingRef = useRef(false)
  const paymentIdempotencyKey = useRef(createIdempotencyKey('pay-confirm'))
  const cancelIdempotencyKey = useRef(createIdempotencyKey('book-cancel'))

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const data = await getBookingById(id)
      setBooking(data)

      const paymentId =
        (data as V2Booking).paymentId ||
        (isV2Booking(data) && (data as V2Booking).payment?._id) ||
        null

      if (paymentId && isV2Booking(data)) {
        try {
          const payResult = await getPaymentById(String(paymentId))
          setPayment(payResult.payment)
          if (payResult.booking) setBooking(payResult.booking)
        } catch {
          const nested = (data as V2Booking).payment
          if (nested) setPayment(nested)
        }
      } else {
        setPayment(null)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load booking'))
      setBooking(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (justCreated) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [justCreated, location.pathname, navigate])

  const handleConfirmPayment = async () => {
    if (!payment?._id || confirmingRef.current) return
    confirmingRef.current = true
    setConfirming(true)
    setActionError('')
    setActionMessage('')
    setPaymentFailed(false)

    try {
      const result = await confirmPayment(payment._id, {
        idempotencyKey: paymentIdempotencyKey.current,
      })

      if (result.failed || result.payment.status === 'failed') {
        setPaymentFailed(true)
        setPayment(result.payment)
        setBooking(result.booking)
        setActionError(
          'Payment could not be completed. Your inventory reservation has been released. You can return to the tour and try booking again.'
        )
        return
      }

      setPayment(result.payment)
      setBooking(result.booking)
      setShowSuccessBanner(true)
      setActionMessage('Payment completed. Your booking is confirmed.')
      // New key only after success for a different future action — keep same key for retries of this confirm
    } catch (err) {
      setActionError(
        getErrorMessage(err, 'Payment could not be completed. Please check your booking status before trying again.')
      )
      // Reconcile without creating a new booking
      await load()
    } finally {
      confirmingRef.current = false
      setConfirming(false)
    }
  }

  const handleCancel = async () => {
    if (!booking?._id || cancellingRef.current) return
    cancellingRef.current = true
    setCancelling(true)
    setActionError('')
    setActionMessage('')

    try {
      const needsKey =
        isV2Booking(booking) &&
        (booking.status === 'confirmed' || booking.status === 'partially_refunded')

      const result = await cancelBooking(booking._id, {
        reason: 'customer_request',
        idempotencyKey: needsKey
          ? cancelIdempotencyKey.current
          : undefined,
      })

      if (result.failed) {
        setActionError(
          'Cancellation or refund could not be completed. Your booking was not marked as successfully refunded.'
        )
        if (result.booking) setBooking(result.booking)
        if (result.payment) setPayment(result.payment as PaymentRecord)
        return
      }

      setBooking(result.booking)
      if (result.payment) setPayment(result.payment as PaymentRecord)
      setShowCancelDialog(false)

          if (result.refund?.status === 'completed' && result.refund.amountMinor != null) {
        setActionMessage(
          `Booking cancelled. Refund of ${formatMinorAmount(
            result.refund.amountMinor,
            result.refund.currency || result.payment?.currency || 'ETB'
          )} completed.`
        )
      } else if (result.refund) {
        setActionMessage(
          `Booking update received. Refund status: ${result.refund.status}.`
        )
      } else {
        setActionMessage('Booking cancelled.')
      }
    } catch (err) {
      setActionError(getErrorMessage(err, 'Unable to cancel this booking.'))
    } finally {
      cancellingRef.current = false
      setCancelling(false)
    }
  }

  if (loading) return <PageLoader message="Loading booking..." />
  if (error || !booking) {
    return (
      <div className="container mx-auto px-4 py-12">
        <PageError message={error || 'Booking not found'} />
        <div className="text-center mt-4">
          <Link to="/bookings" className="text-amber-700 underline">
            Back to my bookings
          </Link>
        </div>
      </div>
    )
  }

  const v2 = isV2Booking(booking) ? (booking as V2Booking) : null
  const snapshot = v2?.priceSnapshot
  const status = booking.status || 'unknown'
  const showCheckout =
    v2 &&
    status === 'payment_pending' &&
    payment &&
    payment.status === 'pending' &&
    !paymentFailed

  const displayTotalMinor =
    snapshot?.totalMinor ??
    payment?.amountMinor ??
    (typeof booking.payment?.amountMinor === 'number'
      ? booking.payment.amountMinor
      : null)
  const currency =
    snapshot?.currency ||
    payment?.currency ||
    booking.payment?.currency ||
    'ETB'

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <Link to="/bookings" className="text-sm text-amber-700 hover:underline">
            ← My bookings
          </Link>
          <h1 className="text-2xl font-bold mt-2">Booking {shortRef(booking._id)}</h1>
          <p className="text-gray-600 text-sm mt-1">
            Reference: <span className="font-mono">{booking._id}</span>
          </p>
        </div>

        {showSuccessBanner && status === 'confirmed' && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-5">
            <h2 className="text-lg font-bold text-green-900">Booking confirmed</h2>
            <p className="text-sm text-green-800 mt-1">
              Your payment was successful and seats are reserved.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to={`/bookings/${booking._id}`}
                className="inline-flex bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                View my booking
              </Link>
              <Link
                to="/tours"
                className="inline-flex border border-green-700 text-green-800 px-4 py-2 rounded-md text-sm font-medium"
              >
                Back to tours
              </Link>
            </div>
          </div>
        )}

        {justCreated && status === 'payment_pending' && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Booking created. Complete mock payment below to confirm your seats.
          </div>
        )}

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

        {paymentFailed && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-5">
            <h2 className="font-bold text-red-900">Payment failed</h2>
            <p className="text-sm text-red-800 mt-1">
              Your inventory reservation has been released. You can return to the tour and try booking again.
            </p>
            <Link
              to="/tours"
              className="inline-block mt-3 text-sm font-medium text-red-900 underline"
            >
              Back to tours
            </Link>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-xl font-bold">Booking summary</h2>
            <span className={`text-xs px-2 py-1 rounded capitalize ${bookingStatusClass(status)}`}>
              {bookingStatusLabel(status)}
            </span>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Tour</dt>
              <dd className="font-medium">
                {snapshot?.tourTitle || (v2 ? 'Tour booking' : `${booking.bookingType} booking`)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Organization</dt>
              <dd className="font-medium">{snapshot?.organizationName || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Departure</dt>
              <dd className="font-medium">
                {snapshot?.departureDate
                  ? formatDate(snapshot.departureDate)
                  : formatDate(booking.bookingDetails?.startDate)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Package</dt>
              <dd className="font-medium">
                {snapshot?.packageName || v2?.packageKey || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Quantity</dt>
              <dd className="font-medium">
                {snapshot?.quantity ??
                  v2?.inventoryQuantity ??
                  booking.bookingDetails?.quantity ??
                  '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Total</dt>
              <dd className="font-medium">
                {displayTotalMinor != null
                  ? formatMinorAmount(displayTotalMinor, currency)
                  : booking.payment?.amount != null
                    ? `${Number(booking.payment.amount).toLocaleString()} ${currency}`
                    : '—'}
              </dd>
            </div>
            {snapshot && (
              <>
                <div>
                  <dt className="text-gray-500">Unit price</dt>
                  <dd className="font-medium">
                    {formatMinorAmount(snapshot.unitPriceMinor, currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Subtotal</dt>
                  <dd className="font-medium">
                    {formatMinorAmount(snapshot.subtotalMinor, currency)}
                  </dd>
                </div>
              </>
            )}
            <div>
              <dt className="text-gray-500">Payment status</dt>
              <dd className="font-medium capitalize">
                {payment?.status ||
                  booking.payment?.status ||
                  booking.payment?.paymentStatus ||
                  '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Created</dt>
              <dd className="font-medium">{formatDate(booking.createdAt)}</dd>
            </div>
            {v2?.expiresAt && status === 'payment_pending' && (
              <div>
                <dt className="text-gray-500">Hold expires</dt>
                <dd className="font-medium">{formatDate(v2.expiresAt)}</dd>
              </div>
            )}
            {v2?.confirmedAt && (
              <div>
                <dt className="text-gray-500">Confirmed</dt>
                <dd className="font-medium">{formatDate(v2.confirmedAt)}</dd>
              </div>
            )}
          </dl>

          {booking.contactInfo && (
            <div className="mt-6 border-t pt-4">
              <h3 className="font-semibold mb-2">Contact</h3>
              <p className="text-sm text-gray-700">{booking.contactInfo.fullName}</p>
              <p className="text-sm text-gray-700">{booking.contactInfo.email}</p>
              <p className="text-sm text-gray-700">{booking.contactInfo.phone}</p>
            </div>
          )}
        </div>

        {showCheckout && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-amber-100">
            <h2 className="text-xl font-bold mb-2">Checkout</h2>
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-3 py-2 mb-4">
              Development / test payment — Mock Payment provider. No card or bank details are collected.
            </p>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>
                  {formatMinorAmount(snapshot?.subtotalMinor ?? payment.amountMinor, currency)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-base">
                <span>Total due</span>
                <span>{formatMinorAmount(payment.amountMinor, currency)}</span>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Payment method</p>
              <div className="border rounded-md px-3 py-2 bg-gray-50 text-sm">
                Mock Payment
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmPayment}
              disabled={confirming}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-3 px-4 rounded-md disabled:opacity-60"
            >
              {confirming ? 'Confirming payment…' : 'Confirm payment'}
            </button>
          </div>
        )}

        {canCustomerCancelBooking(status) && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold mb-2">Cancel booking</h2>
            <p className="text-sm text-gray-600 mb-4">
              {status === 'confirmed'
                ? 'Cancelling a paid booking may trigger a refund according to departure cutoff rules. Refund amounts are determined by the server.'
                : 'Cancelling will release your inventory hold if payment is still pending.'}
            </p>
            <button
              type="button"
              onClick={() => setShowCancelDialog(true)}
              disabled={cancelling}
              className="border border-red-500 text-red-600 hover:bg-red-50 py-2 px-4 rounded-md text-sm disabled:opacity-60"
            >
              Cancel booking
            </button>
          </div>
        )}

        {showCancelDialog && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-dialog-title"
          >
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 id="cancel-dialog-title" className="text-lg font-bold mb-2">
                Cancel this booking?
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to cancel this booking?
                {status === 'confirmed'
                  ? ' Any refund will only be confirmed after the server processes it.'
                  : ''}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 border rounded-md text-sm"
                  onClick={() => setShowCancelDialog(false)}
                  disabled={cancelling}
                >
                  Keep booking
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm disabled:opacity-60"
                  onClick={handleCancel}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
