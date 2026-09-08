import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Tag, ChevronRight, Search } from 'lucide-react';
import { getNews } from '../api/news';
import { PageLoader } from '../components/ui/PageStatus';
import type { NewsArticle } from '../types';

function articleBlurb(article: NewsArticle) {
  return article.excerpt || article.summary || '';
}

export function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    getNews({ limit: 20 })
      .then(({ articles: data }) => setArticles(data))
      .catch(() => setUnavailable(true))
      .finally(() => setLoading(false));
  }, []);

  const filteredArticles = articles.filter((article) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const blurb = articleBlurb(article).toLowerCase();
    return article.title.toLowerCase().includes(q) || blurb.includes(q);
  });

  return (
    <div className="w-full bg-white">
      <div className="relative h-80 bg-cover bg-center" style={{
        backgroundImage: "url('https://images.unsplash.com/photo-1504512485720-7d83a16ee930?w=2004')"
      }}>
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Travel News & Updates</h1>
          <p className="text-xl max-w-3xl">Stay informed about the latest developments in Ethiopian tourism</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="relative mb-6 max-w-xl">
          <input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-3 px-4 pr-12 rounded-lg border border-gray-300"
          />
          <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        {loading ? <PageLoader /> : unavailable ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">News is temporarily unavailable.</p>
            <p className="text-sm">Please check back later.</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No articles found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredArticles.map((article) => (
              <Link
                key={article._id}
                to={`/news/${article._id}`}
                className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow block"
              >
                <div className="h-48 overflow-hidden">
                  <img
                    src={article.coverImage || article.image || 'https://images.unsplash.com/photo-1518002054494-3a6f870d4a8f?w=800'}
                    alt={article.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  {article.category && (
                    <span className="inline-block bg-amber-100 text-amber-800 text-xs font-medium px-2 py-1 rounded mb-2">
                      {article.category}
                    </span>
                  )}
                  <h2 className="font-bold text-lg mb-2">{article.title}</h2>
                  {articleBlurb(article) && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-3">{articleBlurb(article)}</p>
                  )}
                  <div className="flex items-center text-gray-500 text-sm mb-3">
                    <Calendar size={14} className="mr-1" />
                    {article.createdAt || article.publishedAt
                      ? new Date(article.createdAt || article.publishedAt!).toLocaleDateString()
                      : 'Recent'}
                  </div>
                  {article.tags && article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {article.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-gray-100 px-2 py-0.5 rounded flex items-center">
                          <Tag size={10} className="mr-1" />{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="flex items-center text-amber-600 font-medium text-sm">
                    Read more <ChevronRight size={16} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
