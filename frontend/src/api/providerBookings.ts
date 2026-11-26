import api from '../services/api'
import { extractList } from '../utils/apiHelpers'

export interface ProviderBookingPayment {
  _id: string
  status: string
  currency: string
  amountMinor: number
  amountRefundedMinor?: number
  provider: string
  providerPaymentId?: string | null
  expiresAt?: string | null
  completedAt?: string | null
}

export type FulfillmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'no_show'
  | 'cancelled'

export interface ProviderNote {
  _id?: string
  note: string
  createdBy?: string
  createdAt?: string
}

export interface ProviderBookingRow {
  _id: string
  reference: string
  bookingFlowVersion: string
  bookingType: string
  status: string
  organizationId: string
  customer: {
    fullName?: string | null
    email?: string | null
    phone?: string | null
    userId?: string
    accountName?: string | null
  }
  tour: { id?: string | null; title?: string | null; slug?: string | null }
  departure: {
    id?: string | null
    departureDate?: string | null
    returnDate?: string | null
  }
  package: { key?: string | null; name?: string | null }
  transport?: {
    id?: string | null
    name?: string | null
    type?: string | null
  }
  route?: {
    key?: string | null
    from?: string | null
    to?: string | null
    departureTime?: string | null
    arrivalTime?: string | null
    travelDate?: string | null
  }
  hotel?: {
    id?: string | null
    name?: string | null
  }
  stay?: {
    roomTypeKey?: string | null
    roomTypeName?: string | null
    checkIn?: string | null
    checkOut?: string | null
    nightsCount?: number | null
  }
  quantity?: number | null
  priceSnapshot?: {
    currency: string
    quantity: number
    unitPriceMinor: number
    subtotalMinor: number
    totalMinor: number
    packageName?: string
    tourTitle?: string
    departureDate?: string
    transportName?: string
    routeKey?: string
    travelDate?: string
    from?: string
    to?: string
    hotelName?: string
    roomTypeKey?: string
    roomTypeName?: string
    checkIn?: string
    checkOut?: string
  } | null
  payment?: ProviderBookingPayment | null
  inventory?: {
    quantity?: number | null
    reserved?: boolean
    releasedAt?: string | null
  }
  fulfillmentStatus?: FulfillmentStatus
  fulfillmentConfirmedAt?: string | null
  checkedInAt?: string | null
  fulfillmentCompletedAt?: string | null
  noShowAt?: string | null
  providerNotes?: ProviderNote[]
  expiresAt?: string | null
  confirmedAt?: string | null
  cancelledAt?: string | null
  cancellationReason?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface ProviderBookingListResult {
  bookings: ProviderBookingRow[]
  total: number
  page: number
  limit: number
}

function orgHeaders(organizationId: string) {
  return { headers: { 'X-Org-Context': organizationId } }
}

export async function listProviderBookings(
  organizationId: string,
  params: Record<string, string | number | undefined> = {}
): Promise<ProviderBookingListResult> {
  const { data } = await api.get('/provider/bookings', {
    ...orgHeaders(organizationId),
    params,
  })
  const bookings = Array.isArray(data.data)
    ? (data.data as ProviderBookingRow[])
    : extractList<ProviderBookingRow>(data)
  return {
    bookings,
    total: data.total ?? bookings.length,
    page: data.page ?? 1,
    limit: data.limit ?? 20,
  }
}

export async function getProviderBooking(organizationId: string, bookingId: string) {
  const { data } = await api.get(`/provider/bookings/${bookingId}`, orgHeaders(organizationId))
  return data.data as ProviderBookingRow
}

export async function checkInProviderBooking(organizationId: string, bookingId: string) {
  const { data } = await api.post(
    `/provider/bookings/${bookingId}/check-in`,
    {},
    orgHeaders(organizationId)
  )
  return { booking: data.data as ProviderBookingRow, idempotent: Boolean(data.idempotent) }
}

export async function completeProviderBooking(organizationId: string, bookingId: string) {
  const { data } = await api.post(
    `/provider/bookings/${bookingId}/complete`,
    {},
    orgHeaders(organizationId)
  )
  return { booking: data.data as ProviderBookingRow, idempotent: Boolean(data.idempotent) }
}

/** Hotel check-out alias (same completed fulfillment transition). */
export async function checkOutProviderBooking(organizationId: string, bookingId: string) {
  const { data } = await api.post(
    `/provider/bookings/${bookingId}/check-out`,
    {},
    orgHeaders(organizationId)
  )
  return { booking: data.data as ProviderBookingRow, idempotent: Boolean(data.idempotent) }
}

export async function noShowProviderBooking(organizationId: string, bookingId: string) {
  const { data } = await api.post(
    `/provider/bookings/${bookingId}/no-show`,
    {},
    orgHeaders(organizationId)
  )
  return { booking: data.data as ProviderBookingRow, idempotent: Boolean(data.idempotent) }
}

export async function addProviderBookingNote(
  organizationId: string,
  bookingId: string,
  note: string
) {
  const { data } = await api.post(
    `/provider/bookings/${bookingId}/notes`,
    { note },
    orgHeaders(organizationId)
  )
  return data.data as ProviderBookingRow
}

export async function listAdminV2Bookings(
  params: Record<string, string | number | undefined> = {}
): Promise<ProviderBookingListResult> {
  const { data } = await api.get('/admin/bookings', { params })
  const bookings = Array.isArray(data.data)
    ? (data.data as ProviderBookingRow[])
    : extractList<ProviderBookingRow>(data)
  return {
    bookings,
    total: data.total ?? bookings.length,
    page: data.page ?? 1,
    limit: data.limit ?? 20,
  }
}

export async function getAdminV2Booking(bookingId: string) {
  const { data } = await api.get(`/admin/bookings/${bookingId}`)
  return data.data as ProviderBookingRow
}
