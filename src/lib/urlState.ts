import type { MapStyleMode, TransitFilterKey, TravelMode, Waypoint } from './types';

export interface ShareableRouteState {
  mode: TravelMode;
  mapStyle: MapStyleMode;
  waypoints: Waypoint[];
  departMode: 'now' | 'departAt';
  departAtLocal: string;
  transitFilters: TransitFilterKey[];
}

const VALID_MODES = new Set<TravelMode>(['transit', 'foot', 'bike', 'car']);
const VALID_FILTERS = new Set<TransitFilterKey>(['SUBWAY', 'SUBURBAN', 'TRAM', 'BUS', 'REGIONAL']);

export function encodeRouteToQuery(state: ShareableRouteState): string {
  const params = new URLSearchParams();
  params.set('m', state.mode);
  if (state.mapStyle === 'hybrid') {
    params.set('ms', 'hybrid');
  }

  const filled = state.waypoints.filter((w) => w.place !== null);
  if (filled.length > 0) {
    // Format each waypoint as lat~lon~dwell~encodedName~stopId
    const encodedStops = filled.map((w) => {
      const p = w.place!;
      const parts = [
        p.lat.toFixed(6),
        p.lon.toFixed(6),
        String(Math.max(0, Math.round(w.dwellMinutes || 0))),
        encodeURIComponent(p.name.slice(0, 80)),
        p.stopId ? encodeURIComponent(p.stopId) : '',
      ];
      return parts.join('~');
    });
    params.set('s', encodedStops.join('|'));
  }

  if (state.departMode === 'departAt' && state.departAtLocal) {
    params.set('t', state.departAtLocal);
  }

  if (state.transitFilters.length > 0 && state.transitFilters.length < 5) {
    params.set('tf', state.transitFilters.join(','));
  }

  return params.toString();
}

export function decodeRouteFromQuery(search: string): Partial<ShareableRouteState> | null {
  const params = new URLSearchParams(search);
  const rawMode = params.get('m') as TravelMode | null;
  const rawStyle = params.get('ms');
  const rawStops = params.get('s');
  const rawTime = params.get('t');
  const rawFilters = params.get('tf');

  if (!rawMode && !rawStops && !rawStyle) return null;

  const result: Partial<ShareableRouteState> = {};

  if (rawMode && VALID_MODES.has(rawMode)) {
    result.mode = rawMode;
  }
  if (rawStyle === 'hybrid' || rawStyle === 'standard') {
    result.mapStyle = rawStyle;
  }
  if (rawTime) {
    result.departMode = 'departAt';
    result.departAtLocal = rawTime;
  }
  if (rawFilters) {
    const parsed = rawFilters
      .split(',')
      .filter((f): f is TransitFilterKey => VALID_FILTERS.has(f as TransitFilterKey));
    if (parsed.length > 0) result.transitFilters = parsed;
  }

  if (rawStops) {
    const stops = rawStops
      .split('|')
      .map((entry, idx): Waypoint | null => {
        const [latStr, lonStr, dwellStr, nameEnc, stopIdEnc] = entry.split('~');
        const lat = Number(latStr);
        const lon = Number(lonStr);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const dwellMinutes = Math.max(0, Math.min(720, Number(dwellStr) || 0));
        const name = nameEnc ? decodeURIComponent(nameEnc) : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        const stopId = stopIdEnc ? decodeURIComponent(stopIdEnc) : undefined;
        return {
          uid: `url-wp-${idx}-${Math.random().toString(36).slice(2, 7)}`,
          dwellMinutes,
          place: {
            id: `url-place-${idx}-${lat.toFixed(5)}-${lon.toFixed(5)}`,
            name,
            subtitle: 'München',
            lat,
            lon,
            category: stopId ? 'station' : 'pin',
            stopId,
          },
        };
      })
      .filter((w): w is Waypoint => w !== null);

    if (stops.length >= 2) {
      result.waypoints = stops;
    } else if (stops.length === 1) {
      result.waypoints = [
        stops[0],
        { uid: `wp-empty-${Math.random().toString(36).slice(2, 7)}`, place: null, dwellMinutes: 0 },
      ];
    }
  }

  return result;
}
