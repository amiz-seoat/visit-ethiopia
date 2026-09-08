import api from "../services/api";
import { extractList } from "../utils/apiHelpers";
import type { Booking, V2Booking } from "../types";

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

export interface CreateTourBookingPayload {
  departureId: string;
  packageKey: string;
  quantity: number;
  contactInfo: {
    fullName: string;
    email: string;
    phone: string;
    address?: string;
  };
}

export interface TourBookingResult {
  booking: V2Booking;
  statusCode: number;
  idempotent: boolean;
}

/** Legacy booking (hotels / transports / restaurants). */
export const createBooking = async (payload: CreateBookingPayload) => {
  const res = await api.post("/bookings", payload);
  return res.data.data as Booking;
};

/** Phase 4G — v2 tour departure booking. Requires Idempotency-Key. */
export const createTourBooking = async (
  payload: CreateTourBookingPayload,
  idempotencyKey: string
): Promise<TourBookingResult> => {
  const res = await api.post("/bookings/tours", payload, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return {
    booking: res.data.data as V2Booking,
    statusCode: res.status,
    idempotent: Boolean(res.data.idempotent),
  };
};

export const getMyBookings = async () => {
  const res = await api.get("/bookings/me");
  return extractList<Booking | V2Booking>(res.data);
};

export const getBookingById = async (id: string) => {
  const res = await api.get(`/bookings/${id}`);
  return res.data.data as Booking | V2Booking;
};

export interface CancelBookingResult {
  booking: Booking | V2Booking;
  idempotent: boolean;
  failed: boolean;
  refund: {
    _id?: string;
    status?: string;
    amountMinor?: number;
    currency?: string;
  } | null;
  payment: {
    _id?: string;
    status?: string;
    amountMinor?: number;
    amountRefundedMinor?: number;
    currency?: string;
  } | null;
}

export const cancelBooking = async (
  id: string,
  opts: { reason?: string; idempotencyKey?: string } = {}
): Promise<CancelBookingResult> => {
  const headers: Record<string, string> = {};
  if (opts.idempotencyKey) {
    headers["Idempotency-Key"] = opts.idempotencyKey;
  }
  const res = await api.patch(
    `/bookings/${id}/cancel`,
    opts.reason ? { reason: opts.reason } : {},
    { headers }
  );
  return {
    booking: res.data.data as Booking | V2Booking,
    idempotent: Boolean(res.data.idempotent),
    failed: Boolean(res.data.failed),
    refund: (res.data.refund ?? null) as {
      status?: string;
      amountMinor?: number;
      currency?: string;
    } | null,
    payment: res.data.payment ?? null,
  };
};

export const getAllBookings = async () => {
  const res = await api.get("/bookings");
  return extractList<Booking>(res.data);
};

export const updateBookingStatus = async (id: string, status: string) => {
  const res = await api.patch(`/bookings/${id}/status`, { status });
  return res.data.data as Booking;
};
