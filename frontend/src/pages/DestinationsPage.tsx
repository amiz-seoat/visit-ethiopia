import React, { useEffect, useState } from 'react';
import { DestinationCard } from '../components/ui/DestinationCard';
import { PageError, PageLoader } from '../components/ui/PageStatus';
import { Search, Filter } from 'lucide-react';
import { getDestinations } from '../api/destinations';
import { getErrorMessage } from '../services/api';
import type { Destination } from '../types';

export function DestinationsPage() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const { destinations: data } = await getDestinations({
          status: 'active',
          limit: 50,
          search: search || undefined,
        });
        if (!cancelled) setDestinations(data);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load destinations'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [search]);

  return <div className="w-full bg-gray-50">
      <div className="relative h-80 bg-cover bg-center" style={{
      backgroundImage: "url('https://images.unsplash.com/photo-1523805009345-7448845a9e53?ixlib=rb-4.0.3&auto=format&fit=crop&w=2072&q=80')"
    }}>
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Destinations</h1>
          <p className="text-xl max-w-3xl">Explore Ethiopia&apos;s most breathtaking places</p>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
          <div className="w-full md:w-auto flex-grow">
            <div className="relative">
              <input
                type="text"
                placeholder="Search destinations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full py-3 px-4 pr-12 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
              />
              <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-amber-600">
                <Search size={20} />
              </button>
            </div>
          </div>
          <button className="flex items-center gap-2 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100">
            <Filter size={18} />
            <span>Filters</span>
          </button>
        </div>
        {loading ? <PageLoader /> : error ? <PageError message={error} /> : destinations.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No destinations found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {destinations.map(dest => <DestinationCard
              key={dest._id}
              id={dest._id}
              name={dest.name}
              image={dest.coverImage}
              region={dest.region}
            />)}
          </div>
        )}
      </div>
    </div>;
}
