import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import {
  getTransportById,
  getTransportReviews,
  getTransportAvailability,
} from '../api/transports';
import { createTransportBooking } from '../api/bookings';
import { ReviewForm } from '../components/reviews/ReviewForm';
import { PageError, PageLoader } from '../components/ui/PageStatus';
import { getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Review, Transport, TransportRoute } from '../types';

function routeKeyOf(route: TransportRoute, idx: number) {
  return (
    route.key ||
    `${route.from}-${route.to}-${route.departureTime}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ||
    `route-${idx + 1}`
  );
}

export function TransportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [transport, setTransport] = useState<Transport | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [travelDate, setTravelDate] = useState('');
  const [routeKey, setRouteKey] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [availability, setAvailability] = useState<
    Awaited<ReturnType<typeof getTransportAvailability>>['availability']
  >([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState('');
  const [bookError, setBookError] = useState('');
  const [booking, setBooking] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [data, reviewData] = await Promise.all([
        getTransportById(id),
        getTransportReviews(id),
      ]);
      if (!data) setError('Transport not found');
      else {
        setTransport(data);
        const first = (data.routes ?? []).find((r) => r.active !== false);
        if (first) setRouteKey(routeKeyOf(first, 0));
        setReviews(
          (reviewData as Review[]).filter(
            (r) => r.status === 'approved' || !r.status
          )
        );
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load transport'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const selectedAvail = useMemo(
    () => availability.find((a) => a.routeKey === routeKey),
    [availability, routeKey]
  );

  const estimatedTotal =
    selectedAvail && selectedAvail.hasInventory
      ? (selectedAvail.priceMinor * quantity) / 100
      : null;

  const checkAvailability = async () => {
    if (!id || !travelDate) {
      setAvailError('Select a travel date');
      return;
    }
    setAvailLoading(true);
    setAvailError('');
    try {
      const data = await getTransportAvailability(id, {
        travelDate,
        routeKey: routeKey || undefined,
      });
      setAvailability(data.availability || []);
      if (!(data.availability || []).some((a) => a.hasInventory && a.availableSeats > 0)) {
        setAvailError('No seats available for this date');
      }
    } catch (err) {
      setAvailability([]);
      setAvailError(getErrorMessage(err, 'Failed to check availability'));
    } finally {
      setAvailLoading(false);
    }
  };

  const book = async () => {
    if (!id || !isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!travelDate || !routeKey) {
      setBookError('Select a route and travel date');
      return;
    }
    if (!/^\+?[0-9\s-]{9,16}$/.test(contactPhone.trim())) {
      setBookError('Enter a phone number the provider can reach you on (e.g. +251 91 234 5678)');
      return;
    }
    setBooking(true);
    setBookError('');
    try {
      const idempotencyKey = `transport-${id}-${routeKey}-${travelDate}-${quantity}-${Date.now()}`;
      await createTransportBooking(
        {
          transportId: id,
          routeKey,
          travelDate,
          quantity,
          contactInfo: {
            fullName: `${user?.FirstName || ''} ${user?.LastName || ''}`.trim() || 'Guest',
            email: user?.email || '',
            phone: contactPhone.trim(),
          },
        },
        idempotencyKey
      );
      navigate('/bookings');
    } catch (err) {
      setBookError(getErrorMessage(err, 'Booking failed'));
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <PageLoader message="Loading transport..." />;
  if (error || !transport) return <PageError message={error || 'Not found'} />;

  const activeRoutes = (transport.routes ?? []).filter((r) => r.active !== false);

  return (
    <div className="w-full bg-white">
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <Link
          to="/transport"
          className="inline-flex items-center text-amber-700 mb-6 hover:underline"
        >
          <ArrowLeft size={16} className="mr-1" /> Back to transport
        </Link>

        <h1 className="text-3xl font-bold mb-2">{transport.name}</h1>
        <p className="text-gray-600 mb-2 capitalize">{transport.type}</p>
        {typeof transport.averageRating === 'number' &&
          transport.averageRating > 0 && (
            <p className="flex items-center text-amber-600 mb-4">
              <Star size={16} className="mr-1 fill-current" />
              {transport.averageRating.toFixed(1)}
            </p>
          )}
        <p className="text-gray-700 mb-8">{transport.description}</p>

        <h2 className="text-xl font-bold mb-3">Routes</h2>
        <div className="space-y-3 mb-8">
          {activeRoutes.map((route, idx) => (
            <div key={routeKeyOf(route, idx)} className="border rounded-lg p-4">
              <p className="font-medium">
                {route.from} → {route.to}
              </p>
              <p className="text-sm text-gray-600">
                {route.departureTime} – {route.arrivalTime}
                {route.duration ? ` · ${route.duration}` : ''}
              </p>
              <p className="text-amber-800 font-medium mt-1">
                {route.price.toLocaleString()} ETB per seat · up to {route.availableSeats} seats
              </p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mb-3">Book seats</h2>
        <div className="border rounded-lg p-4 mb-8 space-y-3">
          <label className="block text-sm">
            Route
            <select
              className="mt-1 w-full border rounded px-3 py-2"
              value={routeKey}
              onChange={(e) => setRouteKey(e.target.value)}
            >
              {activeRoutes.map((route, idx) => {
                const key = routeKeyOf(route, idx);
                return (
                  <option key={key} value={key}>
                    {route.from} → {route.to} ({route.departureTime})
                  </option>
                );
              })}
            </select>
          </label>
          <label className="block text-sm">
            Travel date
            <input
              type="date"
              min={today}
              className="mt-1 w-full border rounded px-3 py-2"
              value={travelDate}
              onChange={(e) => setTravelDate(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Seats
            <input
              type="number"
              min={1}
              max={40}
              className="mt-1 w-full border rounded px-3 py-2"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value) || 1)}
            />
          </label>
          <label className="block text-sm">
            Your phone number
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="+251 9X XXX XXXX"
              className="mt-1 w-full border rounded px-3 py-2"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
            <span className="text-xs text-gray-500">Shared with the transport provider for this trip only.</span>
          </label>
          <button
            type="button"
            onClick={checkAvailability}
            disabled={availLoading}
            className="px-4 py-2 bg-gray-800 text-white rounded disabled:opacity-50"
          >
            {availLoading ? 'Checking…' : 'Check availability'}
          </button>
          {availError && <p className="text-red-600 text-sm">{availError}</p>}
          {selectedAvail && (
            <p className="text-sm text-gray-700">
              {selectedAvail.hasInventory
                ? `${selectedAvail.availableSeats} seats available · ${(
                    selectedAvail.priceMinor / 100
                  ).toLocaleString()} ${selectedAvail.currency}/seat`
                : 'No inventory for this date'}
            </p>
          )}
          {estimatedTotal != null && (
            <p className="font-medium text-amber-800">
              Estimated total: {estimatedTotal.toLocaleString()} ETB
            </p>
          )}
          <button
            type="button"
            onClick={book}
            disabled={
              booking ||
              !selectedAvail?.hasInventory ||
              (selectedAvail?.availableSeats ?? 0) < quantity
            }
            className="px-4 py-2 bg-amber-600 text-white rounded disabled:opacity-50"
          >
            {booking ? 'Booking…' : isAuthenticated ? 'Book now' : 'Log in to book'}
          </button>
          {bookError && <p className="text-red-600 text-sm">{bookError}</p>}
        </div>

        <h2 className="text-xl font-bold mb-3">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-gray-500 mb-4">No approved reviews yet.</p>
        ) : (
          <div className="space-y-4 mb-4">
            {reviews.map((review) => (
              <div key={review._id} className="border-b pb-3">
                <div className="font-medium">
                  {review.user?.FirstName} {review.user?.LastName}
                </div>
                <div className="flex text-amber-500 my-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      fill={i < review.rating ? 'currentColor' : 'none'}
                    />
                  ))}
                </div>
                <p className="text-gray-700">{review.comment}</p>
              </div>
            ))}
          </div>
        )}

        {id && (
          <ReviewForm itemType="transport" itemId={id} onSubmitted={load} />
        )}
      </div>
    </div>
  );
}
