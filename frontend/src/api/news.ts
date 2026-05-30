import api from "../services/api";
import { extractList, extractOne } from "../utils/apiHelpers";
import type { NewsArticle, PaginatedParams } from "../types";

export const getNews = async (params: PaginatedParams = {}) => {
  const res = await api.get("/news", { params });
  return { articles: extractList<NewsArticle>(res.data), total: res.data.results ?? 0 };
};

export const getFeaturedNews = async () => {
  const res = await api.get("/news/featured");
  return extractList<NewsArticle>(res.data);
};

export const getNewsById = async (id: string) => {
  const res = await api.get(`/news/${id}`);
  return extractOne<NewsArticle>(res.data);
};
