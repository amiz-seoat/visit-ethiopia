import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import { getTransportById, getTransportReviews } from '../api/transports';
import { ReviewForm } from '../components/reviews/ReviewForm';
import { PageError, PageLoader } from '../components/ui/PageStatus';
import { getErrorMessage } from '../services/api';
import type { Review, Transport } from '../types';

export function TransportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [transport, setTransport] = useState<Transport | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) return <PageLoader message="Loading transport..." />;
  if (error || !transport) return <PageError message={error || 'Not found'} />;

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
          {(transport.routes ?? []).map((route, idx) => (
            <div key={idx} className="border rounded-lg p-4">
              <p className="font-medium">
                {route.from} → {route.to}
              </p>
              <p className="text-sm text-gray-600">
                {route.departureTime} – {route.arrivalTime}
                {route.duration ? ` · ${route.duration}` : ''}
              </p>
              <p className="text-amber-800 font-medium mt-1">
                {route.price.toLocaleString()} ETB · {route.availableSeats} seats
              </p>
            </div>
          ))}
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
