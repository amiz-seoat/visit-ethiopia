import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Star } from 'lucide-react';
import { getRestaurants, type Restaurant } from '../api/restaurants';
import { PageError, PageLoader } from '../components/ui/PageStatus';
import { getErrorMessage } from '../services/api';

export function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getRestaurants({ limit: 20 })
      .then(({ restaurants: data }) => setRestaurants(data))
      .catch((err) => setError(getErrorMessage(err, 'Failed to load restaurants')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full bg-gray-50">
      <div
        className="relative h-72 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=2000')",
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-4xl font-bold mb-2">Restaurants</h1>
          <p className="text-lg max-w-2xl">Taste authentic Ethiopian cuisine</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        {loading ? (
          <PageLoader message="Loading restaurants..." />
        ) : error ? (
          <PageError message={error} />
        ) : restaurants.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No restaurants available yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((r) => (
              <Link
                key={r._id}
                to={`/restaurants/${r._id}`}
                className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-44 overflow-hidden">
                  <img
                    src={r.coverImage}
                    alt={r.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h2 className="font-bold text-lg text-gray-800">{r.name}</h2>
                    {typeof r.averageRating === 'number' && r.averageRating > 0 && (
                      <span className="flex items-center text-amber-600 text-sm">
                        <Star size={14} className="mr-1 fill-current" />
                        {r.averageRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                    {r.shortDescription}
                  </p>
                  <div className="flex items-center text-gray-500 text-sm">
                    <MapPin size={14} className="mr-1" />
                    {r.location?.city || r.location?.region || 'Ethiopia'}
                    {r.priceRange ? ` · ${r.priceRange}` : ''}
                  </div>
                  {r.cuisineType?.length ? (
                    <p className="text-xs text-gray-500 mt-2">
                      {r.cuisineType.join(', ')}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
