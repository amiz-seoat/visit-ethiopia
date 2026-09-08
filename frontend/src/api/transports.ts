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

export const getTransportRoutes = async () => {
  const res = await api.get("/transports/routes");
  return extractList(res.data);
};

export const getTransportReviews = async (id: string) => {
  const res = await api.get(`/transports/${id}/reviews`);
  return extractList(res.data);
};
