import { NextRequest, NextResponse } from 'next/server';
import { decodePolylineToGeoJSON, diffMinutes } from '@/lib/geo';
import type {
  TransitFilterKey,
  TransitItinerary,
  TransitMultiStopLeg,
  TransitPlanResult,
  TransitSegment,
} from '@/lib/types';

const USER_AGENT = 'MucNav/0.1 (Munich Multi-Stop Navigation Web App)';

interface PlanStopInput {
  name: string;
  lat: number;
  lon: number;
  stopId?: string;
  dwellMinutes: number;
}

interface TransitPlanRequestBody {
  stops: PlanStopInput[];
  departureTime?: string; // ISO string
  transitFilters?: TransitFilterKey[];
  /** Optional map of legIndex -> selected alternative index */
  selectedAlternatives?: Record<number, number>;
}

interface MotisPlace {
  name?: string;
  stopId?: string;
  lat?: number;
  lon?: number;
  departure?: string;
  scheduledDeparture?: string;
  arrival?: string;
  scheduledArrival?: string;
  track?: string;
  scheduledTrack?: string;
  cancelled?: boolean;
}

interface MotisLeg {
  mode?: string;
  from?: MotisPlace;
  to?: MotisPlace;
  startTime?: string;
  scheduledStartTime?: string;
  endTime?: string;
  scheduledEndTime?: string;
  duration?: number;
  distance?: number;
  routeShortName?: string;
  routeLongName?: string;
  routeColor?: string;
  routeTextColor?: string;
  headsign?: string;
  realTime?: boolean;
  cancelled?: boolean;
  intermediateStops?: MotisPlace[];
  legGeometry?: { points?: string; precision?: number };
}

interface MotisItinerary {
  duration?: number;
  startTime?: string;
  endTime?: string;
  transfers?: number;
  legs?: MotisLeg[];
}

interface MotisPlanResponse {
  itineraries?: MotisItinerary[];
  direct?: MotisItinerary[];
}

function mapFiltersToMotisModes(filters?: TransitFilterKey[]): string {
  if (!filters || filters.length === 0) {
    return 'SUBWAY,SUBURBAN,TRAM,BUS,REGIONAL_RAIL,REGIONAL_FAST_RAIL,RAIL';
  }
  const modes: string[] = [];
  for (const f of filters) {
    if (f === 'SUBWAY') modes.push('SUBWAY', 'METRO');
    else if (f === 'SUBURBAN') modes.push('SUBURBAN');
    else if (f === 'TRAM') modes.push('TRAM');
    else if (f === 'BUS') modes.push('BUS');
    else if (f === 'REGIONAL') modes.push('REGIONAL_RAIL', 'REGIONAL_FAST_RAIL', 'RAIL');
  }
  return Array.from(new Set(modes)).join(',');
}

