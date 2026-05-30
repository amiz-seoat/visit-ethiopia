import api from "../services/api";
import { extractList, extractOne } from "../utils/apiHelpers";
import type { Tour, PaginatedParams } from "../types";

export const getTours = async (params: PaginatedParams = {}) => {
  const res = await api.get("/tours", {
    params: { status: "active", ...params },
  });
  return { tours: extractList<Tour>(res.data), total: res.data.results ?? 0 };
};

export const getFeaturedTours = async () => {
  const res = await api.get("/tours/featured");
  return extractList<Tour>(res.data);
};

export const getTourById = async (id: string) => {
  const res = await api.get(`/tours/${id}`);
  return extractOne<Tour>(res.data);
};

export const getTourReviews = async (id: string) => {
  const res = await api.get(`/tours/${id}/reviews`);
  return extractList(res.data);
};

export const createTour = async (data: Partial<Tour>) => {
  const res = await api.post("/tours", data);
  return extractOne<Tour>(res.data);
};

export const updateTour = async (id: string, data: Partial<Tour>) => {
  const res = await api.patch(`/tours/${id}`, data);
  return extractOne<Tour>(res.data);
};

export const deleteTour = async (id: string) => {
  await api.delete(`/tours/${id}`);
};
