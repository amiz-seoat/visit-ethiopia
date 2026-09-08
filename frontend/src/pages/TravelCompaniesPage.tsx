import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Star, Building2 } from 'lucide-react';
import { listPublicOrganizations } from '../api/organizations';
import { PageError, PageLoader } from '../components/ui/PageStatus';
import { getErrorMessage } from '../services/api';

interface PublicOrg {
  _id: string;
  slug: string;
  name: string;
  shortDescription?: string;
  logo?: string;
  coverImage?: string;
  averageRating?: number;
  reviewCount?: number;
  location?: { city?: string; region?: string };
}

export function TravelCompaniesPage() {
  const [companies, setCompanies] = useState<PublicOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await listPublicOrganizations();
        const travel = data.filter((o) =>
          (o.providerTypes || []).includes('travel_company')
        ) as PublicOrg[];
        if (!cancelled) setCompanies(travel);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load companies'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <PageLoader />;
  if (error) return <PageError message={error} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-emerald-900 text-white py-16 px-4 text-center">
        <h1 className="text-4xl font-bold mb-2">Travel Companies</h1>
        <p className="text-emerald-100 max-w-2xl mx-auto">
          Browse verified Ethiopian travel companies and their curated tours
        </p>
      </div>
      <div className="container mx-auto px-4 py-10">
        {companies.length === 0 ? (
          <p className="text-center text-gray-500">No approved travel companies yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map((c) => (
              <Link
                key={c._id}
                to={`/companies/${c.slug}`}
                className="bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden"
              >
                <div
                  className="h-40 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${c.coverImage || c.logo || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828'})`,
                  }}
                />
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 size={18} className="text-emerald-700" />
                    <h2 className="font-bold text-lg text-gray-900">{c.name}</h2>
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                    {c.shortDescription}
                  </p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    {c.location?.city && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {c.location.city}
                      </span>
                    )}
                    {(c.reviewCount ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <Star size={14} className="text-amber-500" />
                        {(c.averageRating ?? 0).toFixed(1)} ({c.reviewCount})
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
