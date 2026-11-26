import api from "../services/api";
import { extractList, extractOne } from "../utils/apiHelpers";
import type { Transport, PaginatedParams } from "../types";

export const getTransports = async (
  params: PaginatedParams & { allStatuses?: boolean } = {}
) => {
  const { allStatuses, status, ...rest } = params;
  const res = await api.get("/transports", {
    params: {
      ...rest,
      ...(allStatuses ? {} : { status: status ?? "active" }),
    },
  });
  return {
    transports: extractList<Transport>(res.data),
    total: res.data.results ?? 0,
  };
};

export const getTransportById = async (id: string) => {
  const res = await api.get(`/transports/${id}`);
  return extractOne<Transport>(res.data);
};

export const getTransportAvailability = async (
  id: string,
  params: { travelDate: string; routeKey?: string }
) => {
  const res = await api.get(`/transports/${id}/availability`, { params });
  return res.data.data as {
    transportId: string;
    travelDate: string;
    availability: Array<{
      routeKey: string;
      from: string;
      to: string;
      departureTime: string;
      arrivalTime: string;
      travelDate: string;
      availableSeats: number;
      totalSeats: number;
      hasInventory: boolean;
      priceMinor: number;
      currency: string;
      priceSource: string;
    }>;
  };
};

export const getTransportRoutes = async () => {
  const res = await api.get("/transports/routes");
  return extractList(res.data);
};

export const getTransportReviews = async (id: string) => {
  const res = await api.get(`/transports/${id}/reviews`);
  return extractList(res.data);
};
