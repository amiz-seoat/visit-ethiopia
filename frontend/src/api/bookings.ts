import api from "../services/api";
import { extractList } from "../utils/apiHelpers";
import type { Booking } from "../types";

export interface CreateBookingPayload {
  bookingType: "tour" | "hotel" | "transport" | "restaurant";
  bookingItem: string;
  bookingDetails?: Booking["bookingDetails"];
  contactInfo: {
    fullName: string;
    email: string;
    phone: string;
    address?: string;
  };
  payment: {
    amount: number;
    currency?: string;
    paymentMethod: string;
    paymentStatus?: string;
  };
  notes?: string;
}

export const createBooking = async (payload: CreateBookingPayload) => {
  const res = await api.post("/bookings", payload);
  return res.data.data as Booking;
};

export const getMyBookings = async () => {
  const res = await api.get("/bookings/me");
  return extractList<Booking>(res.data);
};

export const getBookingById = async (id: string) => {
  const res = await api.get(`/bookings/${id}`);
  return res.data.data as Booking;
};

export const cancelBooking = async (id: string) => {
  const res = await api.patch(`/bookings/${id}/cancel`);
  return res.data.data as Booking;
};

export const getAllBookings = async () => {
  const res = await api.get("/bookings");
  return extractList<Booking>(res.data);
};

export const updateBookingStatus = async (id: string, status: string) => {
  const res = await api.patch(`/bookings/${id}/status`, { status });
  return res.data.data as Booking;
};
