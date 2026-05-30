import api from "../services/api";
import { extractList, extractOne } from "../utils/apiHelpers";
import type { Transport, PaginatedParams } from "../types";

export const getTransports = async (params: PaginatedParams = {}) => {
  const res = await api.get("/transports", {
    params: { status: "active", ...params },
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

export const getTransportRoutes = async () => {
  const res = await api.get("/transports/routes");
  return extractList(res.data);
};

export const getTransportReviews = async (id: string) => {
  const res = await api.get(`/transports/${id}/reviews`);
  return extractList(res.data);
};
