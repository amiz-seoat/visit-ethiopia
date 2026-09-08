import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Tag, ChevronRight, Search } from 'lucide-react';
import { getNews } from '../api/news';
import { PageLoader } from '../components/ui/PageStatus';
import type { NewsArticle } from '../types';

/** Blog routes reuse the News API (same backend resource). */
export function BlogPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    getNews({ limit: 20 })
      .then(({ articles: data }) => setArticles(data))
      .catch(() => setError('Unable to load blog posts.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = articles.filter((article) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      article.title.toLowerCase().includes(q) ||
      (article.summary || article.excerpt || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full bg-white">
      <div className="relative h-72 bg-cover bg-center" style={{
        backgroundImage: "url('https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=2000')"
      }}>
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-4xl font-bold mb-2">Travel Blog</h1>
          <p className="text-lg max-w-2xl">Stories and guides from Ethiopia</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        <div className="relative mb-8 max-w-xl">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts..."
            className="w-full py-3 px-4 pr-12 rounded-lg border border-gray-300"
          />
          <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        {loading ? (
          <PageLoader message="Loading blog posts..." />
        ) : error ? (
          <p className="text-center text-gray-500 py-12">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No posts found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((post) => (
              <Link key={post._id} to={`/blog/${post._id}`} className="block group">
                <div className="h-48 overflow-hidden rounded-lg mb-3">
                  <img
                    src={post.coverImage || post.image || 'https://images.unsplash.com/photo-1518002054494-3a6f870d4a8f?w=800'}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <h2 className="font-bold text-lg mb-2 group-hover:text-amber-700">{post.title}</h2>
                <p className="text-gray-600 text-sm line-clamp-3 mb-2">
                  {post.summary || post.excerpt || ''}
                </p>
                <div className="flex items-center text-gray-500 text-sm">
                  <Calendar size={14} className="mr-1" />
                  {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Recent'}
                  <ChevronRight size={16} className="ml-auto text-amber-600" />
                </div>
                {post.tags?.length ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {post.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-gray-100 px-2 py-0.5 rounded flex items-center">
                        <Tag size={10} className="mr-1" />{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
