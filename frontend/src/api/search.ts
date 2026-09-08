import api from '../services/api';
import { extractList } from '../utils/apiHelpers';
import type {
  Destination,
  Hotel,
  NewsArticle,
  Tour,
  Transport,
} from '../types';
import type { Restaurant } from './restaurants';

export interface GlobalSearchResults {
  query: string;
  tours: Tour[];
  hotels: Hotel[];
  destinations: Destination[];
  transports: Transport[];
  restaurants: Restaurant[];
  news: NewsArticle[];
}

export async function globalSearch(query: string): Promise<GlobalSearchResults> {
  const q = query.trim();
  if (!q) {
    return {
      query: q,
      tours: [],
      hotels: [],
      destinations: [],
      transports: [],
      restaurants: [],
      news: [],
    };
  }

  const params = { search: q, limit: 8, status: 'active' as const };

  const [toursRes, hotelsRes, destinationsRes, transportsRes, restaurantsRes, newsRes] =
    await Promise.allSettled([
      api.get('/tours', { params }),
      api.get('/hotels', { params }),
      api.get('/destinations', { params }),
      api.get('/transports', { params }),
      api.get('/restaurants', { params }),
      api.get('/news', { params: { search: q, limit: 8 } }),
    ]);

  const list = <T,>(result: PromiseSettledResult<{ data: unknown }>): T[] => {
    if (result.status !== 'fulfilled') return [];
    return extractList<T>(result.value.data);
  };

  return {
    query: q,
    tours: list(toursRes),
    hotels: list(hotelsRes),
    destinations: list(destinationsRes),
    transports: list(transportsRes),
    restaurants: list(restaurantsRes),
    news: list(newsRes),
  };
}
