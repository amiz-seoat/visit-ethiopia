import api from '../services/api';
import { extractOne } from '../utils/apiHelpers';
import type { Destination, NewsArticle } from '../types';
import type { Restaurant } from './restaurants';

export const createRestaurant = async (data: Record<string, unknown>) => {
  const res = await api.post('/restaurants', data);
  return extractOne<Restaurant>(res.data) ?? res.data.data?.restaurant ?? res.data.data;
};

export const createDestination = async (data: Record<string, unknown>) => {
  const res = await api.post('/destinations', data);
  return extractOne<Destination>(res.data);
};

export const createNewsArticle = async (data: Record<string, unknown>) => {
  const res = await api.post('/news', data);
  return extractOne<NewsArticle>(res.data) ?? res.data.data;
};
