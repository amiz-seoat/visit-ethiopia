import { useEffect, useState } from 'react';
import { getDestinations } from '../../api/destinations';
import { extractLatLng } from '../../utils/geo';
import { PlaceMap, type MapPoint } from './PlaceMap';
import type { Tour } from '../../types';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Plots a tour's destinations. Uses explicit coordinates on the tour when present,
 * otherwise matches destination names against the destinations catalogue.
 */
export function TourRouteMap({ tour }: { tour: Tour }) {
  const [points, setPoints] = useState<MapPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    const t = tour as Tour & {
      destinations?: unknown[];
      destinationLocations?: unknown[];
      startingLocation?: unknown;
    };

    const explicit: MapPoint[] = [];
    const start = extractLatLng(t.startingLocation);
    if (start) explicit.push({ id: 'start', title: 'Starting point', ...start });
    (t.destinationLocations || []).forEach((loc, i) => {
      const p = extractLatLng(loc);
      const name = (loc as { name?: string; description?: string })?.name
        || (loc as { description?: string })?.description;
      if (p) explicit.push({ id: `stop-${i}`, title: name || `Stop ${i + 1}`, ...p });
    });
    if (explicit.length) {
      setPoints(explicit);
      return;
    }

    const names = (t.destinations || []).filter((d): d is string => typeof d === 'string');
    if (!names.length) return;
    getDestinations({ limit: 100 })
      .then(({ destinations }) => {
        if (cancelled) return;
        const found: MapPoint[] = [];
        for (const name of names) {
          const n = norm(name);
          const match = destinations.find((d) => {
            const dn = norm(d.name || '');
            return dn && (dn === n || dn.includes(n) || n.includes(dn));
          });
          const p = match ? extractLatLng((match as { location?: unknown }).location) : null;
          if (match && p && !found.some((f) => f.id === match._id)) {
            found.push({ id: match._id, title: match.name, href: `/destinations/${match._id}`, ...p });
          }
        }
        setPoints(found);
      })
      .catch(() => setPoints([]));
    return () => {
      cancelled = true;
    };
  }, [tour]);

  if (!points.length) return null;
  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4">Where you&apos;ll go</h2>
      <PlaceMap points={points} height={340} showGoogleLinks={points.length === 1} />
    </div>
  );
}

export default TourRouteMap;
