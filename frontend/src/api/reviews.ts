import api from "../services/api";
import { extractList } from "../utils/apiHelpers";
import type { Review } from "../types";

export interface CreateReviewPayload {
  itemType: "tour" | "hotel" | "transport" | "restaurant";
  itemId: string;
  rating: number;
  title?: string;
  comment?: string;
}

export const createReview = async (payload: CreateReviewPayload) => {
  const res = await api.post("/reviews", payload);
  return res.data.data as Review;
};

export const getMyReviews = async () => {
  const res = await api.get("/reviews/me");
  return extractList<Review>(res.data);
};

export const getPendingReviews = async () => {
  const res = await api.get("/reviews/pending");
  return extractList<Review>(res.data);
};

export const approveReview = async (id: string) => {
  const res = await api.patch(`/reviews/${id}/approve`);
  return res.data.data as Review;
};

export const updateReview = async (id: string, data: Partial<CreateReviewPayload>) => {
  const res = await api.patch(`/reviews/${id}`, data);
  return res.data.data as Review;
};

export const deleteReview = async (id: string) => {
  await api.delete(`/reviews/${id}`);
};
