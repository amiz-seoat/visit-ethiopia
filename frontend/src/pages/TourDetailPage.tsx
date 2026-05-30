import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Clock, Users, Map, CheckCircle, XCircle, Star, ChevronRight, ChevronDown } from 'lucide-react';
import { getTourById, getTourReviews } from '../api/tours';
import { createBooking } from '../api/bookings';
import { PageError, PageLoader } from '../components/ui/PageStatus';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';
import { formatTourDuration } from '../utils/apiHelpers';
import type { Review, Tour } from '../types';

export function TourDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [tour, setTour] = useState<Tour | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedImage, setSelectedImage] = useState(0);
  const [openAccordion, setOpenAccordion] = useState<number | null>(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [participants, setParticipants] = useState(1);
  const [contactInfo, setContactInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    if (user) {
      setContactInfo({
        fullName: `${user.FirstName} ${user.LastName}`,
        email: user.email,
        phone: '',
        address: '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [tourData, reviewData] = await Promise.all([
          getTourById(id!),
          getTourReviews(id!),
        ]);
        if (!cancelled) {
          if (!tourData) {
            setError('Tour not found');
          } else {
            setTour(tourData);
            setReviews(
              (reviewData as Review[]).filter((r) => r.status === 'approved' || !r.status)
            );
          }
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load tour'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <PageLoader message="Loading tour..." />;
  if (error || !tour) return <PageError message={error || 'Tour not found'} />;

  const images = tour.images?.length ? tour.images : [tour.coverImage];
  const availableDates = tour.availableDates ?? [];
  const maxSpots = Math.max(1, (tour.maxGroupSize ?? 12) - (tour.currentBookings ?? 0));
  const totalPrice = tour.price * participants;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');
    setBookingSuccess(false);

    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/tours/${id}` } });
      return;
    }

    if (!selectedDate) {
      setBookingError('Please select a date');
      return;
    }

    setSubmitting(true);
    try {
      await createBooking({
        bookingType: 'tour',
        bookingItem: id!,
        bookingDetails: {
          startDate: selectedDate,
          quantity: participants,
          participants: Array.from({ length: participants }, () => ({
            name: contactInfo.fullName,
            age: undefined,
            specialRequirements: '',
          })),
        },
        contactInfo,
        payment: {
          amount: totalPrice,
          currency: 'ETB',
          paymentMethod: 'credit_card',
          paymentStatus: 'pending',
        },
      });
      setBookingSuccess(true);
    } catch (err) {
      setBookingError(getErrorMessage(err, 'Booking failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white w-full">
      <div className="relative h-80 md:h-96 bg-cover bg-center" style={{ backgroundImage: `url(${tour.coverImage})` }}>
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative container mx-auto px-4 h-full flex flex-col justify-end pb-8">
          {tour.isFeatured && (
            <div className="bg-amber-600 text-white py-1 px-3 rounded-full inline-block mb-3 text-sm font-medium w-fit">
              Featured Tour
            </div>
          )}
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">{tour.title}</h1>
          <div className="flex flex-wrap items-center text-white gap-4">
            <div className="flex items-center">
              <Star size={18} fill="currentColor" className="mr-1" />
              <span>{(tour.averageRating ?? 0).toFixed(1)} ({reviews.length} reviews)</span>
            </div>
            <div className="flex items-center">
              <Clock size={18} className="mr-1" />
              <span>{formatTourDuration(tour.duration)}</span>
            </div>
            <div className="flex items-center">
              <Users size={18} className="mr-1" />
              <span>{tour.currentBookings ?? 0}/{tour.maxGroupSize ?? 12} spots taken</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-2/3">
            <div className="mb-8">
              <div className="bg-gray-100 rounded-lg overflow-hidden mb-4">
                <img src={images[selectedImage]} alt={tour.title} className="w-full h-96 object-cover" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                {images.map((image, index) => (
                  <div key={index} className={`h-24 rounded-lg overflow-hidden cursor-pointer ${selectedImage === index ? 'ring-2 ring-amber-500' : ''}`} onClick={() => setSelectedImage(index)}>
                    <img src={image} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Tour Overview</h2>
              <p className="text-gray-700">{tour.description}</p>
            </div>

            {tour.itinerary && tour.itinerary.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">Itinerary</h2>
                <div className="border rounded-lg overflow-hidden">
                  {tour.itinerary.map((day, index) => (
                    <div key={index} className="border-b last:border-b-0">
                      <button type="button" className="w-full px-6 py-4 flex items-center justify-between text-left" onClick={() => setOpenAccordion(openAccordion === index ? null : index)}>
                        <div>
                          <span className="text-amber-600 font-medium">Day {day.day}:</span>{' '}
                          <span className="font-medium">{day.title}</span>
                        </div>
                        {openAccordion === index ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </button>
                      {openAccordion === index && (
                        <div className="px-6 py-4 bg-gray-50">
                          <p className="text-gray-700">{day.description}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {tour.inclusions && tour.inclusions.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4">What&apos;s Included</h2>
                  <ul className="space-y-2">
                    {tour.inclusions.map((item, index) => (
                      <li key={index} className="flex items-start">
                        <CheckCircle size={18} className="text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tour.exclusions && tour.exclusions.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4">What&apos;s Not Included</h2>
                  <ul className="space-y-2">
                    {tour.exclusions.map((item, index) => (
                      <li key={index} className="flex items-start">
                        <XCircle size={18} className="text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Reviews</h2>
              {reviews.length === 0 ? (
                <p className="text-gray-500">No approved reviews yet.</p>
              ) : (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review._id} className="border-b pb-6 last:border-b-0">
                      <div className="flex justify-between mb-2">
                        <h3 className="font-medium">
                          {review.user?.FirstName} {review.user?.LastName}
                        </h3>
                        <span className="text-gray-500 text-sm">
                          {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <div className="flex text-amber-500 mb-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={16} fill={i < review.rating ? 'currentColor' : 'none'} />
                        ))}
                      </div>
                      <p className="text-gray-700">{review.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:w-1/3">
            <div className="bg-white border rounded-lg shadow-md p-6 sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <div>
                  {tour.discount ? (
                    <>
                      <span className="text-gray-500 line-through">{tour.price + tour.discount} ETB</span>
                      <span className="text-3xl font-bold text-gray-900 ml-2">{tour.price} ETB</span>
                    </>
                  ) : (
                    <span className="text-3xl font-bold text-gray-900">{tour.price} ETB</span>
                  )}
                </div>
                {tour.discount ? (
                  <span className="bg-green-100 text-green-800 text-sm font-medium py-1 px-2 rounded">
                    Save {tour.discount} ETB
                  </span>
                ) : null}
              </div>

              {bookingSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg">
                  Booking submitted! <Link to="/dashboard" className="underline font-medium">View your bookings</Link>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  {bookingError && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{bookingError}</div>
                  )}
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                    <select id="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" required>
                      <option value="">Select a date</option>
                      {availableDates.map((date) => (
                        <option key={date} value={date}>
                          {new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="participants" className="block text-sm font-medium text-gray-700 mb-1">Participants</label>
                    <select id="participants" value={participants} onChange={(e) => setParticipants(parseInt(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md">
                      {Array.from({ length: maxSpots }, (_, i) => i + 1).map((num) => (
                        <option key={num} value={num}>{num} {num === 1 ? 'person' : 'people'}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input type="text" value={contactInfo.fullName} onChange={(e) => setContactInfo({ ...contactInfo, fullName: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={contactInfo.email} onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input type="tel" value={contactInfo.phone} onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })} className="w-full p-2 border border-gray-300 rounded-md" required />
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>{totalPrice.toLocaleString()} ETB</span>
                    </div>
                  </div>
                  <button type="submit" disabled={submitting} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-3 px-4 rounded-md disabled:opacity-60">
                    {submitting ? 'Booking...' : isAuthenticated ? 'Book Now' : 'Sign in to Book'}
                  </button>
                </form>
              )}
              <div className="mt-4 flex items-center text-gray-600 text-sm justify-center">
                <Map size={16} className="mr-1" />
                <span>Free cancellation up to 7 days before the tour</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
