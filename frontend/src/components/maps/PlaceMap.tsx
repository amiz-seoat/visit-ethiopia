import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { ExternalLink, Navigation } from 'lucide-react';
import {
  ETHIOPIA_CENTER,
  googleMapsDirectionsUrl,
  googleMapsSearchUrl,
  type LatLng,
} from '../../utils/geo';

export interface MapPoint extends LatLng {
  id: string;
  title: string;
  subtitle?: string;
  href?: string; // in-app link
}

// Inline SVG pin — avoids Leaflet's default marker images, which break under bundlers.
const pinIcon = L.divIcon({
  className: 've-map-pin',
  html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M14 0C6.3 0 0 6.2 0 13.9 0 24.3 14 40 14 40s14-15.7 14-26.1C28 6.2 21.7 0 14 0z" fill="#d97706"/>
    <circle cx="14" cy="14" r="5.5" fill="#fff"/></svg>`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -36],
});

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), {
        padding: [40, 40],
        maxZoom: 13,
      });
    }
  }, [map, points]);
  return null;
}

interface PlaceMapProps {
  points: MapPoint[];
  height?: number;
  zoom?: number;
  className?: string;
  /** Show the Google Maps buttons below the map (single-point maps). */
  showGoogleLinks?: boolean;
}

export function PlaceMap({
  points,
  height = 320,
  zoom = 13,
  className = '',
  showGoogleLinks = true,
}: PlaceMapProps) {
  const center = useMemo<LatLng>(() => points[0] ?? ETHIOPIA_CENTER, [points]);
  if (!points.length) return null;
  const single = points.length === 1 ? points[0] : null;

  return (
    <div className={className}>
      <div
        className="rounded-lg overflow-hidden border border-gray-200 relative z-0"
        style={{ height }}
      >
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={single ? zoom : 6}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon} title={p.title}>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{p.title}</p>
                  {p.subtitle && <p className="text-gray-600">{p.subtitle}</p>}
                  <div className="mt-1 flex gap-3">
                    {p.href && <Link to={p.href}>View</Link>}
                    <a href={googleMapsSearchUrl(p, p.title)} target="_blank" rel="noopener noreferrer">
                      Google Maps
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
          <FitBounds points={points} />
        </MapContainer>
      </div>
      {showGoogleLinks && single && <GoogleMapsButtons point={single} label={single.title} />}
    </div>
  );
}

export function GoogleMapsButtons({ point, label }: { point: LatLng | null; label?: string }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <a
        href={googleMapsSearchUrl(point, label)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50"
      >
        <ExternalLink size={14} /> Open in Google Maps
      </a>
      <a
        href={googleMapsDirectionsUrl(point, label)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm bg-amber-600 text-white rounded-md px-3 py-1.5 hover:bg-amber-700"
      >
        <Navigation size={14} /> Directions
      </a>
    </div>
  );
}

export default PlaceMap;
