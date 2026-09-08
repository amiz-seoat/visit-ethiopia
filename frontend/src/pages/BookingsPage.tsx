import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar } from 'lucide-react'
import { getMyBookings } from '../api/bookings'
import { PageLoader } from '../components/ui/PageStatus'
import { getErrorMessage } from '../services/api'
import type { Booking, V2Booking } from '../types'
import {
  bookingStatusClass,
  bookingStatusLabel,
  formatMinorAmount,
  isV2Booking,
} from '../utils/bookingHelpers'

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function bookingTitle(booking: Booking | V2Booking) {
  if (isV2Booking(booking)) {
    return (
      (booking as V2Booking).priceSnapshot?.tourTitle ||
      'Tour booking'
    )
  }
  return `${booking.bookingType} booking`
}

function bookingAmount(booking: Booking | V2Booking) {
  if (isV2Booking(booking)) {
    const snap = (booking as V2Booking).priceSnapshot
    if (snap) return formatMinorAmount(snap.totalMinor, snap.currency)
  }
  const pay = booking.payment
  if (pay?.amountMinor != null) {
    return formatMinorAmount(pay.amountMinor, pay.currency || 'ETB')
  }
  if (pay?.amount != null) {
    return `${Number(pay.amount).toLocaleString()} ${pay.currency ?? 'ETB'}`
  }
  return '—'
}

function bookingDate(booking: Booking | V2Booking) {
  if (isV2Booking(booking)) {
    return formatDate((booking as V2Booking).priceSnapshot?.departureDate)
  }
  return formatDate(booking.bookingDetails?.startDate)
}

const STATUS_FILTERS = [
  'all',
  'payment_pending',
  'confirmed',
  'cancelled',
  'expired',
  'failed',
  'partially_refunded',
  'completed',
] as const

export function BookingsPage() {
  const [bookings, setBookings] = useState<(Booking | V2Booking)[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>('all')

  useEffect(() => {
    getMyBookings()
      .then(setBookings)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load bookings')))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader message="Loading your bookings..." />

  const filtered =
    filter === 'all'
      ? bookings
      : bookings.filter((b) => b.status === filter)

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">My bookings</h1>
            <p className="text-gray-600 text-sm mt-1">
              Upcoming, pending, confirmed, and past bookings
            </p>
          </div>
          <Link to="/tours" className="text-amber-700 font-medium text-sm underline">
            Browse tours
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-100 text-red-700 p-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`text-xs px-3 py-1.5 rounded-full border capitalize ${
                filter === status
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
              }`}
            >
              {status === 'all' ? 'All' : bookingStatusLabel(status)}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-10 text-center">
            <Calendar size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 mb-4">
              {bookings.length === 0
                ? "You haven't made any bookings yet."
                : 'No bookings match this filter.'}
            </p>
            <Link
              to="/tours"
              className="inline-block bg-amber-600 text-white py-2 px-4 rounded"
            >
              Browse tours
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((booking) => (
              <div
                key={booking._id}
                className="bg-white rounded-lg shadow-md p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="font-bold capitalize">{bookingTitle(booking)}</h2>
                    <span
                      className={`text-xs px-2 py-0.5 rounded capitalize ${bookingStatusClass(
                        booking.status
                      )}`}
                    >
                      {bookingStatusLabel(booking.status)}
                    </span>
                    {isV2Booking(booking) ? (
                      <span className="text-xs text-gray-400">Tour v2</span>
                    ) : (
                      <span className="text-xs text-gray-400">Legacy</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Departure: {bookingDate(booking)} · {bookingAmount(booking)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 font-mono">
                    Ref {booking._id.slice(-8).toUpperCase()}
                  </p>
                </div>
                <Link
                  to={`/bookings/${booking._id}`}
                  className="inline-flex justify-center bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2 px-4 rounded-md"
                >
                  View details
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
