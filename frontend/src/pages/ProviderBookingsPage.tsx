import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  listProviderBookings,
  type ProviderBookingRow,
} from '../api/providerBookings'
import { PageLoader } from '../components/ui/PageStatus'
import { getErrorMessage } from '../services/api'
import {
  bookingStatusClass,
  bookingStatusLabel,
  formatMinorAmount,
} from '../utils/bookingHelpers'

const STATUS_OPTIONS = [
  '',
  'payment_pending',
  'confirmed',
  'cancelled',
  'expired',
  'failed',
  'partially_refunded',
  'completed',
]

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ProviderBookingsPage() {
  const { organizationId } = useParams<{ organizationId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [bookings, setBookings] = useState<ProviderBookingRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)

  const status = searchParams.get('status') || ''
  const paymentStatus = searchParams.get('paymentStatus') || ''
  const customerSearch = searchParams.get('q') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = 20

  const load = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    setError('')
    setDenied(false)
    try {
      localStorage.setItem('activeOrganizationId', organizationId)
      const result = await listProviderBookings(organizationId, {
        status: status || undefined,
        paymentStatus: paymentStatus || undefined,
        customerSearch: customerSearch || undefined,
        page,
        limit,
      })
      setBookings(result.bookings)
      setTotal(result.total)
    } catch (err) {
      const statusCode =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined
      if (statusCode === 403) {
        setDenied(true)
        setError('You do not have permission to view bookings for this organization.')
      } else {
        setError(getErrorMessage(err, 'Failed to load bookings'))
      }
      setBookings([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [organizationId, status, paymentStatus, customerSearch, page])

  useEffect(() => {
    load()
  }, [load])

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  if (!organizationId) {
    return <div className="p-8 text-center text-gray-600">Organization required</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            to={`/provider/workspace/${organizationId}`}
            className="text-sm text-emerald-700 hover:underline"
          >
            ← Provider workspace
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Tour bookings</h1>
          <p className="text-sm text-gray-600 mt-1">
            V2 tour bookings for your organization. Prices and payments are read-only.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <label htmlFor="status" className="block text-xs font-medium text-gray-600 mb-1">
              Booking status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {bookingStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="paymentStatus" className="block text-xs font-medium text-gray-600 mb-1">
              Payment status
            </label>
            <select
              id="paymentStatus"
              value={paymentStatus}
              onChange={(e) => updateFilter('paymentStatus', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">All payments</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div className="flex-[2]">
            <label htmlFor="q" className="block text-xs font-medium text-gray-600 mb-1">
              Customer search
            </label>
            <input
              id="q"
              type="search"
              value={customerSearch}
              onChange={(e) => updateFilter('q', e.target.value)}
              placeholder="Name, email, or phone"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <PageLoader message="Loading bookings..." />
        ) : denied ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-6 text-sm">
            {error}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-lg p-4 text-sm">
            {error}
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-10 text-center text-gray-500">
            No bookings match these filters.
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Ref</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Tour / departure</th>
                      <th className="px-4 py-3 font-medium">Qty</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Fulfillment</th>
                      <th className="px-4 py-3 font-medium">Payment</th>
                      <th className="px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b._id} className="border-t">
                        <td className="px-4 py-3 font-mono text-xs">{b.reference}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{b.customer?.fullName || '—'}</div>
                          <div className="text-xs text-gray-500">{b.customer?.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{b.tour?.title || 'Tour'}</div>
                          <div className="text-xs text-gray-500">
                            {formatDate(b.departure?.departureDate)} · {b.package?.name || b.package?.key}
                          </div>
                        </td>
                        <td className="px-4 py-3">{b.quantity ?? '—'}</td>
                        <td className="px-4 py-3">
                          {b.priceSnapshot
                            ? formatMinorAmount(
                                b.priceSnapshot.totalMinor,
                                b.priceSnapshot.currency
                              )
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded capitalize ${bookingStatusClass(
                              b.status
                            )}`}
                          >
                            {bookingStatusLabel(b.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 capitalize text-xs">
                          {(b.fulfillmentStatus || 'pending').replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 capitalize text-xs">
                          {b.payment?.status || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/provider/workspace/${organizationId}/bookings/${b._id}`}
                            className="text-amber-700 font-medium hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>
                Page {page} of {totalPages} · {total} total
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => updateFilter('page', String(page - 1))}
                  className="px-3 py-1 border rounded disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => updateFilter('page', String(page + 1))}
                  className="px-3 py-1 border rounded disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
