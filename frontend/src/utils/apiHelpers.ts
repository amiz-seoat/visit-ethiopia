export function extractList<T>(data: unknown): T[] {
  if (!data || typeof data !== "object") return [];

  const payload = data as Record<string, unknown>;

  if (Array.isArray(payload.data)) return payload.data as T[];

  if (payload.data && typeof payload.data === "object") {
    const nested = payload.data as Record<string, unknown>;
    if (Array.isArray(nested.data)) return nested.data as T[];
    if (Array.isArray(nested.reviews)) return nested.reviews as T[];
    if (Array.isArray(nested.tours)) return nested.tours as T[];
  }

  if (Array.isArray(payload.reviews)) return payload.reviews as T[];
  if (Array.isArray(payload.tours)) return payload.tours as T[];

  return [];
}

export function extractOne<T>(data: unknown): T | null {
  if (!data || typeof data !== "object") return null;

  const payload = data as Record<string, unknown>;

  if (payload.data && typeof payload.data === "object") {
    const nested = payload.data as Record<string, unknown>;
    if (nested.data && typeof nested.data === "object") return nested.data as T;
    if (!Array.isArray(nested.data)) return nested as T;
  }

  return null;
}

export function extractResults(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  return (data as { results?: number }).results ?? 0;
}

export function hotelPriceRange(roomTypes?: { price: number }[]): string {
  if (!roomTypes?.length) return "Contact for price";
  const min = Math.min(...roomTypes.map((room) => room.price));
  return `${min.toLocaleString()} ETB/night`;
}

export function formatTourDuration(duration?: { days: number; nights: number }): string {
  if (!duration) return "";
  return `${duration.days} Days / ${duration.nights} Nights`;
}
