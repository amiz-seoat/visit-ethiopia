import api from '../services/api';

export interface Paged<T> {
  total: number;
  page: number;
  limit: number;
  data: T[];
}

export interface AdminOverview {
  periodDays: number;
  since: string;
  users: {
    total: number;
    active: number;
    suspended: number;
    newInPeriod: number;
    byRole: Record<string, number>;
  };
  bookings: {
    total: number;
    inPeriod: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
  revenue: {
    allTimeMinor: Record<string, number>;
    periodMinor: Record<string, number>;
    paymentsByProvider: Record<string, number>;
    refundsInPeriod: { count: number; amountMinor: number };
  };
  series: { date: string; bookings: number; revenueMinorEtb: number }[];
  topListings: { type: string; id: string; title: string; bookings: number }[];
  providers: { byApprovalStatus: Record<string, number> };
  queues: {
    pendingApprovals: number;
    pendingReviews: number;
    newContacts: number;
    flaggedPayments: number;
    failedRefunds: number;
    expiredHoldsAwaitingCleanup: number;
  };
}

export interface AdminBookingRow {
  _id: string;
  reference: string;
  bookingType: string;
  status: string;
  fulfillmentStatus?: string;
  itemTitle: string;
  bookingItemId: string;
  customer: { _id: string; name: string; email: string } | null;
  totalMinor: number | null;
  currency: string;
  payment: {
    _id: string;
    status: string;
    provider: string;
    amountMinor: number;
    amountRefundedMinor: number;
    flagged: boolean;
  } | null;
  createdAt: string;
  expiresAt?: string | null;
}

export interface AdminPaymentRow {
  _id: string;
  bookingId: string;
  bookingReference: string;
  bookingStatus?: string;
  itemTitle: string | null;
  customerEmail: string | null;
  status: string;
  provider: string;
  amountMinor: number;
  amountRefundedMinor: number;
  currency: string;
  providerPaymentId?: string | null;
  flagged: boolean;
  flagReason?: string | null;
  refundReview?: { resolution: string; note: string; resolvedBy: string; resolvedAt: string } | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface AdminUserRow {
  _id: string;
  FirstName: string;
  LastName: string;
  email: string;
  role: string;
  active: boolean;
  isVerified: boolean;
  createdAt: string;
  bookingsCount?: number;
}

export interface AuditRow {
  _id: string;
  actorId: string;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AssistantInsights {
  total: number;
  unanswered: number;
  byMode: Record<string, number>;
  avgLatencyMs: number | null;
  topSources: { id: string; count: number }[];
  recentUnanswered: { id: string; question: string; createdAt: string }[];
}

type Query = Record<string, string | number | boolean | undefined>;
const clean = (q: Query) =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== ''));

export const getAdminOverview = async (days = 30): Promise<AdminOverview> =>
  (await api.get('/admin/overview', { params: { days } })).data.data;

export const listAdminBookings = async (q: Query): Promise<Paged<AdminBookingRow>> =>
  (await api.get('/admin/console/bookings', { params: clean(q) })).data.data;

export const getAdminBookingDetail = async (id: string) =>
  (await api.get(`/admin/console/bookings/${id}`)).data.data.booking as Record<string, any>;

export const listAdminPayments = async (q: Query): Promise<Paged<AdminPaymentRow>> =>
  (await api.get('/admin/payments', { params: clean(q) })).data.data;

export const resolvePaymentReview = async (
  id: string,
  body: { resolution: string; note: string }
) => (await api.post(`/admin/payments/${id}/resolve-review`, body)).data.data;

export const verifyPaymentNow = async (id: string) =>
  (await api.post(`/admin/payments/${id}/verify`)).data.data as {
    outcome: string;
    paymentStatus?: string;
    bookingStatus?: string;
  };

export const listAdminUsers = async (q: Query): Promise<Paged<AdminUserRow>> =>
  (await api.get('/admin/users', { params: clean(q) })).data.data;

export const updateAdminUser = async (id: string, body: { role?: string; active?: boolean }) =>
  (await api.patch(`/admin/users/${id}`, body)).data.data.user as AdminUserRow;

export const listAuditLog = async (q: Query): Promise<Paged<AuditRow>> =>
  (await api.get('/admin/audit-log', { params: clean(q) })).data.data;

export const getAssistantInsights = async (days = 30): Promise<AssistantInsights> =>
  (await api.get('/admin/assistant-insights', { params: { days } })).data.data;

export const formatMoney = (minor: number | null | undefined, currency = 'ETB') =>
  minor == null
    ? '—'
    : `${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
