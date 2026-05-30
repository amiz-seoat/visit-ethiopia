import api from "../services/api";
import { extractList, extractOne } from "../utils/apiHelpers";
import type { Destination, PaginatedParams, Tour } from "../types";

export const getDestinations = async (params: PaginatedParams = {}) => {
  const res = await api.get("/destinations", {
    params: { status: "active", ...params },
  });
  return {
    destinations: extractList<Destination>(res.data),
    total: res.data.results ?? 0,
  };
};

export const getFeaturedDestinations = async () => {
  const res = await api.get("/destinations/featured");
  return extractList<Destination>(res.data);
};

export const getDestinationById = async (id: string) => {
  const res = await api.get(`/destinations/${id}`);
  return extractOne<Destination>(res.data);
};

export const getDestinationTours = async (id: string) => {
  const res = await api.get(`/destinations/${id}/tours`);
  return extractList<Tour>(res.data);
};
