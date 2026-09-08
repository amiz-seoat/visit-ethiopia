import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { globalSearch, type GlobalSearchResults } from '../api/search';
import { PageLoader } from '../components/ui/PageStatus';
import { getErrorMessage } from '../services/api';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initialQ = params.get('q') || '';
  const [input, setInput] = useState(initialQ);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<GlobalSearchResults | null>(null);

  useEffect(() => {
    setInput(initialQ);
    if (!initialQ.trim()) {
      setResults(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    globalSearch(initialQ)
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Search failed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialQ]);

  const total = useMemo(() => {
    if (!results) return 0;
    return (
      results.tours.length +
      results.hotels.length +
      results.destinations.length +
      results.transports.length +
      results.restaurants.length +
      results.news.length
    );
  }, [results]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    setParams(q ? { q } : {});
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      <div className="bg-amber-800 text-white py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold mb-4">Search Visit Ethiopia</h1>
          <form onSubmit={onSubmit} className="max-w-2xl relative">
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search tours, hotels, destinations, transport, restaurants, news..."
              className="w-full py-3 px-4 pr-12 rounded-lg text-gray-900"
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-800"
            >
              <SearchIcon size={20} />
            </button>
          </form>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        {!initialQ.trim() ? (
          <p className="text-gray-500 text-center">Enter a search term to begin.</p>
        ) : loading ? (
          <PageLoader message="Searching..." />
        ) : error ? (
          <p className="text-center text-red-600">{error}</p>
        ) : total === 0 ? (
          <p className="text-center text-gray-500">
            No results found for &ldquo;{initialQ}&rdquo;.
          </p>
        ) : (
          <div className="space-y-10">
            <p className="text-gray-600">
              {total} result{total === 1 ? '' : 's'} for &ldquo;{initialQ}&rdquo;
            </p>

            <ResultSection title="Tours" items={results!.tours.map((t) => ({
              id: t._id,
              title: t.title,
              blurb: t.shortDescription,
              to: `/tours/${t._id}`,
            }))} />
            <ResultSection title="Hotels" items={results!.hotels.map((h) => ({
              id: h._id,
              title: h.name,
              blurb: h.shortDescription,
              to: `/hotels/${h._id}`,
            }))} />
            <ResultSection title="Destinations" items={results!.destinations.map((d) => ({
              id: d._id,
              title: d.name,
              blurb: d.shortDescription,
              to: `/destinations/${d._id}`,
            }))} />
            <ResultSection title="Transport" items={results!.transports.map((t) => ({
              id: t._id,
              title: t.name,
              blurb: t.description,
              to: `/transport`,
            }))} />
            <ResultSection title="Restaurants" items={results!.restaurants.map((r) => ({
              id: r._id,
              title: r.name,
              blurb: r.shortDescription,
              to: `/restaurants/${r._id}`,
            }))} />
            <ResultSection title="News" items={results!.news.map((n) => ({
              id: n._id,
              title: n.title,
              blurb: n.summary || n.excerpt || '',
              to: `/news/${n._id}`,
            }))} />
          </div>
        )}
      </div>
    </div>
  );
}

function ResultSection({
  title,
  items,
}: {
  title: string;
  items: { id: string; title: string; blurb?: string; to: string }[];
}) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="text-xl font-bold text-gray-800 mb-3">{title}</h2>
      <div className="grid gap-3">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            className="block bg-white border rounded-lg p-4 hover:border-amber-400 hover:shadow-sm"
          >
            <h3 className="font-semibold text-gray-900">{item.title}</h3>
            {item.blurb && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.blurb}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