function normalizeItinerary(raw: MotisItinerary, legIndex: number, altIndex: number): TransitItinerary {
  let walkDistanceMeters = 0;
  const segments: TransitSegment[] = (raw.legs || []).map((leg, segIdx) => {
    const mode = (leg.mode || 'WALK').toUpperCase();
    const startTime = leg.startTime || leg.from?.departure || raw.startTime || '';
    const scheduledStartTime = leg.scheduledStartTime || leg.from?.scheduledDeparture || startTime;
    const endTime = leg.endTime || leg.to?.arrival || raw.endTime || '';
    const scheduledEndTime = leg.scheduledEndTime || leg.to?.scheduledArrival || endTime;

    if (mode === 'WALK' && typeof leg.distance === 'number') {
      walkDistanceMeters += leg.distance;
    }

    const precision = leg.legGeometry?.precision ?? 6;
    let coords = leg.legGeometry?.points
      ? decodePolylineToGeoJSON(leg.legGeometry.points, precision)
      : [];

    if (
      coords.length === 0 &&
      typeof leg.from?.lat === 'number' &&
      typeof leg.from?.lon === 'number' &&
      typeof leg.to?.lat === 'number' &&
      typeof leg.to?.lon === 'number'
    ) {
      coords = [
        [leg.from.lon, leg.from.lat],
        [leg.to.lon, leg.to.lat],
      ];
    }

    return {
      id: `leg-${legIndex}-alt-${altIndex}-seg-${segIdx}`,
      mode,
      fromName: leg.from?.name === 'START' ? '' : leg.from?.name || '',
      fromStopId: leg.from?.stopId,
      fromLat: leg.from?.lat ?? 0,
      fromLon: leg.from?.lon ?? 0,
      fromTrack: leg.from?.track || leg.from?.scheduledTrack,
      toName: leg.to?.name === 'END' ? '' : leg.to?.name || '',
      toStopId: leg.to?.stopId,
      toLat: leg.to?.lat ?? 0,
      toLon: leg.to?.lon ?? 0,
      toTrack: leg.to?.track || leg.to?.scheduledTrack,
      startTime,
      scheduledStartTime,
      endTime,
      scheduledEndTime,
      startDelayMinutes: diffMinutes(startTime, scheduledStartTime),
      endDelayMinutes: diffMinutes(endTime, scheduledEndTime),
      durationSeconds: leg.duration ?? 0,
      distanceMeters: leg.distance,
      routeShortName: leg.routeShortName || undefined,
      routeLongName: leg.routeLongName || undefined,
      routeColor: leg.routeColor || undefined,
      routeTextColor: leg.routeTextColor || undefined,
      headsign: leg.headsign || undefined,
      realTime: Boolean(leg.realTime),
      cancelled: Boolean(leg.cancelled || leg.from?.cancelled || leg.to?.cancelled),
      intermediateStops: (leg.intermediateStops || []).map((s) => ({
        name: s.name || '',
        stopId: s.stopId,
        lat: s.lat ?? 0,
        lon: s.lon ?? 0,
        arrival: s.arrival || s.scheduledArrival,
        departure: s.departure || s.scheduledDeparture,
        track: s.track || s.scheduledTrack,
      })),
      coordinates: coords,
    };
  });

  return {
    id: `leg-${legIndex}-alt-${altIndex}`,
    startTime: raw.startTime || segments[0]?.startTime || '',
    endTime: raw.endTime || segments[segments.length - 1]?.endTime || '',
    durationSeconds: raw.duration ?? 0,
    transfers: raw.transfers ?? Math.max(0, segments.filter((s) => s.mode !== 'WALK').length - 1),
    walkDistanceMeters: Math.round(walkDistanceMeters),
    segments,
  };
}

