import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { getDestinationById, getDestinationTours } from '../api/destinations';
import { PageError, PageLoader } from '../components/ui/PageStatus';
import { TourCard } from '../components/ui/TourCard';
import { getErrorMessage } from '../services/api';
import type { Destination, Tour } from '../types';

export function DestinationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [dest, destTours] = await Promise.all([
          getDestinationById(id!),
          getDestinationTours(id!),
        ]);
        if (!cancelled) {
          if (!dest) setError('Destination not found');
          else {
            setDestination(dest);
            setTours(destTours);
          }
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load destination'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <PageLoader message="Loading destination..." />;
  if (error || !destination) return <PageError message={error || 'Destination not found'} />;

  const images = destination.images?.length ? destination.images : [destination.coverImage];

  return (
    <div className="bg-white w-full">
      <div className="relative h-80 md:h-96 bg-cover bg-center" style={{ backgroundImage: `url(${destination.coverImage})` }}>
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative container mx-auto px-4 h-full flex flex-col justify-end pb-8">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">{destination.name}</h1>
          <div className="flex items-center text-white">
            <MapPin size={18} className="mr-1" />
            <span>{destination.region}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold mb-4">About {destination.name}</h2>
            <p className="text-gray-700 whitespace-pre-line mb-8">{destination.description}</p>

            {destination.attractions && destination.attractions.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4">Highlights</h3>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  {destination.attractions.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {images.map((img, i) => (
                <img key={i} src={img} alt="" className="h-40 w-full object-cover rounded-lg" />
              ))}
            </div>
          </div>

          <div>
            <div className="bg-gray-50 rounded-lg p-6 sticky top-24">
              <h3 className="font-bold text-lg mb-4">Quick Info</h3>
              <p className="text-gray-600 text-sm mb-4">{destination.shortDescription}</p>
              <Link to="/tours" className="block text-center bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-md">
                Browse All Tours
              </Link>
            </div>
          </div>
        </div>

        {tours.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Tours in {destination.name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tours.map((tour) => (
                <TourCard
                  key={tour._id}
                  id={tour._id}
                  title={tour.title}
                  image={tour.coverImage}
                  price={tour.price}
                  duration={tour.duration}
                  rating={tour.averageRating ?? 0}
                  shortDescription={tour.shortDescription}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
