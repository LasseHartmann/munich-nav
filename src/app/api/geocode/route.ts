import { NextRequest, NextResponse } from 'next/server';
import { MUNICH_BBOX, MUNICH_CENTER, haversineMeters } from '@/lib/geo';
import type { PlaceResult } from '@/lib/types';

const USER_AGENT = 'MucNav/0.1 (Munich Multi-Stop Navigation Web App)';

interface TransitousGeocodeItem {
  type?: string;
  name?: string;
  id?: string;
  lat?: number;
  lon?: number;
  zip?: string;
  modes?: string[];
  importance?: number;
  areas?: { name?: string; adminLevel?: number; default?: boolean }[];
}

interface PhotonFeature {
  properties?: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    type?: string;
  };
  geometry?: {
    coordinates?: [number, number];
  };
}

function isInMunichArea(lat: number, lon: number): boolean {
  return (
    lat >= MUNICH_BBOX.minLat &&
    lat <= MUNICH_BBOX.maxLat &&
    lon >= MUNICH_BBOX.minLon &&
    lon <= MUNICH_BBOX.maxLon
  );
}

function formatPhotonPlace(feature: PhotonFeature, idx: number): PlaceResult | null {
  const coords = feature.geometry?.coordinates;
  const props = feature.properties;
  if (!coords || coords.length < 2 || !props) return null;
  const [lon, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const streetLine = [props.street, props.housenumber].filter(Boolean).join(' ').trim();
  const primaryName = props.name || streetLine || props.district || props.city || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  const subParts: string[] = [];
  if (props.name && streetLine && streetLine !== props.name) {
    subParts.push(streetLine);
  }
  const area = props.district || props.locality;
  if (area && area !== primaryName) subParts.push(area);
  if (props.city && props.city !== primaryName) {
    subParts.push(props.postcode ? `${props.postcode} ${props.city}` : props.city);
  } else if (props.county && props.county !== primaryName) {
    subParts.push(props.county);
  }

  const isTransit =
    props.osm_key === 'public_transport' ||
    props.osm_key === 'railway' ||
    props.osm_value === 'bus_stop' ||
    props.osm_value === 'tram_stop' ||
    props.osm_value === 'station';

  const isPoi =
    !isTransit &&
    Boolean(
      props.name &&
        props.osm_key &&
        ['amenity', 'tourism', 'leisure', 'shop', 'historic', 'building', 'office'].includes(props.osm_key)
    );

  return {
    id: `photon-${props.osm_type ?? 'x'}-${props.osm_id ?? idx}-${lat.toFixed(5)}-${lon.toFixed(5)}`,
    name: primaryName,
    subtitle: subParts.join(', ') || 'München',
    lat,
    lon,
    category: isTransit ? 'station' : isPoi ? 'poi' : 'address',
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  const latStr = searchParams.get('lat');
  const lonStr = searchParams.get('lon');
  const lang = searchParams.get('lang') === 'de' ? 'de' : 'en';

  // Reverse geocoding mode
  if (!q && latStr && lonStr) {
    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }
    try {
      const revUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=${lang}`;
      const res = await fetch(revUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = (await res.json()) as { features?: PhotonFeature[] };
        const first = data.features?.[0];
        if (first) {
          const parsed = formatPhotonPlace(first, 0);
          if (parsed) {
            return NextResponse.json(
              {
                place: {
                  ...parsed,
                  lat,
                  lon,
                  category: 'pin' as const,
                },
              },
              { headers: { 'Cache-Control': 'public, max-age=300' } }
            );
          }
        }
      }
    } catch {
      // Fallback below
    }

    return NextResponse.json({
      place: {
        id: `pin-${lat.toFixed(5)}-${lon.toFixed(5)}`,
        name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
        subtitle: 'München',
        lat,
        lon,
        category: 'pin',
      } satisfies PlaceResult,
    });
  }

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const bboxParam = `${MUNICH_BBOX.minLon},${MUNICH_BBOX.minLat},${MUNICH_BBOX.maxLon},${MUNICH_BBOX.maxLat}`;
  const photonUrl =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
    `&lat=${MUNICH_CENTER.lat}&lon=${MUNICH_CENTER.lon}` +
    `&bbox=${bboxParam}&limit=8&lang=${lang}`;

  const transitousUrl =
    `https://api.transitous.org/api/v1/geocode?text=${encodeURIComponent(q)}` +
    `&place=${MUNICH_CENTER.lat},${MUNICH_CENTER.lon}&type=STOP`;

  const [photonSettled, transitousSettled] = await Promise.allSettled([
    fetch(photonUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(6500),
    }).then((r) => (r.ok ? r.json() : { features: [] })),
    fetch(transitousUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(6500),
    }).then((r) => (r.ok ? r.json() : [])),
  ]);

  const stationResults: PlaceResult[] = [];
  if (transitousSettled.status === 'fulfilled' && Array.isArray(transitousSettled.value)) {
    const items = transitousSettled.value as TransitousGeocodeItem[];
    const seenStationNames = new Set<string>();
    for (const item of items) {
      if (
        !item.name ||
        !item.id ||
        typeof item.lat !== 'number' ||
        typeof item.lon !== 'number' ||
        !isInMunichArea(item.lat, item.lon)
      ) {
        continue;
      }
      const cleanModes = (item.modes || []).filter((m) => m !== 'RIDE_SHARING');
      if (cleanModes.length === 0) continue;

      const dedupeKey = `${item.name.toLowerCase()}-${item.lat.toFixed(3)}-${item.lon.toFixed(3)}`;
      if (seenStationNames.has(dedupeKey)) continue;
      seenStationNames.add(dedupeKey);

      const cityArea =
        item.areas?.find((a) => a.default)?.name ||
        item.areas?.find((a) => a.adminLevel === 6)?.name ||
        'München';
      const districtArea = item.areas?.find((a) => a.adminLevel === 9)?.name;
      const subtitle = [districtArea, cityArea].filter(Boolean).join(', ');

      stationResults.push({
        id: `station-${item.id}`,
        name: item.name,
        subtitle: subtitle || 'MVV Station',
        lat: item.lat,
        lon: item.lon,
        category: 'station',
        stopId: item.id,
        transitModes: cleanModes,
      });

      if (stationResults.length >= 4) break;
    }
  }

  const photonResults: PlaceResult[] = [];
  if (photonSettled.status === 'fulfilled') {
    const features = ((photonSettled.value as { features?: PhotonFeature[] })?.features || []);
    for (let i = 0; i < features.length; i++) {
      const parsed = formatPhotonPlace(features[i], i);
      if (!parsed || !isInMunichArea(parsed.lat, parsed.lon)) continue;
      // Skip duplicate if a matching MVV station with nearly same name & location is already present
      const dupStation = stationResults.some(
        (s) =>
          s.name.toLowerCase() === parsed.name.toLowerCase() &&
          haversineMeters(s.lat, s.lon, parsed.lat, parsed.lon) < 250
      );
      if (dupStation) continue;
      photonResults.push(parsed);
    }
  }

  // Combine: prioritize exact-ish MVV station matches first, interleaved cleanly with addresses/POIs
  const combined: PlaceResult[] = [];
  const qLower = q.toLowerCase();
  const strongStations = stationResults.filter(
    (s) => s.name.toLowerCase().startsWith(qLower) || s.name.toLowerCase().includes(qLower)
  );
  const otherStations = stationResults.filter((s) => !strongStations.includes(s));

  combined.push(...strongStations.slice(0, 3));
  combined.push(...photonResults.slice(0, 6));
  combined.push(...otherStations.slice(0, 2));

  return NextResponse.json(
    { results: combined.slice(0, 8) },
    { headers: { 'Cache-Control': 'public, max-age=120' } }
  );
}
