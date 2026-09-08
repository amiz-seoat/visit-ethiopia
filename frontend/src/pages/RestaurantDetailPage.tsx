import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone, Star } from 'lucide-react';
import { getRestaurantById, type Restaurant } from '../api/restaurants';
import { PageError, PageLoader } from '../components/ui/PageStatus';
import { ReviewForm } from '../components/reviews/ReviewForm';
import { getErrorMessage } from '../services/api';

export function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getRestaurantById(id)
      .then((data) => {
        if (!data) setError('Restaurant not found');
        else setRestaurant(data);
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load restaurant')))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader message="Loading restaurant..." />;
  if (error || !restaurant) return <PageError message={error || 'Not found'} />;

  return (
    <div className="w-full bg-white">
      <div
        className="relative h-80 bg-cover bg-center"
        style={{ backgroundImage: `url('${restaurant.coverImage}')` }}
      >
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative h-full container mx-auto px-4 flex flex-col justify-end pb-8 text-white">
          <h1 className="text-4xl font-bold mb-2">{restaurant.name}</h1>
          <p className="text-lg max-w-3xl">{restaurant.shortDescription}</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <Link to="/restaurants" className="inline-flex items-center text-amber-700 mb-6 hover:underline">
          <ArrowLeft size={16} className="mr-1" /> Back to restaurants
        </Link>

        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
          {(restaurant.location?.city || restaurant.location?.address) && (
            <span className="flex items-center">
              <MapPin size={16} className="mr-1" />
              {[restaurant.location.address, restaurant.location.city, restaurant.location.region]
                .filter(Boolean)
                .join(', ')}
            </span>
          )}
          {restaurant.contact?.phone && (
            <span className="flex items-center">
              <Phone size={16} className="mr-1" />
              {restaurant.contact.phone}
            </span>
          )}
          {typeof restaurant.averageRating === 'number' && restaurant.averageRating > 0 && (
            <span className="flex items-center text-amber-600">
              <Star size={16} className="mr-1 fill-current" />
              {restaurant.averageRating.toFixed(1)}
            </span>
          )}
          {restaurant.priceRange && <span>{restaurant.priceRange}</span>}
        </div>

        <p className="text-gray-700 leading-relaxed mb-8">{restaurant.description}</p>

        {restaurant.menu?.length ? (
          <div>
            <h2 className="text-2xl font-bold mb-4">Menu</h2>
            <div className="space-y-6">
              {restaurant.menu.map((section) => (
                <div key={section.category}>
                  <h3 className="font-semibold text-lg mb-2">{section.category}</h3>
                  <ul className="space-y-2">
                    {section.items.map((item) => (
                      <li key={item.name} className="flex justify-between border-b border-gray-100 py-2">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-gray-500">{item.description}</p>
                          )}
                        </div>
                        <span className="text-amber-800 font-medium">
                          {item.price.toLocaleString()} ETB
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {id && <ReviewForm itemType="restaurant" itemId={id} />}
      </div>
    </div>
  );
}
