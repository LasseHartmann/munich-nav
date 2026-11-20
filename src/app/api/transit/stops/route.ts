import { NextRequest, NextResponse } from 'next/server';
import type { MapStation } from '@/lib/types';

const USER_AGENT = 'MucNav/0.1 (Munich Multi-Stop Navigation Web App)';

interface RawMapStop {
  name?: string;
  stopId?: string;
  parentId?: string;
  lat?: number;
  lon?: number;
  importance?: number;
  modes?: string[];
}

const REAL_TRANSIT_MODES = new Set([
  'SUBWAY',
  'METRO',
  'SUBURBAN',
  'TRAM',
  'BUS',
  'REGIONAL_RAIL',
  'REGIONAL_FAST_RAIL',
  'RAIL',
]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const minLat = Number(searchParams.get('minLat'));
  const minLon = Number(searchParams.get('minLon'));
  const maxLat = Number(searchParams.get('maxLat'));
  const maxLon = Number(searchParams.get('maxLon'));

  if (
    !Number.isFinite(minLat) ||
    !Number.isFinite(minLon) ||
    !Number.isFinite(maxLat) ||
    !Number.isFinite(maxLon)
  ) {
    return NextResponse.json({ error: 'Invalid bounding box' }, { status: 400 });
  }

  // Clamp very large boxes so we don't overload Transitous
  const latSpan = Math.abs(maxLat - minLat);
  const lonSpan = Math.abs(maxLon - minLon);
  if (latSpan > 0.45 || lonSpan > 0.65) {
    return NextResponse.json({ stations: [], zoomRequired: true });
  }

  try {
    const url = `https://api.transitous.org/api/v1/map/stops?min=${minLat.toFixed(5)},${minLon.toFixed(5)}&max=${maxLat.toFixed(5)},${maxLon.toFixed(5)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) {
      return NextResponse.json({ stations: [] }, { status: 200 });
    }

    const raw = (await res.json()) as RawMapStop[];
    if (!Array.isArray(raw)) {
      return NextResponse.json({ stations: [] });
    }

    // Deduplicate platforms into clean stations using parentId or normalized name + rough grid
    const grouped = new Map<string, MapStation>();

    for (const s of raw) {
      if (!s.name || !s.stopId || typeof s.lat !== 'number' || typeof s.lon !== 'number') {
        continue;
      }
      const validModes = (s.modes || []).filter((m) => REAL_TRANSIT_MODES.has(m.toUpperCase()));
      if (validModes.length === 0) continue;

      // Merge nearby platforms & parent/child entries of the same Munich station into one clean hub marker
      const normalizedName = s.name
        .toLowerCase()
        .replace(/^münchen,\s*/i, '')
        .replace(/\s*\(.*?\)\s*/g, '')
        .trim();
      const gridLat = Math.round(s.lat * 250); // ~440m grid cell
      const gridLon = Math.round(s.lon * 250);
      const key = `${normalizedName}_${gridLat}_${gridLon}`;
      const existing = grouped.get(key);
      const importance = s.importance ?? 0;

      if (!existing) {
        grouped.set(key, {
          stopId: s.parentId || s.stopId,
          parentId: s.parentId,
          name: s.name.replace(/^München,\s*/i, ''),
          lat: s.lat,
          lon: s.lon,
          modes: Array.from(new Set(validModes)),
          importance,
        });
      } else {
        existing.modes = Array.from(new Set([...existing.modes, ...validModes]));
        if (importance > existing.importance) {
          existing.importance = importance;
          existing.lat = s.lat;
          existing.lon = s.lon;
          existing.stopId = s.parentId || s.stopId;
        }
      }
    }

    const stations = Array.from(grouped.values())
      .sort((a, b) => {
        // Prioritize U-Bahn / S-Bahn hubs first, then importance
        const rank = (m: string[]) =>
          m.includes('SUBWAY') || m.includes('SUBURBAN')
            ? 3
            : m.includes('TRAM') || m.includes('REGIONAL_RAIL')
              ? 2
              : 1;
        const diff = rank(b.modes) - rank(a.modes);
        return diff !== 0 ? diff : b.importance - a.importance;
      })
      .slice(0, 120);

    return NextResponse.json(
      { stations },
      { headers: { 'Cache-Control': 'public, max-age=300' } }
    );
  } catch (err) {
    console.warn('[MucNav /api/transit/stops] Error:', err);
    return NextResponse.json({ stations: [] });
  }
}
