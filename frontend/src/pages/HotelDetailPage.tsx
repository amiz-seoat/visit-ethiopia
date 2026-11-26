import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, MapPin, Calendar } from 'lucide-react';
import { getHotelById, getHotelReviews, getHotelAvailability } from '../api/hotels';
import { createHotelBooking } from '../api/bookings';
import { PageError, PageLoader } from '../components/ui/PageStatus';
import { ReviewForm } from '../components/reviews/ReviewForm';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';
import type { Hotel, Review } from '../types';

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `hotel-${crypto.randomUUID()}`;
  }
  return `hotel-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function HotelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(0);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [estimatedTotal, setEstimatedTotal] = useState<number | null>(null);
  const [bookingError, setBookingError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [hotelData, reviewData] = await Promise.all([
          getHotelById(id!),
          getHotelReviews(id!),
        ]);
        if (!cancelled) {
          if (!hotelData) setError('Hotel not found');
          else {
            setHotel(hotelData);
            setReviews(
              (reviewData as Review[]).filter(
                (r) => r.status === 'approved' || !r.status
              )
            );
          }
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load hotel'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const activeRooms = useMemo(
    () =>
      (hotel?.roomTypes || []).filter(
        (rt) => (rt as { active?: boolean }).active !== false
      ),
    [hotel]
  );

  const room = activeRooms[selectedRoom];
  const roomTypeKey =
    (room as { key?: string } | undefined)?.key ||
    room?.type?.toLowerCase().replace(/\s+/g, '-') ||
    '';

  useEffect(() => {
    setAvailabilityNote('');
    setEstimatedTotal(null);
    setBookingError('');
  }, [checkIn, checkOut, selectedRoom, quantity]);

  if (loading) return <PageLoader message="Loading hotel..." />;
  if (error || !hotel) return <PageError message={error || 'Hotel not found'} />;

  const images = hotel.images?.length ? hotel.images : [hotel.coverImage];
  const locationStr = hotel.location
    ? `${hotel.location.address ? hotel.location.address + ', ' : ''}${hotel.location.city}, ${hotel.location.region}`
    : 'Ethiopia';

  const handleCheckAvailability = async () => {
    if (!id || !checkIn || !checkOut || !roomTypeKey) {
      setBookingError('Select dates and a room type first');
      return;
    }
    setChecking(true);
    setBookingError('');
    setAvailabilityNote('');
    try {
      const data = await getHotelAvailability(id, {
        checkIn,
        checkOut,
        roomTypeKey,
      });
      const entry = data.roomTypes[0];
      if (!entry) {
        setAvailabilityNote('No availability data for this room type');
        setEstimatedTotal(null);
        return;
      }
      if (!entry.available || entry.minAvailableRooms < quantity) {
        setAvailabilityNote(
          entry.nightsMissingInventory
            ? 'Inventory missing for one or more nights'
            : `Only ${entry.minAvailableRooms} room(s) available for these dates`
        );
        setEstimatedTotal(null);
        return;
      }
      const nightsTotalMinor = entry.days.reduce((sum, d) => {
        const override = d.priceOverrideMinor;
        const base =
          entry.priceMinor != null
            ? entry.priceMinor
            : Math.round((entry.price || room?.price || 0) * 100);
        return sum + (override != null ? override : base);
      }, 0);
      const total = (nightsTotalMinor * quantity) / 100;
      setEstimatedTotal(total);
      setAvailabilityNote(
        `${entry.minAvailableRooms} room(s) available · ${entry.days.length} night(s)`
      );
    } catch (err) {
      setBookingError(getErrorMessage(err, 'Availability check failed'));
      setEstimatedTotal(null);
    } finally {
      setChecking(false);
    }
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/hotels/${id}` } });
      return;
    }
    if (!room || !checkIn || !checkOut || !roomTypeKey || !id) {
      setBookingError('Please select dates and a room type');
      return;
    }

    setSubmitting(true);
    setBookingError('');
    try {
      await createHotelBooking(
        {
          hotelId: id,
          roomTypeKey,
          checkIn,
          checkOut,
          quantity,
          contactInfo: {
            fullName: `${user!.FirstName} ${user!.LastName}`,
            email: user!.email,
            phone: hotel.contact?.phone || user!.email,
          },
        },
        newIdempotencyKey()
      );
      navigate('/bookings');
    } catch (err) {
      setBookingError(getErrorMessage(err, 'Booking failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white w-full">
      <div
        className="relative h-80 md:h-96 bg-cover bg-center"
        style={{ backgroundImage: `url(${hotel.coverImage})` }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative container mx-auto px-4 h-full flex flex-col justify-end pb-8">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">
            {hotel.name}
          </h1>
          <div className="flex items-center text-white gap-4">
            <div className="flex text-amber-400">
              {Array.from({ length: hotel.stars ?? 3 }).map((_, i) => (
                <Star key={i} size={18} fill="currentColor" />
              ))}
            </div>
            <span>({(hotel.averageRating ?? 0).toFixed(1)})</span>
            <MapPin size={18} className="ml-2" />
            <span>{locationStr}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-2/3">
            <p className="text-gray-700 mb-8">{hotel.description}</p>

            {hotel.amenities && hotel.amenities.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {hotel.amenities.map((a) => (
                    <span
                      key={a}
                      className="bg-amber-50 text-amber-800 px-3 py-1 rounded-full text-sm"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt=""
                  className="h-40 w-full object-cover rounded-lg"
                />
              ))}
            </div>

            {activeRooms.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4">Room Types</h2>
                <div className="space-y-4">
                  {activeRooms.map((rt, i) => (
                    <div
                      key={(rt as { key?: string }).key || rt.type || i}
                      className={`border rounded-lg p-4 cursor-pointer ${
                        selectedRoom === i ? 'ring-2 ring-amber-500' : ''
                      }`}
                      onClick={() => setSelectedRoom(i)}
                    >
                      <div className="flex justify-between">
                        <h3 className="font-bold">{rt.type}</h3>
                        <span className="text-amber-600 font-bold">
                          {rt.price.toLocaleString()} ETB/night
                        </span>
                      </div>
                      {rt.description && (
                        <p className="text-gray-600 text-sm mt-2">
                          {rt.description}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        Capacity: {rt.capacity}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-xl font-bold mb-4">Reviews</h2>
              {reviews.length === 0 ? (
                <p className="text-gray-500">No approved reviews yet.</p>
              ) : (
                reviews.map((review) => (
                  <div key={review._id} className="border-b py-4">
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
                ))
              )}
              {id && (
                <ReviewForm
                  itemType="hotel"
                  itemId={id}
                  onSubmitted={() => {
                    getHotelReviews(id).then((data) =>
                      setReviews(
                        (data as Review[]).filter(
                          (r) => r.status === 'approved' || !r.status
                        )
                      )
                    );
                  }}
                />
              )}
            </div>
          </div>

          <div className="lg:w-1/3">
            <div className="bg-white border rounded-lg shadow-md p-6 sticky top-24">
              <h3 className="font-bold text-lg mb-4">Book a Room</h3>
              {bookingError && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded mb-4">
                  {bookingError}
                </div>
              )}
              {availabilityNote && (
                <div className="text-sm text-emerald-800 bg-emerald-50 p-2 rounded mb-4">
                  {availabilityNote}
                </div>
              )}
              <form onSubmit={handleBook} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Check-in
                  </label>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Check-out
                  </label>
                  <input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rooms</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-full p-2 border rounded-md"
                  />
                </div>
                {room && (
                  <div className="border-t pt-4 flex justify-between font-bold">
                    <span>{room.type}</span>
                    <span>
                      {estimatedTotal != null
                        ? `${estimatedTotal.toLocaleString()} ETB total`
                        : `${room.price.toLocaleString()} ETB/night`}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleCheckAvailability}
                  disabled={checking}
                  className="w-full border border-amber-600 text-amber-700 py-2 rounded-md disabled:opacity-60"
                >
                  {checking ? 'Checking…' : 'Check availability'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-md disabled:opacity-60"
                >
                  {submitting
                    ? 'Booking...'
                    : isAuthenticated
                      ? 'Book Now'
                      : 'Sign in to Book'}
                </button>
              </form>
              <div className="mt-4 flex items-center text-gray-600 text-sm">
                <Calendar size={16} className="mr-1" />
                <span>Inventory is confirmed at booking time</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
