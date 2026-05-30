import React, { useEffect, useState } from 'react';
import { HotelCard } from '../ui/HotelCard';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageLoader } from '../ui/PageStatus';
import { getFeaturedHotels } from '../../api/hotels';
import { hotelPriceRange } from '../../utils/apiHelpers';
import type { Hotel } from '../../types';

export function FeaturedHotels() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeaturedHotels()
      .then(setHotels)
      .catch(() => setHotels([]))
      .finally(() => setLoading(false));
  }, []);

  return <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Featured Hotels</h2>
            <p className="text-gray-600 mt-2">Stay at the finest accommodations in Ethiopia</p>
          </div>
          <Link to="/hotels" className="flex items-center text-amber-600 hover:text-amber-800 font-medium">
            <span className="mr-2">View All Hotels</span>
            <ArrowRight size={18} />
          </Link>
        </div>
        {loading ? <PageLoader message="Loading featured hotels..." /> : hotels.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No featured hotels available yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {hotels.slice(0, 4).map(hotel => <HotelCard
              key={hotel._id}
              id={hotel._id}
              name={hotel.name}
              image={hotel.coverImage}
              stars={hotel.stars ?? 3}
              rating={hotel.averageRating ?? 0}
              location={hotel.location?.city ?? 'Ethiopia'}
              priceRange={hotelPriceRange(hotel.roomTypes)}
            />)}
          </div>
        )}
      </div>
    </section>;
}
