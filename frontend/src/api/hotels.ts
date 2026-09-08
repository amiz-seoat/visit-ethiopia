import api from "../services/api";
import { extractList, extractOne } from "../utils/apiHelpers";
import type { Hotel, PaginatedParams } from "../types";

export const getHotels = async (
  params: PaginatedParams & { allStatuses?: boolean } = {}
) => {
  const { allStatuses, status, ...rest } = params;
  const res = await api.get("/hotels", {
    params: {
      ...rest,
      ...(allStatuses ? {} : { status: status ?? "active" }),
    },
  });
  return { hotels: extractList<Hotel>(res.data), total: res.data.results ?? 0 };
};

export const getFeaturedHotels = async () => {
  const res = await api.get("/hotels/featured");
  return extractList<Hotel>(res.data);
};

export const getHotelById = async (id: string) => {
  const res = await api.get(`/hotels/${id}`);
  return extractOne<Hotel>(res.data);
};

export const getHotelReviews = async (id: string) => {
  const res = await api.get(`/hotels/${id}/reviews`);
  return extractList(res.data);
};
