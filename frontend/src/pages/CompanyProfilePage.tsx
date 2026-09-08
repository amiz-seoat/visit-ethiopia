import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Star, Building2 } from 'lucide-react';
import {
  getOrganizationBySlug,
  getOrganizationPublicTours,
  type MarketplaceTour,
} from '../api/organizationTours';
import { PageError, PageLoader } from '../components/ui/PageStatus';
import { getErrorMessage } from '../services/api';

export function CompanyProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [company, setCompany] = useState<Record<string, unknown> | null>(null);
  const [tours, setTours] = useState<MarketplaceTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [org, orgTours] = await Promise.all([
          getOrganizationBySlug(slug),
          getOrganizationPublicTours(slug),
        ]);
        if (!cancelled) {
          setCompany(org);
          setTours(orgTours);
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Company not found'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return <PageLoader />;
  if (error || !company) return <PageError message={error || 'Company not found'} />;

  const location = company.location as { city?: string; region?: string } | undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className="h-64 bg-cover bg-center relative"
        style={{
          backgroundImage: `url(${(company.coverImage as string) || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828'})`,
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative h-full flex items-end p-8 text-white">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={24} />
              <h1 className="text-3xl font-bold">{company.name as string}</h1>
            </div>
            {location?.city && (
              <p className="flex items-center gap-1 text-gray-200">
                <MapPin size={16} /> {location.city}
                {location.region ? `, ${location.region}` : ''}
              </p>
            )}
            {(company.reviewCount as number) > 0 && (
              <p className="flex items-center gap-1 mt-1">
                <Star size={16} className="text-amber-400" />
                {((company.averageRating as number) || 0).toFixed(1)} (
                {company.reviewCount as number} reviews)
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-3">About</h2>
            <p className="text-gray-600 text-sm whitespace-pre-line">
              {(company.description as string) || (company.shortDescription as string)}
            </p>
          </div>
          {(company.uniqueSellingPoints as string[])?.length > 0 && (
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Why travel with us</h2>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {(company.uniqueSellingPoints as string[]).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Available tours</h2>
          {tours.length === 0 ? (
            <p className="text-gray-500">No published tours at the moment.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {tours.map((tour) => (
                <Link
                  key={tour._id}
                  to={`/tours/${tour.slug || tour._id}`}
                  className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition"
                >
                  <img
                    src={tour.coverImage}
                    alt={tour.title}
                    className="h-40 w-full object-cover"
                  />
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900">{tour.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                      {tour.shortDescription}
                    </p>
                    <div className="flex justify-between items-center mt-3 text-sm">
                      <span className="text-emerald-700 font-medium">
                        ETB {tour.price?.toLocaleString()}
                      </span>
                      <span className="text-gray-500">
                        {tour.duration?.days}d / {tour.duration?.nights}n
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
