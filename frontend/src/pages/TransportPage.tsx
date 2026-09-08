import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bus, Car, Plane, Map, Search } from 'lucide-react';
import { getTransports } from '../api/transports';
import { PageError, PageLoader } from '../components/ui/PageStatus';
import { getErrorMessage } from '../services/api';
import type { Transport, TransportRoute } from '../types';

interface FlatRoute {
  transportId: string;
  name: string;
  type: string;
  route: TransportRoute;
  image?: string;
}

const typeLabels: Record<string, string> = {
  air: 'Flight',
  bus: 'Bus',
  train: 'Train',
  private_vehicle: 'Car Rental',
  boat: 'Boat',
};

function TransportCard({ item }: { item: FlatRoute }) {
  const getIcon = () => {
    switch (item.type) {
      case 'air': return <Plane size={20} className="text-amber-600" />;
      case 'bus': return <Bus size={20} className="text-amber-600" />;
      case 'private_vehicle': return <Car size={20} className="text-amber-600" />;
      default: return <Map size={20} className="text-amber-600" />;
    }
  };

  const image = item.image || 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800';

  return (
    <Link
      to={`/transport/${item.transportId}`}
      className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow block"
    >
      <div className="relative h-48 overflow-hidden">
        <img src={image} alt={item.name} className="w-full h-full object-cover" />
        <div className="absolute top-0 right-0 bg-amber-600 text-white px-3 py-1 m-2 rounded-full text-sm font-medium">
          {item.route.price.toLocaleString()} ETB
        </div>
        <div className="absolute top-0 left-0 bg-white/80 text-gray-800 px-3 py-1 m-2 rounded-full text-sm font-medium flex items-center">
          {getIcon()}
          <span className="ml-1">{typeLabels[item.type] ?? item.type}</span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-lg mb-1">{item.name}</h3>
        <p className="text-gray-600 text-sm mb-3">{item.route.from} → {item.route.to}</p>
        <div className="grid grid-cols-2 gap-2 mb-4 text-sm text-gray-500">
          <div>Departs: {item.route.departureTime}</div>
          <div>Arrives: {item.route.arrivalTime}</div>
          {item.route.duration && <div className="col-span-2">Duration: {item.route.duration}</div>}
          <div className="col-span-2">{item.route.availableSeats} seats available</div>
        </div>
        <div className="text-amber-600 font-medium">{item.route.price.toLocaleString()} ETB</div>
      </div>
    </Link>
  );
}

export function TransportPage() {
  const [transports, setTransports] = useState<Transport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'air' | 'bus' | 'private_vehicle'>('all');

  useEffect(() => {
    getTransports({ status: 'active', limit: 50 })
      .then(({ transports: data }) => setTransports(data))
      .catch((err) => setError(getErrorMessage(err, 'Failed to load transport options')))
      .finally(() => setLoading(false));
  }, []);

  const flatRoutes = useMemo(() => {
    const items: FlatRoute[] = [];
    for (const t of transports) {
      for (const route of t.routes ?? []) {
        items.push({
          transportId: t._id,
          name: t.name,
          type: t.type,
          route,
          image: t.vehicleDetails?.images?.[0],
        });
      }
    }
    return items;
  }, [transports]);

  const filtered = flatRoutes.filter((item) => {
    if (activeTab !== 'all' && item.type !== activeTab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.route.from.toLowerCase().includes(q) ||
        item.route.to.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="w-full bg-gray-50">
      <div className="relative h-80 bg-cover bg-center" style={{
        backgroundImage: "url('https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=2070')"
      }}>
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Transport in Ethiopia</h1>
          <p className="text-xl max-w-3xl">Flights, buses, and private transfers across the country</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Search routes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full py-3 px-4 pr-12 rounded-lg border border-gray-300"
            />
            <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="flex gap-2">
            {(['all', 'air', 'bus', 'private_vehicle'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg ${activeTab === tab ? 'bg-amber-600 text-white' : 'bg-white border text-gray-700'}`}
              >
                {tab === 'all' ? 'All' : typeLabels[tab] ?? tab}
              </button>
            ))}
          </div>
        </div>

        {loading ? <PageLoader /> : error ? <PageError message={error} /> : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No transport routes found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item, i) => (
              <TransportCard key={`${item.transportId}-${i}`} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
