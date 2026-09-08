import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createTourBooking } from '../../api/bookings'
import type { TourDeparture, TourPackage } from '../../api/organizationTours'
import { useAuth } from '../../context/AuthContext'
import { getErrorMessage } from '../../services/api'
import type { Tour } from '../../types'
import {
  createIdempotencyKey,
  formatMinorAmount,
} from '../../utils/bookingHelpers'
import {
  availabilityLabel,
  previewPackageTotalMinor,
  validateTourBookingForm,
} from '../../utils/bookingValidation'

interface TourBookingPanelProps {
  tour: Tour
  departures: TourDeparture[]
  tourPath: string
}

function resolvePackages(
  tour: Tour,
  departure: TourDeparture | null
): Array<TourPackage & { priceMinor: number; currency: string }> {
  const base = (tour.packages || []).filter((p) => p.active !== false)
  if (!base.length && tour.priceMinor != null) {
    return [
      {
        key: 'standard',
        name: 'Standard',
        priceMinor: tour.priceMinor,
        currency: tour.currency || 'ETB',
        active: true,
      },
    ]
  }

  return base.map((pkg) => {
    const override = departure?.packages?.find((d) => d.key === pkg.key)
    const active = override?.active !== false && pkg.active !== false
    return {
      ...pkg,
      priceMinor: override?.priceMinor ?? pkg.priceMinor,
      currency: override?.currency || pkg.currency || tour.currency || 'ETB',
      active,
    }
  }).filter((p) => p.active !== false)
}

