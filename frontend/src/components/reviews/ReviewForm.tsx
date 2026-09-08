import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { createReview, type CreateReviewPayload } from '../../api/reviews';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../services/api';

interface ReviewFormProps {
  itemType: CreateReviewPayload['itemType'];
  itemId: string;
  onSubmitted?: () => void;
}

export function ReviewForm({ itemType, itemId, onSubmitted }: ReviewFormProps) {
  const { isAuthenticated } = useAuth();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!itemId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isAuthenticated) {
      setError('Please sign in to submit a review.');
      return;
    }
    if (rating < 1 || rating > 5) {
      setError('Rating must be between 1 and 5.');
      return;
    }

    setLoading(true);
    try {
      await createReview({
        itemType,
        itemId,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim() || undefined,
      });
      setSuccess(
        'Review submitted. It will appear publicly after admin approval.'
      );
      setTitle('');
      setComment('');
      setRating(5);
      onSubmitted?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to submit review'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 border rounded-lg p-5 mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Write a Review</h3>

      {!isAuthenticated ? (
        <p className="text-gray-600 text-sm">
          <Link to="/login" className="text-amber-700 underline font-medium">
            Sign in
          </Link>{' '}
          to leave a review for this {itemType}.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>
          )}
          {success && (
            <div className="text-sm text-green-700 bg-green-50 p-2 rounded">
              {success}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rating
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className="text-amber-500"
                  aria-label={`${value} stars`}
                >
                  <Star
                    size={22}
                    fill={value <= rating ? 'currentColor' : 'none'}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
              maxLength={120}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comment (optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full p-2 border border-gray-300 rounded-md"
              maxLength={2000}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-60"
          >
            {loading ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      )}
    </div>
  );
}