async function fetchSingleTransitLeg(
  from: PlanStopInput,
  to: PlanStopInput,
  departureIso: string,
  transitModesParam: string,
  legIndex: number
): Promise<TransitItinerary[]> {
  const params = new URLSearchParams({
    fromPlace: `${from.lat.toFixed(6)},${from.lon.toFixed(6)}`,
    toPlace: `${to.lat.toFixed(6)},${to.lon.toFixed(6)}`,
    time: departureIso,
    arriveBy: 'false',
    numItineraries: '4',
    transitModes: transitModesParam,
    pedestrianProfile: 'FOOT',
    maxMatchingDistance: '250',
  });

  const url = `https://api.transitous.org/api/v5/plan?${params.toString()}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(14000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Transitous HTTP ${res.status}: ${errText.slice(0, 160)}`);
  }

  const data = (await res.json()) as MotisPlanResponse;
  const rawItineraries = data.itineraries || [];
  const rawDirect = data.direct || [];

  const normalized: TransitItinerary[] = rawItineraries
    .filter((it) => Array.isArray(it.legs) && it.legs.length > 0)
    .map((it, idx) => normalizeItinerary(it, legIndex, idx));

  // If stops are very close and transit returned no itineraries (or a quick walk beats transit), include direct walk
  if (normalized.length === 0 && rawDirect.length > 0) {
    const directWalk = normalizeItinerary(rawDirect[0], legIndex, 0);
    normalized.push(directWalk);
  } else if (rawDirect.length > 0) {
    const walkCandidate = rawDirect[0];
    // Include direct walk option if it's <= 20 min and faster than the fastest transit option
    if (
      typeof walkCandidate.duration === 'number' &&
      walkCandidate.duration <= 1200 &&
      normalized[0] &&
      walkCandidate.duration < normalized[0].durationSeconds
    ) {
      normalized.unshift(normalizeItinerary(walkCandidate, legIndex, normalized.length));
    }
  }

  // Sort by arrival time so option 0 is the earliest arrival
  normalized.sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime());

  // Re-label start/end fallback names for walking segments using user's actual stop names
  return normalized.slice(0, 4).map((itin, idx) => ({
    ...itin,
    id: `leg-${legIndex}-alt-${idx}`,
    segments: itin.segments.map((seg, sIdx) => ({
      ...seg,
      fromName: sIdx === 0 && !seg.fromName ? from.name : seg.fromName || from.name,
      toName:
        sIdx === itin.segments.length - 1 && !seg.toName ? to.name : seg.toName || to.name,
    })),
  }));
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TransitPlanRequestBody;
    const { stops, departureTime, transitFilters, selectedAlternatives = {} } = body;

    if (!Array.isArray(stops) || stops.length < 2) {
      return NextResponse.json({ error: 'At least 2 stops are required' }, { status: 400 });
    }
    if (stops.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 stops supported for chained public transport trips' },
        { status: 400 }
      );
    }

    const baseDepartureDate = departureTime ? new Date(departureTime) : new Date();
    const initialIso = Number.isNaN(baseDepartureDate.getTime())
      ? new Date().toISOString()
      : baseDepartureDate.toISOString();

    const transitModesParam = mapFiltersToMotisModes(transitFilters);
    const legs: TransitMultiStopLeg[] = [];
    let currentDepartureIso = initialIso;

    let totalTravelSeconds = 0;
    let totalDwellSeconds = 0;

    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i];
      const to = stops[i + 1];
      const isIntermediateDest = i < stops.length - 2;
      const dwellAfterMinutes = isIntermediateDest ? Math.max(0, Math.round(to.dwellMinutes || 0)) : 0;

      try {
        const alternatives = await fetchSingleTransitLeg(
          from,
          to,
          currentDepartureIso,
          transitModesParam,
          i
        );

        const requestedAlt = selectedAlternatives[i] ?? 0;
        const selectedIndex =
          alternatives.length > 0 ? Math.min(Math.max(0, requestedAlt), alternatives.length - 1) : 0;
        const chosen = alternatives[selectedIndex];

        legs.push({
          legIndex: i,
          fromLabel: from.name,
          toLabel: to.name,
          fromCoord: [from.lon, from.lat],
          toCoord: [to.lon, to.lat],
          requestedDepartureTime: currentDepartureIso,
          dwellAfterMinutes,
          alternatives,
          selectedIndex,
          error: alternatives.length === 0 ? 'No transit connection found for this leg' : undefined,
        });

        if (chosen) {
          totalTravelSeconds += chosen.durationSeconds;
          if (isIntermediateDest) {
            totalDwellSeconds += dwellAfterMinutes * 60;
          }
          const arrivalMs = new Date(chosen.endTime).getTime();
          if (!Number.isNaN(arrivalMs)) {
            currentDepartureIso = new Date(arrivalMs + dwellAfterMinutes * 60_000).toISOString();
          }
        } else {
          // Advance clock gracefully by dwell time so subsequent legs can still be queried
          const curMs = new Date(currentDepartureIso).getTime();
          currentDepartureIso = new Date(curMs + (dwellAfterMinutes + 15) * 60_000).toISOString();
        }
      } catch (legErr) {
        legs.push({
          legIndex: i,
          fromLabel: from.name,
          toLabel: to.name,
          fromCoord: [from.lon, from.lat],
          toCoord: [to.lon, to.lat],
          requestedDepartureTime: currentDepartureIso,
          dwellAfterMinutes,
          alternatives: [],
          selectedIndex: 0,
          error: legErr instanceof Error ? legErr.message : 'Leg routing failed',
        });
      }
    }

    const firstChosen = legs[0]?.alternatives[legs[0].selectedIndex];
    const lastLeg = legs[legs.length - 1];
    const lastChosen = lastLeg?.alternatives[lastLeg.selectedIndex];

    let totalDurationSeconds = totalTravelSeconds + totalDwellSeconds;
    if (firstChosen?.startTime && lastChosen?.endTime) {
      const span = Math.round(
        (new Date(lastChosen.endTime).getTime() - new Date(firstChosen.startTime).getTime()) / 1000
      );
      if (span > 0) totalDurationSeconds = span;
    }

    const result: TransitPlanResult = {
      departureTime: initialIso,
      totalDurationSeconds,
      totalTravelSeconds,
      totalDwellSeconds,
      legs,
    };

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transit planning failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