export function TourBookingPanel({ tour, departures, tourPath }: TourBookingPanelProps) {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const submittingRef = useRef(false)

  const openDepartures = useMemo(
    () =>
      departures.filter(
        (d) => d.status === 'open' || d.status === 'limited'
      ),
    [departures]
  )

  const [departureId, setDepartureId] = useState('')
  const [packageKey, setPackageKey] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [contactInfo, setContactInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) {
      setContactInfo((prev) => ({
        ...prev,
        fullName: prev.fullName || `${user.FirstName} ${user.LastName}`.trim(),
        email: prev.email || user.email,
      }))
    }
  }, [user])

  useEffect(() => {
    if (!departureId && openDepartures.length === 1) {
      setDepartureId(openDepartures[0]._id)
    }
  }, [openDepartures, departureId])

  const selectedDeparture =
    openDepartures.find((d) => d._id === departureId) || null

  const packages = useMemo(
    () => resolvePackages(tour, selectedDeparture),
    [tour, selectedDeparture]
  )

  useEffect(() => {
    if (!packageKey && packages.length === 1) {
      setPackageKey(packages[0].key)
    } else if (packageKey && !packages.some((p) => p.key === packageKey)) {
      setPackageKey(packages[0]?.key || '')
    }
  }, [packages, packageKey])

  const selectedPackage = packages.find((p) => p.key === packageKey) || null
  const availableSpots = selectedDeparture?.availableSpots ?? 0
  const maxQty = Math.max(0, availableSpots)

  useEffect(() => {
    if (quantity > maxQty && maxQty > 0) setQuantity(maxQty)
    if (maxQty === 0) setQuantity(1)
  }, [maxQty, quantity])

  const previewTotal =
    selectedPackage
      ? previewPackageTotalMinor(selectedPackage.priceMinor, quantity)
      : 0
  const previewCurrency = selectedPackage?.currency || tour.currency || 'ETB'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!isAuthenticated) {
      navigate('/login', { state: { from: tourPath } })
      return
    }

    const validationError = validateTourBookingForm(
      { departureId, packageKey, quantity, contactInfo },
      { availableSpots, isAuthenticated }
    )
    if (validationError) {
      setError(validationError)
      return
    }

    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)

    const idempotencyKey = createIdempotencyKey('tour-book')

    try {
      const result = await createTourBooking(
        {
          departureId,
          packageKey,
          quantity,
          contactInfo: {
            fullName: contactInfo.fullName.trim(),
            email: contactInfo.email.trim(),
            phone: contactInfo.phone.trim(),
            ...(contactInfo.address?.trim()
              ? { address: contactInfo.address.trim() }
              : {}),
          },
        },
        idempotencyKey
      )

      navigate(`/bookings/${result.booking._id}`, {
        state: { justCreated: true, idempotent: result.idempotent },
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Booking failed. Please try again.'))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (openDepartures.length === 0) {
    return (
      <div className="bg-white border rounded-lg shadow-md p-6 sticky top-24">
        <h2 className="text-xl font-bold mb-2">Book this tour</h2>
        <p className="text-gray-600 text-sm">
          No open departures are available for booking right now. Check back soon or browse other tours.
        </p>
        <Link
          to="/tours"
          className="mt-4 inline-block text-amber-700 font-medium text-sm underline"
        >
          Browse tours
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white border rounded-lg shadow-md p-6 sticky top-24">
      <h2 className="text-xl font-bold mb-1">Book this tour</h2>
      <p className="text-xs text-gray-500 mb-4">
        Final price is confirmed by the server when you create your booking.
      </p>

      {!isAuthenticated && (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          Please sign in to book this tour.{' '}
          <Link
            to="/login"
            state={{ from: tourPath }}
            className="font-medium underline"
          >
            Sign in
          </Link>
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {error && (
          <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 p-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="departure" className="block text-sm font-medium text-gray-700 mb-1">
            Departure
          </label>
          <select
            id="departure"
            value={departureId}
            onChange={(e) => setDepartureId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            required
            disabled={submitting}
          >
            <option value="">Select a departure</option>
            {openDepartures.map((dep) => (
              <option key={dep._id} value={dep._id} disabled={dep.availableSpots <= 0}>
                {new Date(dep.departureDate).toLocaleDateString(undefined, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
                {' — '}
                {availabilityLabel(dep.availableSpots)}
              </option>
            ))}
          </select>
          {selectedDeparture && (
            <p className="mt-1 text-xs text-gray-500">
              {availabilityLabel(selectedDeparture.availableSpots)}
              {selectedDeparture.returnDate
                ? ` · Returns ${new Date(selectedDeparture.returnDate).toLocaleDateString()}`
                : ''}
            </p>
          )}
        </div>

        <fieldset disabled={submitting || !departureId}>
          <legend className="block text-sm font-medium text-gray-700 mb-2">Package</legend>
          {packages.length === 0 ? (
            <p className="text-sm text-gray-500">No packages available for this departure.</p>
          ) : (
            <div className="space-y-2">
              {packages.map((pkg) => (
                <label
                  key={pkg.key}
                  className={`flex items-start gap-3 border rounded-md p-3 cursor-pointer ${
                    packageKey === pkg.key ? 'border-amber-500 bg-amber-50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="packageKey"
                    value={pkg.key}
                    checked={packageKey === pkg.key}
                    onChange={() => setPackageKey(pkg.key)}
                    className="mt-1"
                  />
                  <span className="flex-1">
                    <span className="font-medium block">{pkg.name}</span>
                    {pkg.description ? (
                      <span className="text-xs text-gray-600 block mt-0.5">{pkg.description}</span>
                    ) : null}
                    <span className="text-sm text-amber-800 font-semibold mt-1 block">
                      {formatMinorAmount(pkg.priceMinor, pkg.currency || 'ETB')}
                      <span className="font-normal text-gray-500"> / person</span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
            Quantity
          </label>
          <select
            id="quantity"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
            className="w-full p-2 border border-gray-300 rounded-md"
            disabled={submitting || maxQty <= 0}
          >
            {maxQty <= 0 ? (
              <option value={1}>Sold out</option>
            ) : (
              Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'traveler' : 'travelers'}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            value={contactInfo.fullName}
            onChange={(e) => setContactInfo({ ...contactInfo, fullName: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded-md"
            required
            disabled={submitting}
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={contactInfo.email}
            onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded-md"
            required
            disabled={submitting}
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={contactInfo.phone}
            onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
            className="w-full p-2 border border-gray-300 rounded-md"
            required
            disabled={submitting}
          />
        </div>

        {selectedPackage && (
          <div className="border-t pt-4 space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Estimated total (preview)</span>
              <span>{formatMinorAmount(previewTotal, previewCurrency)}</span>
            </div>
            <p className="text-xs text-gray-500">
              Preview only — the booking response shows the authoritative total.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || maxQty <= 0 || !departureId || !packageKey}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-3 px-4 rounded-md disabled:opacity-60"
        >
          {submitting
            ? 'Creating booking…'
            : isAuthenticated
              ? 'Continue to checkout'
              : 'Sign in to book'}
        </button>
      </form>
    </div>
  )
}
