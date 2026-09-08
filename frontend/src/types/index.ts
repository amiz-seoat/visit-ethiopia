export type UserRole =
  | "admin"
  | "user"
  | "guide"
  | "customer"
  | "tour_operator"
  | "hotel_manager"
  | "transport_manager";

export interface User {
  _id: string;
  FirstName: string;
  LastName: string;
  email: string;
  role: UserRole;
  isVerified?: boolean;
  createdAt?: string;
  favorites?: string[];
}

export interface TourPackageOption {
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

export interface Tour {
  _id: string;
  slug?: string;
  title: string;
  description: string;
  shortDescription: string;
  duration: { days: number; nights: number };
  price: number;
  priceMinor?: number;
  currency?: string;
  discount?: number;
  coverImage: string;
  images?: string[];
  averageRating?: number;
  maxGroupSize?: number;
  currentBookings?: number;
  availableDates?: string[];
  itinerary?: { day: number; title: string; description: string }[];
  inclusions?: string[];
  exclusions?: string[];
  packages?: TourPackageOption[];
  isFeatured?: boolean;
  status?: string;
  reviews?: Review[];
  createdBy?: string | { _id: string };
  organization?: {
    _id?: string;
    slug?: string;
    name?: string;
    logo?: string;
  };
}

export interface Hotel {
  _id: string;
  name: string;
  description: string;
  shortDescription: string;
  coverImage: string;
  images?: string[];
  stars?: number;
  averageRating?: number;
  location?: { city: string; region: string; address?: string };
  roomTypes?: {
    type: string;
    description?: string;
    price: number;
    capacity: number;
    availableRooms: number;
    images?: string[];
  }[];
  amenities?: string[];
  contact?: { phone?: string; email?: string; website?: string };
  isFeatured?: boolean;
  status?: string;
  createdBy?: string | { _id: string };
}

export interface Destination {
  _id: string;
  name: string;
  description: string;
  shortDescription: string;
  coverImage: string;
  images?: string[];
  region: string;
  attractions?: string[];
  isFeatured?: boolean;
  status?: string;
  tours?: Tour[];
}

export interface TransportRoute {
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  duration?: string;
  price: number;
  availableSeats: number;
}

export interface Transport {
  _id: string;
  name: string;
  description: string;
  type: string;
  routes?: TransportRoute[];
  vehicleDetails?: { model?: string; images?: string[] };
  averageRating?: number;
  status?: string;
  createdBy?: string | { _id: string };
}

export interface Review {
  _id: string;
  rating: number;
  title?: string;
  comment?: string;
  status?: string;
  createdAt?: string;
  user?: { FirstName?: string; LastName?: string; email?: string };
}

export interface Booking {
  _id: string;
  bookingType: "tour" | "hotel" | "transport" | "restaurant";
  bookingItem: string;
  bookingDetails?: {
    startDate?: string;
    endDate?: string;
    quantity?: number;
    participants?: { name: string; age?: number; specialRequirements?: string }[];
  };
  contactInfo?: { fullName: string; email: string; phone: string; address?: string };
  payment?: {
    amount?: number;
    amountMinor?: number;
    currency?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    status?: string;
  };
  status?: string;
  createdAt?: string;
  /** Phase 4 v2 fields (optional on legacy) */
  bookingFlowVersion?: "legacy" | "v2";
  departureId?: string;
  organizationId?: string;
  packageKey?: string;
  paymentId?: string;
  inventoryQuantity?: number;
  priceSnapshot?: PriceSnapshot;
  expiresAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface PriceSnapshot {
  currency: string;
  quantity: number;
  unitPriceMinor: number;
  subtotalMinor: number;
  discountMinor?: number;
  feesMinor?: number;
  taxMinor?: number;
  totalMinor: number;
  tourId?: string;
  tourTitle?: string;
  tourSlug?: string;
  departureId?: string;
  departureDate?: string;
  returnDate?: string | null;
  packageKey?: string;
  packageName?: string;
  organizationId?: string;
  organizationName?: string;
  organizationSlug?: string;
  pricedFrom?: string;
  pricedAt?: string;
}

export interface PaymentRecord {
  _id: string;
  bookingId: string;
  organizationId: string;
  amountMinor: number;
  amountRefundedMinor?: number;
  currency: string;
  status: string;
  provider: string;
  providerPaymentId?: string | null;
  expiresAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface V2Booking {
  _id: string;
  bookingFlowVersion: "v2";
  bookingType: "tour";
  status: string;
  departureId: string;
  organizationId: string;
  packageKey: string;
  paymentId?: string | null;
  inventoryQuantity?: number;
  inventoryReserved?: boolean;
  inventoryReleasedAt?: string | null;
  priceSnapshot?: PriceSnapshot;
  contactInfo?: { fullName: string; email: string; phone: string; address?: string };
  expiresAt?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  payment?: PaymentRecord | null;
}

export interface NewsArticle {
  _id: string;
  title: string;
  excerpt?: string;
  summary?: string;
  content?: string;
  coverImage?: string;
  image?: string;
  createdAt?: string;
  publishedAt?: string;
  author?: string | { FirstName?: string; LastName?: string; email?: string };
  category?: string;
  tags?: string[];
}

export interface PaginatedParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}
