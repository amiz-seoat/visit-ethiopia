import api from "../services/api";
import { extractList, extractOne } from "../utils/apiHelpers";
import type { PaginatedParams } from "../types";

export interface Restaurant {
  _id: string;
  name: string;
  description: string;
  shortDescription: string;
  cuisineType?: string[];
  coverImage: string;
  images?: string[];
  location?: { city: string; region: string; address?: string };
  priceRange?: string;
  averageRating?: number;
  isFeatured?: boolean;
  status?: string;
  menu?: {
    category: string;
    items: { name: string; description?: string; price: number }[];
  }[];
  contact?: { phone?: string; email?: string; website?: string };
}

export const getRestaurants = async (params: PaginatedParams = {}) => {
  const res = await api.get("/restaurants", {
    params: { status: "active", ...params },
  });
  return {
    restaurants: extractList<Restaurant>(res.data),
    total: res.data.results ?? 0,
  };
};

export const getFeaturedRestaurants = async () => {
  const res = await api.get("/restaurants/featured");
  return extractList<Restaurant>(res.data);
};

export const getRestaurantById = async (id: string) => {
  const res = await api.get(`/restaurants/${id}`);
  return extractOne<Restaurant>(res.data);
};

export const getRestaurantReviews = async (id: string) => {
  const res = await api.get(`/restaurants/${id}/reviews`);
  return extractList(res.data);
};
