import { NextRequest, NextResponse } from 'next/server';
import { decodePolylineToGeoJSON } from '@/lib/geo';
import type { RoadManeuver, RoadRouteLeg, RoadRouteResult } from '@/lib/types';

const USER_AGENT = 'MucNav/0.1 (Munich Multi-Stop Navigation Web App)';

type RoadMode = 'foot' | 'bike' | 'car';

interface RouteRequestBody {
  mode: RoadMode;
  waypoints: { lat: number; lon: number }[];
  lang?: 'en' | 'de';
}

const ORS_PROFILES: Record<RoadMode, string> = {
  car: 'driving-car',
  bike: 'cycling-regular',
  foot: 'foot-walking',
};

const VALHALLA_COSTING: Record<RoadMode, string> = {
  car: 'auto',
  bike: 'bicycle',
  foot: 'pedestrian',
};

interface OrsGeoJson {
  features?: {
    geometry?: { coordinates?: [number, number][] };
    properties?: {
      summary?: { distance?: number; duration?: number };
      segments?: {
        distance?: number;
        duration?: number;
        steps?: {
          distance?: number;
          duration?: number;
          type?: number;
          instruction?: string;
          name?: string;
          way_points?: [number, number];
        }[];
      }[];
    };
  }[];
}

async function routeWithORS(
  mode: RoadMode,
  waypoints: { lat: number; lon: number }[],
  lang: 'en' | 'de',
  apiKey: string
): Promise<RoadRouteResult> {
  const profile = ORS_PROFILES[mode];
  const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      coordinates: waypoints.map((w) => [w.lon, w.lat]),
      language: lang,
      instructions: true,
      elevation: false,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ORS HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }

  const data = (await res.json()) as OrsGeoJson;
  const feature = data.features?.[0];
  const allCoords = feature?.geometry?.coordinates || [];
  const segments = feature?.properties?.segments || [];

  const legs: RoadRouteLeg[] = segments.map((seg, idx) => {
    const steps = seg.steps || [];
    const firstWp = steps[0]?.way_points?.[0] ?? 0;
    const lastWp = steps[steps.length - 1]?.way_points?.[1] ?? allCoords.length - 1;
    const legCoords = allCoords.slice(firstWp, lastWp + 1);

    const maneuvers: RoadManeuver[] = steps.map((s) => {
      const startIdx = s.way_points?.[0];
      const endIdx = s.way_points?.[1];
      return {
        instruction: s.instruction || '',
        distanceMeters: s.distance ?? 0,
        durationSeconds: s.duration ?? 0,
        type: s.type ?? 0,
        beginShapeIndex: startIdx !== undefined ? Math.max(0, startIdx - firstWp) : undefined,
        endShapeIndex: endIdx !== undefined ? Math.max(0, endIdx - firstWp) : undefined,
        location: startIdx !== undefined ? allCoords[startIdx] : undefined,
        streetNames: s.name && s.name !== '-' ? [s.name] : undefined,
      };
    });

    return {
      fromIndex: idx,
      toIndex: idx + 1,
      distanceMeters: seg.distance ?? 0,
      durationSeconds: seg.duration ?? 0,
      coordinates: legCoords,
      maneuvers,
    };
  });

  return {
    mode,
    provider: 'ors',
    calculatedAt: new Date().toISOString(),
    totalDistanceMeters:
      feature?.properties?.summary?.distance ?? legs.reduce((a, b) => a + b.distanceMeters, 0),
    totalDurationSeconds:
      feature?.properties?.summary?.duration ?? legs.reduce((a, b) => a + b.durationSeconds, 0),
    legs,
    coordinates: allCoords,
  };
}

interface ValhallaResponse {
  trip?: {
    summary?: { length?: number; time?: number };
    legs?: {
      shape?: string;
      summary?: { length?: number; time?: number };
      maneuvers?: {
        type?: number;
        instruction?: string;
        length?: number;
        time?: number;
        begin_shape_index?: number;
        end_shape_index?: number;
        street_names?: string[];
      }[];
    }[];
  };
}

async function routeWithValhalla(
  mode: RoadMode,
  waypoints: { lat: number; lon: number }[],
  lang: 'en' | 'de'
): Promise<RoadRouteResult> {
  const res = await fetch('https://valhalla1.openstreetmap.de/route', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      locations: waypoints.map((w) => ({ lat: w.lat, lon: w.lon, type: 'break' })),
      costing: VALHALLA_COSTING[mode],
      directions_options: {
        units: 'kilometers',
        language: lang === 'de' ? 'de-DE' : 'en-US',
      },
    }),
    signal: AbortSignal.timeout(14000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Valhalla HTTP ${res.status}: ${errText.slice(0, 180)}`);
  }

  const data = (await res.json()) as ValhallaResponse;
  const trip = data.trip;
  if (!trip?.legs?.length) {
    throw new Error('Valhalla returned no route legs');
  }

  const combinedCoords: [number, number][] = [];
  const legs: RoadRouteLeg[] = trip.legs.map((leg, idx) => {
    const coords = decodePolylineToGeoJSON(leg.shape || '', 6);
    if (combinedCoords.length > 0 && coords.length > 0) {
      combinedCoords.push(...coords.slice(1));
    } else {
      combinedCoords.push(...coords);
    }

    const maneuvers: RoadManeuver[] = (leg.maneuvers || []).map((m) => {
      const startIdx = m.begin_shape_index ?? 0;
      return {
        instruction: m.instruction || '',
        distanceMeters: Math.round((m.length ?? 0) * 1000),
        durationSeconds: Math.round(m.time ?? 0),
        type: m.type ?? 0,
        beginShapeIndex: m.begin_shape_index,
        endShapeIndex: m.end_shape_index,
        location: coords[startIdx],
        streetNames: m.street_names,
      };
    });

    return {
      fromIndex: idx,
      toIndex: idx + 1,
      distanceMeters: Math.round((leg.summary?.length ?? 0) * 1000),
      durationSeconds: Math.round(leg.summary?.time ?? 0),
      coordinates: coords,
      maneuvers,
    };
  });

  return {
    mode,
    provider: 'valhalla',
    calculatedAt: new Date().toISOString(),
    totalDistanceMeters: Math.round((trip.summary?.length ?? 0) * 1000),
    totalDurationSeconds: Math.round(trip.summary?.time ?? 0),
    legs,
    coordinates: combinedCoords,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RouteRequestBody;
    const { mode, waypoints, lang = 'en' } = body;

    if (!mode || !['foot', 'bike', 'car'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid travel mode' }, { status: 400 });
    }
    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      return NextResponse.json({ error: 'At least 2 waypoints are required' }, { status: 400 });
    }
    if (waypoints.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 waypoints supported' }, { status: 400 });
    }

    const orsKey = process.env.ORS_API_KEY?.trim();

    if (orsKey) {
      try {
        const orsResult = await routeWithORS(mode, waypoints, lang, orsKey);
        return NextResponse.json(orsResult, {
          headers: { 'Cache-Control': 'private, max-age=60' },
        });
      } catch (orsErr) {
        console.warn('[MucNav /api/route] ORS failed, falling back to Valhalla:', orsErr);
      }
    }

    const valhallaResult = await routeWithValhalla(mode, waypoints, lang);
    return NextResponse.json(valhallaResult, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to calculate route';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
