import React, { useEffect, useState } from 'react';
import { DestinationCard } from '../ui/DestinationCard';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageLoader } from '../ui/PageStatus';
import { getFeaturedDestinations } from '../../api/destinations';
import type { Destination } from '../../types';

export function FeaturedDestinations() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeaturedDestinations()
      .then(setDestinations)
      .catch(() => setDestinations([]))
      .finally(() => setLoading(false));
  }, []);

  return <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Featured Destinations</h2>
            <p className="text-gray-600 mt-2">Discover Ethiopia&apos;s most iconic places</p>
          </div>
          <Link to="/destinations" className="flex items-center text-amber-600 hover:text-amber-800 font-medium">
            <span className="mr-2">View All Destinations</span>
            <ArrowRight size={18} />
          </Link>
        </div>
        {loading ? <PageLoader message="Loading destinations..." /> : destinations.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No featured destinations available yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {destinations.slice(0, 6).map(dest => <DestinationCard
              key={dest._id}
              id={dest._id}
              name={dest.name}
              image={dest.coverImage}
              region={dest.region}
            />)}
          </div>
        )}
      </div>
    </section>;
}
