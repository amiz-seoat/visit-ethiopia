import React, { useEffect, useState } from 'react';
import { HotelCard } from '../components/ui/HotelCard';
import { PageError, PageLoader } from '../components/ui/PageStatus';
import { Search, Filter, Grid, List } from 'lucide-react';
import { getHotels } from '../api/hotels';
import { getErrorMessage } from '../services/api';
import { hotelPriceRange } from '../utils/apiHelpers';
import type { Hotel } from '../types';

const PAGE_SIZE = 8;

export function HotelsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const { hotels: data, total: count } = await getHotels({
          page,
          limit: PAGE_SIZE,
          status: 'active',
          search: search || undefined,
        });
        if (!cancelled) {
          setHotels(data);
          setTotal(count);
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load hotels'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [page, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return <div className="w-full bg-gray-50">
      <div className="relative h-80 bg-cover bg-center" style={{
      backgroundImage: "url('https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')"
    }}>
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Hotels in Ethiopia</h1>
          <p className="text-xl max-w-3xl">Find comfortable and authentic accommodations across Ethiopia</p>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
          <div className="w-full md:w-auto flex-grow">
            <div className="relative">
              <input
                type="text"
                placeholder="Search hotels..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full py-3 px-4 pr-12 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none"
              />
              <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-amber-600">
                <Search size={20} />
              </button>
            </div>
          </div>
          <div className="w-full md:w-auto flex items-center gap-4">
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100">
              <Filter size={18} />
              <span>Filters</span>
            </button>
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-amber-100 text-amber-700' : 'bg-white text-gray-600'}`}>
                <Grid size={20} />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-amber-100 text-amber-700' : 'bg-white text-gray-600'}`}>
                <List size={20} />
              </button>
            </div>
          </div>
        </div>
        {loading ? <PageLoader /> : error ? <PageError message={error} /> : hotels.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No hotels found.</div>
        ) : (
          <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'} gap-6`}>
            {hotels.map(hotel => <HotelCard
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
        {!loading && !error && totalPages > 1 && <div className="mt-12 flex justify-center">
          <nav className="flex items-center space-x-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50">Previous</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50">Next</button>
          </nav>
        </div>}
      </div>
    </div>;
}
