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

export interface Tour {
  _id: string;
  title: string;
  description: string;
  shortDescription: string;
  duration: { days: number; nights: number };
  price: number;
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
  isFeatured?: boolean;
  status?: string;
  reviews?: Review[];
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
    amount: number;
    currency?: string;
    paymentMethod?: string;
    paymentStatus?: string;
  };
  status?: string;
  createdAt?: string;
}

export interface NewsArticle {
  _id: string;
  title: string;
  excerpt?: string;
  content?: string;
  coverImage?: string;
  image?: string;
  createdAt?: string;
  author?: string;
  category?: string;
  tags?: string[];
}

export interface PaginatedParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}
