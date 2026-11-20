import { NextRequest, NextResponse } from 'next/server';

const USER_AGENT = 'MucNav/0.1 (Munich Multi-Stop Navigation Web App)';
type RoadMode = 'foot' | 'bike' | 'car';

interface OptimizeBody {
  mode: RoadMode;
  waypoints: { lat: number; lon: number }[];
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

async function optimizeWithORS(
  mode: RoadMode,
  waypoints: { lat: number; lon: number }[],
  apiKey: string
): Promise<number[]> {
  const start = waypoints[0];
  const end = waypoints[waypoints.length - 1];
  const jobs = waypoints.slice(1, -1).map((wp, idx) => ({
    id: idx + 1, // maps directly to original index in waypoints
    location: [wp.lon, wp.lat],
  }));

  const res = await fetch('https://api.openrouteservice.org/optimization', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      jobs,
      vehicles: [
        {
          id: 1,
          profile: ORS_PROFILES[mode],
          start: [start.lon, start.lat],
          end: [end.lon, end.lat],
        },
      ],
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`ORS Optimization HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    routes?: { steps?: { type?: string; job?: number }[] }[];
  };
  const steps = data.routes?.[0]?.steps || [];
  const middleIndices = steps
    .filter((s) => s.type === 'job' && typeof s.job === 'number')
    .map((s) => s.job as number);

  if (middleIndices.length !== jobs.length) {
    throw new Error('ORS optimization returned incomplete job list');
  }

  return [0, ...middleIndices, waypoints.length - 1];
}

async function optimizeWithValhalla(
  mode: RoadMode,
  waypoints: { lat: number; lon: number }[]
): Promise<number[]> {
  const res = await fetch('https://valhalla1.openstreetmap.de/optimized_route', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      locations: waypoints.map((w) => ({ lat: w.lat, lon: w.lon })),
      costing: VALHALLA_COSTING[mode],
    }),
    signal: AbortSignal.timeout(14000),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Valhalla optimized_route HTTP ${res.status}: ${t.slice(0, 140)}`);
  }

  const data = (await res.json()) as {
    trip?: { locations?: { original_index?: number }[] };
  };
  const ordered = (data.trip?.locations || [])
    .map((loc) => loc.original_index)
    .filter((idx): idx is number => typeof idx === 'number');

  if (ordered.length !== waypoints.length) {
    throw new Error('Valhalla returned incomplete optimized order');
  }
  return ordered;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as OptimizeBody;
    const { mode, waypoints } = body;

    if (!mode || !['foot', 'bike', 'car'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode for optimization' }, { status: 400 });
    }
    if (!Array.isArray(waypoints) || waypoints.length < 4) {
      return NextResponse.json(
        { error: 'At least 4 waypoints (2 intermediate stops) are required to optimize' },
        { status: 400 }
      );
    }

    const orsKey = process.env.ORS_API_KEY?.trim();
    if (orsKey) {
      try {
        const orderedIndices = await optimizeWithORS(mode, waypoints, orsKey);
        return NextResponse.json({ orderedIndices, provider: 'ors' });
      } catch (err) {
        console.warn('[MucNav /api/optimize] ORS failed, falling back to Valhalla:', err);
      }
    }

    const orderedIndices = await optimizeWithValhalla(mode, waypoints);
    return NextResponse.json({ orderedIndices, provider: 'valhalla' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Optimization failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
