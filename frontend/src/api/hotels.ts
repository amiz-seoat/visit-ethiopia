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

export const getHotelAvailability = async (
  hotelId: string,
  params: { checkIn: string; checkOut: string; roomTypeKey?: string }
) => {
  const res = await api.get(`/hotels/${hotelId}/availability`, { params });
  return res.data.data as {
    hotelId: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    roomTypes: Array<{
      roomTypeKey: string;
      name: string;
      capacity?: number;
      currency?: string;
      price?: number;
      priceMinor?: number;
      available: boolean;
      minAvailableRooms: number;
      nightsMissingInventory: number;
      days: Array<{
        date: string;
        availableRooms: number;
        totalRooms: number;
        priceOverrideMinor?: number | null;
        missing?: boolean;
      }>;
    }>;
  };
};

export const getHotelReviews = async (id: string) => {
  const res = await api.get(`/hotels/${id}/reviews`);
  return extractList(res.data);
};
