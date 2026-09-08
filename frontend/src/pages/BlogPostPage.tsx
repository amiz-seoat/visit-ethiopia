import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, ArrowLeft, Tag } from 'lucide-react';
import { getNewsById } from '../api/news';
import { PageError, PageLoader } from '../components/ui/PageStatus';
import { getErrorMessage } from '../services/api';
import type { NewsArticle } from '../types';

export function BlogPostPage() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getNewsById(id)
      .then((data) => {
        if (!cancelled) {
          if (!data) setError('Article not found');
          else setArticle(data);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load article'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <PageLoader message="Loading article..." />;
  if (error || !article) return <PageError message={error || 'Article not found'} />;

  const authorName =
    typeof article.author === 'object' && article.author
      ? `${(article.author as { FirstName?: string; LastName?: string }).FirstName || ''} ${(article.author as { LastName?: string }).LastName || ''}`.trim()
      : typeof article.author === 'string'
        ? article.author
        : 'Visit Ethiopia';

  return (
    <div className="w-full bg-white">
      <div className="relative h-80 bg-cover bg-center" style={{
        backgroundImage: `url('${article.coverImage || article.image || 'https://images.unsplash.com/photo-1518002054494-3a6f870d4a8f?w=1200'}')`
      }}>
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative h-full container mx-auto px-4 flex flex-col justify-end pb-10 text-white">
          {article.category && (
            <span className="inline-block bg-amber-600 text-white text-xs font-medium px-2 py-1 rounded mb-3 w-fit">
              {article.category}
            </span>
          )}
          <h1 className="text-3xl md:text-5xl font-bold max-w-4xl">{article.title}</h1>
          <div className="flex items-center gap-4 mt-4 text-sm text-white/90">
            <span>{authorName}</span>
            <span className="flex items-center">
              <Calendar size={14} className="mr-1" />
              {article.createdAt || article.publishedAt
                ? new Date(article.createdAt || article.publishedAt!).toLocaleDateString()
                : 'Recent'}
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <Link to="/news" className="inline-flex items-center text-amber-700 mb-6 hover:underline">
          <ArrowLeft size={16} className="mr-1" /> Back to news
        </Link>
        {(article.summary || article.excerpt) && (
          <p className="text-xl text-gray-700 mb-6">{article.summary || article.excerpt}</p>
        )}
        <div className="prose max-w-none text-gray-800 whitespace-pre-wrap leading-relaxed">
          {article.content}
        </div>
        {article.tags?.length ? (
          <div className="flex flex-wrap gap-2 mt-8">
            {article.tags.map((tag) => (
              <span key={tag} className="text-xs bg-gray-100 px-2 py-1 rounded flex items-center">
                <Tag size={10} className="mr-1" />{tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
