import api from '../services/api';
import { extractList, extractOne } from '../utils/apiHelpers';

export interface TourPackage {
  key: string;
  name: string;
  description?: string;
  priceMinor: number;
  currency?: string;
  capacity?: number;
  includedItems?: string[];
  excludedItems?: string[];
  benefits?: string[];
  active?: boolean;
}

export interface TourDeparture {
  _id: string;
  tourId: string;
  organizationId: string;
  departureDate: string;
  returnDate?: string;
  capacity: number;
  availableSpots: number;
  status: string;
  packages?: Array<{
    key: string;
    priceMinor: number;
    currency?: string;
    capacity?: number;
    availableSpots?: number;
    active?: boolean;
  }>;
  notes?: string;
}

export interface MarketplaceTour {
  _id: string;
  slug?: string;
  title: string;
  shortDescription: string;
  description: string;
  duration: { days: number; nights: number };
  destinations: string[];
  price: number;
  priceMinor?: number;
  currency?: string;
  coverImage: string;
  highlights?: string[];
  packages?: TourPackage[];
  averageRating?: number;
  reviewCount?: number;
  organization?: {
    _id: string;
    slug: string;
    name: string;
    logo?: string;
    location?: unknown;
    averageRating?: number;
    reviewCount?: number;
  };
}

function orgHeaders(organizationId: string) {
  return { headers: { 'X-Org-Context': organizationId } };
}

export async function listOrganizationTours(
  organizationId: string,
  params: { status?: string } = {}
) {
  const { data } = await api.get(`/organizations/${organizationId}/tours`, {
    ...orgHeaders(organizationId),
    params,
  });
  return extractList<MarketplaceTour>(data);
}

export async function getOrganizationTour(organizationId: string, tourId: string) {
  const { data } = await api.get(
    `/organizations/${organizationId}/tours/${tourId}`,
    orgHeaders(organizationId)
  );
  return extractOne<MarketplaceTour>(data);
}

export async function createOrganizationTour(
  organizationId: string,
  payload: Record<string, unknown>
) {
  const { data } = await api.post(
    `/organizations/${organizationId}/tours`,
    payload,
    orgHeaders(organizationId)
  );
  return extractOne<MarketplaceTour>(data);
}

export async function updateOrganizationTour(
  organizationId: string,
  tourId: string,
  payload: Record<string, unknown>
) {
  const { data } = await api.patch(
    `/organizations/${organizationId}/tours/${tourId}`,
    payload,
    orgHeaders(organizationId)
  );
  return extractOne<MarketplaceTour>(data);
}

export async function publishOrganizationTour(organizationId: string, tourId: string) {
  const { data } = await api.post(
    `/organizations/${organizationId}/tours/${tourId}/publish`,
    {},
    orgHeaders(organizationId)
  );
  return extractOne<MarketplaceTour>(data);
}

export async function unpublishOrganizationTour(organizationId: string, tourId: string) {
  const { data } = await api.post(
    `/organizations/${organizationId}/tours/${tourId}/unpublish`,
    {},
    orgHeaders(organizationId)
  );
  return extractOne<MarketplaceTour>(data);
}

export async function archiveOrganizationTour(organizationId: string, tourId: string) {
  const { data } = await api.post(
    `/organizations/${organizationId}/tours/${tourId}/archive`,
    {},
    orgHeaders(organizationId)
  );
  return extractOne<MarketplaceTour>(data);
}

export async function listTourDepartures(organizationId: string, tourId: string) {
  const { data } = await api.get(
    `/organizations/${organizationId}/tours/${tourId}/departures`,
    orgHeaders(organizationId)
  );
  return extractList<TourDeparture>(data);
}

export async function createTourDeparture(
  organizationId: string,
  tourId: string,
  payload: Record<string, unknown>
) {
  const { data } = await api.post(
    `/organizations/${organizationId}/tours/${tourId}/departures`,
    payload,
    orgHeaders(organizationId)
  );
  return extractOne<TourDeparture>(data);
}

export async function getMarketplaceTours(params: Record<string, string | number | undefined> = {}) {
  const { data } = await api.get('/tours/marketplace', { params });
  return { tours: extractList<MarketplaceTour>(data), total: data.results ?? 0 };
}

export async function getTourBySlug(slug: string) {
  const { data } = await api.get(`/tours/${slug}`);
  return extractOne<MarketplaceTour>(data);
}

export async function getPublicTourDepartures(tourSlug: string, params: Record<string, string> = {}) {
  const { data } = await api.get(`/tours/${tourSlug}/departures`, { params });
  return extractList<TourDeparture>(data);
}

export async function getOrganizationPublicTours(slug: string) {
  const { data } = await api.get(`/organizations/${slug}/tours`);
  return extractList<MarketplaceTour>(data);
}

export async function getOrganizationBySlug(slug: string) {
  const { data } = await api.get(`/organizations/${slug}`);
  return data.data?.data as Record<string, unknown>;
}
