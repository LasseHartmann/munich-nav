import { decodePolylineToGeoJSON } from '@/lib/geo';
import type { WalkMetrics, WalkOptions } from '@/lib/types';

const USER_AGENT = 'MucNav/0.1 (Munich Multi-Stop Navigation Web App)';

export interface OrsExtraSummaryItem {
  value?: number;
  distance?: number;
  amount?: number;
}

export interface OrsWalkExtras {
  green?: { summary?: OrsExtraSummaryItem[] };
  noise?: { summary?: OrsExtraSummaryItem[] };
}

/**
 * Computes intuitive 0-100% green & quiet scores from ORS extra_info summaries.
 * Empirically verified in Munich: ORS uses an inverted 0..10 cost index where
 * values <= 7 represent green park/tree paths and quiet low-traffic streets,
 * while 8..10 represent unshaded concrete / busy arterial roads.
 */
export function parseOrsWalkMetrics(extras?: OrsWalkExtras): WalkMetrics | undefined {
  const greenSummary = extras?.green?.summary;
  const noiseSummary = extras?.noise?.summary;
  if (!greenSummary?.length && !noiseSummary?.length) return undefined;

  const greenAmount = (greenSummary || [])
    .filter((item) => typeof item.value === 'number' && item.value <= 7)
    .reduce((acc, item) => acc + (item.amount ?? 0), 0);

  const quietAmount = (noiseSummary || [])
    .filter((item) => typeof item.value === 'number' && item.value <= 7)
    .reduce((acc, item) => acc + (item.amount ?? 0), 0);

  return {
    greenPercent: Math.min(100, Math.max(0, Math.round(greenAmount))),
    quietPercent: Math.min(100, Math.max(0, Math.round(quietAmount))),
  };
}

export function buildOrsFootOptions(walkOptions?: WalkOptions): Record<string, unknown> {
  if (!walkOptions) return {};
  const options: Record<string, unknown> = {};
  const strong = walkOptions.intensity === 'strong';
  const weightings: Record<string, number> = {};

  if (walkOptions.preferGreen) {
    weightings.green = strong ? 0.95 : 0.65;
  }
  if (walkOptions.preferQuiet) {
    weightings.quiet = strong ? 0.85 : 0.45;
  }
  if (Object.keys(weightings).length > 0) {
    options.profile_params = { weightings };
  }
  if (walkOptions.avoidSteps) {
    options.avoid_features = ['steps'];
  }
  return options;
}

export function buildValhallaPedestrianOptions(walkOptions?: WalkOptions): Record<string, number> {
  if (!walkOptions) return {};
  const ped: Record<string, number> = {};
  const strong = walkOptions.intensity === 'strong';
  if (walkOptions.preferGreen || walkOptions.preferQuiet) {
    ped.walkway_factor = strong ? 0.4 : 0.65;
    ped.use_roads = strong ? 0.05 : 0.18;
    ped.sidewalk_factor = strong ? 1.5 : 1.25;
  }
  if (walkOptions.avoidSteps) {
    ped.step_penalty = 180;
  }
  return ped;
}

export function buildValhallaBicycleOptions(
  walkOptions?: WalkOptions
): Record<string, number | string> {
  if (!walkOptions) return {};
  const bike: Record<string, number | string> = {};
  const strong = walkOptions.intensity === 'strong';

  if (walkOptions.preferQuiet) {
    bike.use_roads = strong ? 0.0 : 0.12;
    bike.use_living_streets = strong ? 1.0 : 0.85;
    bike.bicycle_type = 'Hybrid';
  }
  if (walkOptions.preferGreen) {
    bike.use_roads = Math.min(
      typeof bike.use_roads === 'number' ? bike.use_roads : 1,
      strong ? 0.0 : 0.15
    );
    bike.use_tracks = strong ? 1.0 : 0.7;
    bike.avoid_bad_surfaces = strong ? 0.05 : 0.2;
    bike.bicycle_type = strong ? 'Mountain' : 'Hybrid';
  }
  if (walkOptions.avoidSteps && Object.keys(bike).length === 0) {
    bike.use_hills = 0.35;
  }
  return bike;
}

export interface FootSegmentRoute {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  walkMetrics?: WalkMetrics;
}

/**
 * Routes a single walking segment (used to upgrade Transit walking segments with
 * green / quiet / step-free preferences). Uses ORS foot-walking with Valhalla fallback.
 */
export async function routeFootSegment(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  walkOptions: WalkOptions
): Promise<FootSegmentRoute | null> {
  const orsKey = process.env.ORS_API_KEY?.trim();

  if (orsKey) {
    try {
      const payload: Record<string, unknown> = {
        coordinates: [
          [from.lon, from.lat],
          [to.lon, to.lat],
        ],
        instructions: false,
        elevation: false,
        extra_info: ['green', 'noise'],
      };
      const options = buildOrsFootOptions(walkOptions);
      if (Object.keys(options).length > 0) {
        payload.options = options;
      }

      const res = await fetch(
        'https://api.openrouteservice.org/v2/directions/foot-walking/geojson',
        {
          method: 'POST',
          headers: {
            Authorization: orsKey,
            'Content-Type': 'application/json',
            'User-Agent': USER_AGENT,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(7000),
        }
      );

      if (res.ok) {
        const data = (await res.json()) as {
          features?: {
            geometry?: { coordinates?: [number, number][] };
            properties?: {
              summary?: { distance?: number; duration?: number };
              extras?: OrsWalkExtras;
            };
          }[];
        };
        const feat = data.features?.[0];
        const coords = feat?.geometry?.coordinates || [];
        const dist = feat?.properties?.summary?.distance;
        const dur = feat?.properties?.summary?.duration;
        if (coords.length >= 2 && typeof dist === 'number' && typeof dur === 'number') {
          return {
            coordinates: coords,
            distanceMeters: Math.round(dist),
            durationSeconds: Math.round(dur),
            walkMetrics: parseOrsWalkMetrics(feat?.properties?.extras),
          };
        }
      }
    } catch {
      // Fall through to Valhalla pedestrian fallback
    }
  }

  try {
    const ped = buildValhallaPedestrianOptions(walkOptions);
    const body: Record<string, unknown> = {
      locations: [
        { lat: from.lat, lon: from.lon, type: 'break' },
        { lat: to.lat, lon: to.lon, type: 'break' },
      ],
      costing: 'pedestrian',
      ...(Object.keys(ped).length > 0 ? { costing_options: { pedestrian: ped } } : {}),
    };

    const res = await fetch('https://valhalla1.openstreetmap.de/route', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      trip?: {
        summary?: { length?: number; time?: number };
        legs?: { shape?: string }[];
      };
    };
    const shape = data.trip?.legs?.[0]?.shape;
    if (!shape) return null;
    const coords = decodePolylineToGeoJSON(shape, 6);
    if (coords.length < 2) return null;

    return {
      coordinates: coords,
      distanceMeters: Math.round((data.trip?.summary?.length ?? 0) * 1000),
      durationSeconds: Math.round(data.trip?.summary?.time ?? 0),
    };
  } catch {
    return null;
  }
}
