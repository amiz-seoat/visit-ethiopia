import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TourCard } from '../ui/TourCard';
import { PageLoader } from '../ui/PageStatus';
import { getFeaturedTours } from '../../api/tours';
import type { Tour } from '../../types';

export function FeaturedTours() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeaturedTours()
      .then(setTours)
      .catch(() => setTours([]))
      .finally(() => setLoading(false));
  }, []);

  return <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Featured Tours</h2>
            <p className="text-gray-600 mt-2">Explore our most popular experiences in Ethiopia</p>
          </div>
          <Link to="/tours" className="flex items-center text-amber-600 hover:text-amber-800 font-medium">
            <span className="mr-2">View All Tours</span>
            <ArrowRight size={18} />
          </Link>
        </div>
        {loading ? <PageLoader message="Loading featured tours..." /> : tours.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No featured tours available yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {tours.slice(0, 4).map(tour => <TourCard
              key={tour._id}
              id={tour._id}
              title={tour.title}
              image={tour.coverImage}
              price={tour.price}
              duration={tour.duration}
              rating={tour.averageRating ?? 0}
              shortDescription={tour.shortDescription}
            />)}
          </div>
        )}
      </div>
    </section>;
}
