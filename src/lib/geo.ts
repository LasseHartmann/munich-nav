import polyline from '@mapbox/polyline';
import type { Language } from './types';

export const MUNICH_CENTER = {
  lat: 48.137154,
  lon: 11.576124,
  zoom: 12.6,
};

/** Greater Munich & MVV network bounding box (includes Airport, Starnberg, Dachau, Freising, Erding, Wolfratshausen) */
export const MUNICH_BBOX = {
  minLon: 10.95,
  minLat: 47.72,
  maxLon: 12.25,
  maxLat: 48.55,
};

export const MUNICH_QUICK_PLACES = [
  {
    id: 'quick-marienplatz',
    name: 'Marienplatz',
    subtitle: 'Altstadt, München',
    lat: 48.137154,
    lon: 11.576124,
    category: 'station' as const,
    stopId: 'de-DELFI_de:09162:2',
    transitModes: ['SUBWAY', 'SUBURBAN', 'BUS'],
  },
  {
    id: 'quick-hbf',
    name: 'München Hauptbahnhof',
    subtitle: 'Ludwigsvorstadt, München',
    lat: 48.140232,
    lon: 11.558335,
    category: 'station' as const,
    stopId: 'de-DELFI_de:09162:6',
    transitModes: ['SUBWAY', 'SUBURBAN', 'TRAM', 'BUS', 'REGIONAL_RAIL'],
  },
  {
    id: 'quick-olympiapark',
    name: 'Olympiapark',
    subtitle: 'Milbertshofen, München',
    lat: 48.175465,
    lon: 11.551789,
    category: 'poi' as const,
  },
  {
    id: 'quick-englischer-garten',
    name: 'Chinesischer Turm (Englischer Garten)',
    subtitle: 'Schwabing, München',
    lat: 48.152468,
    lon: 11.592088,
    category: 'poi' as const,
  },
  {
    id: 'quick-flughafen',
    name: 'Flughafen München (MUC)',
    subtitle: 'Terminalstraße, Oberding',
    lat: 48.353662,
    lon: 11.786086,
    category: 'station' as const,
    transitModes: ['SUBURBAN', 'BUS'],
  },
  {
    id: 'quick-gaertnerplatz',
    name: 'Gärtnerplatz',
    subtitle: 'Isarvorstadt, München',
    lat: 48.131637,
    lon: 11.576101,
    category: 'poi' as const,
  },
];

/** Decode encoded polyline into GeoJSON [lon, lat][] coordinates. */
export function decodePolylineToGeoJSON(encoded: string, precision = 6): [number, number][] {
  if (!encoded) return [];
  try {
    const latLngs = polyline.decode(encoded, precision);
    return latLngs.map(([lat, lon]) => [lon, lat]);
  } catch {
    return [];
  }
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters: number, lang: Language = 'en'): string {
  if (!Number.isFinite(meters) || meters < 0) return '0 m';
  if (meters < 1000) {
    return `${Math.round(meters / 10) * 10 || Math.round(meters)} m`;
  }
  const km = meters / 1000;
  const formatted = km >= 10 ? km.toFixed(1) : km.toFixed(2).replace(/\.00$/, '');
  return lang === 'de' ? `${formatted.replace('.', ',')} km` : `${formatted} km`;
}

export function formatDuration(seconds: number, lang: Language = 'en'): string {
  if (!Number.isFinite(seconds) || seconds < 0) return lang === 'de' ? '0 Min.' : '0 min';
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) {
    return lang === 'de' ? `${mins} Min.` : `${mins} min`;
  }
  if (mins === 0) {
    return lang === 'de' ? `${hours} Std.` : `${hours} hr`;
  }
  return lang === 'de' ? `${hours} Std. ${mins} Min.` : `${hours} hr ${mins} min`;
}

export function formatMunichTime(isoString?: string, lang: Language = 'en'): string {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '--:--';
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Berlin',
  }).format(d);
}

export function diffMinutes(actualIso?: string, scheduledIso?: string): number {
  if (!actualIso || !scheduledIso) return 0;
  const a = new Date(actualIso).getTime();
  const s = new Date(scheduledIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(s)) return 0;
  return Math.round((a - s) / 60000);
}

export function getBoundsFromCoordinates(
  coords: [number, number][]
): [[number, number], [number, number]] | null {
  if (!coords.length) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  if (!Number.isFinite(minLon)) return null;
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

export function findNearestCoordinateIndex(
  lat: number,
  lon: number,
  coords: [number, number][]
): { index: number; distanceMeters: number } {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const [cLon, cLat] = coords[i];
    const d = haversineMeters(lat, lon, cLat, cLon);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return { index: bestIdx, distanceMeters: bestDist };
}

export function computeRemainingDistanceMeters(
  fromIndex: number,
  coords: [number, number][]
): number {
  let dist = 0;
  for (let i = Math.max(0, fromIndex); i < coords.length - 1; i++) {
    dist += haversineMeters(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]);
  }
  return dist;
}

export function toLocalDateTimeInputValue(date: Date = new Date()): string {
  // Format in Europe/Berlin local time as YYYY-MM-DDTHH:mm
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
