import { NextRequest, NextResponse } from 'next/server';
import { decodePolylineToGeoJSON, diffMinutes, haversineMeters } from '@/lib/geo';
import { routeFootSegment } from '@/lib/footRouting';
import type {
  TransitFilterKey,
  TransitItinerary,
  TransitMultiStopLeg,
  TransitPlanResult,
  TransitSegment,
  WalkMetrics,
  WalkOptions,
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
  departureTime?: string; // ISO string — acts as arrival deadline when arriveBy is true
  arriveBy?: boolean;
  transitFilters?: TransitFilterKey[];
  walkOptions?: WalkOptions;
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

function alignDirectWalkToArriveBy(itin: TransitItinerary, targetIso: string): TransitItinerary {
  const targetMs = new Date(targetIso).getTime();
  if (Number.isNaN(targetMs) || itin.durationSeconds <= 0) return itin;
  const startIso = new Date(targetMs - itin.durationSeconds * 1000).toISOString();
  const endIso = new Date(targetMs).toISOString();
  return {
    ...itin,
    startTime: startIso,
    endTime: endIso,
    segments: itin.segments.map((seg) => ({
      ...seg,
      startTime: startIso,
      scheduledStartTime: startIso,
      endTime: endIso,
      scheduledEndTime: endIso,
    })),
  };
}

async function fetchSingleTransitLeg(
  from: PlanStopInput,
  to: PlanStopInput,
  targetIso: string,
  arriveBy: boolean,
  transitModesParam: string,
  legIndex: number,
  avoidSteps = false
): Promise<TransitItinerary[]> {
  const params = new URLSearchParams({
    fromPlace: `${from.lat.toFixed(6)},${from.lon.toFixed(6)}`,
    toPlace: `${to.lat.toFixed(6)},${to.lon.toFixed(6)}`,
    time: targetIso,
    arriveBy: arriveBy ? 'true' : 'false',
    numItineraries: '4',
    transitModes: transitModesParam,
    pedestrianProfile: avoidSteps ? 'WHEELCHAIR' : 'FOOT',
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

  let normalized: TransitItinerary[] = rawItineraries
    .filter((it) => Array.isArray(it.legs) && it.legs.length > 0)
    .map((it, idx) => normalizeItinerary(it, legIndex, idx));

  // Include direct walk when stops are close or transit returned nothing
  if (normalized.length === 0 && rawDirect.length > 0) {
    let directWalk = normalizeItinerary(rawDirect[0], legIndex, 0);
    if (arriveBy) directWalk = alignDirectWalkToArriveBy(directWalk, targetIso);
    normalized.push(directWalk);
  } else if (rawDirect.length > 0) {
    const walkCandidate = rawDirect[0];
    if (
      typeof walkCandidate.duration === 'number' &&
      walkCandidate.duration <= 1200 &&
      normalized[0] &&
      walkCandidate.duration < normalized[0].durationSeconds
    ) {
      let directWalk = normalizeItinerary(walkCandidate, legIndex, normalized.length);
      if (arriveBy) directWalk = alignDirectWalkToArriveBy(directWalk, targetIso);
      normalized.push(directWalk);
    }
  }

  if (arriveBy) {
    // Prefer itineraries arriving on or before the target deadline (+60s grace)
    const targetMs = new Date(targetIso).getTime();
    const onTime = normalized.filter((it) => new Date(it.endTime).getTime() <= targetMs + 60_000);
    if (onTime.length > 0) normalized = onTime;

    // Sort DESCENDING by startTime so option 0 is the latest departure that still arrives on time!
    normalized.sort((a, b) => {
      const startDiff = new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      return startDiff !== 0 ? startDiff : a.durationSeconds - b.durationSeconds;
    });
  } else {
    // Sort ASCENDING by arrival time so option 0 reaches the stop earliest
    normalized.sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime());
  }

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
    const {
      stops,
      departureTime,
      arriveBy = false,
      transitFilters,
      walkOptions,
      selectedAlternatives = {},
    } = body;
    const avoidSteps = Boolean(walkOptions?.avoidSteps);
    const hasWalkPreferences = Boolean(
      walkOptions && (walkOptions.preferGreen || walkOptions.preferQuiet || walkOptions.avoidSteps)
    );

    if (!Array.isArray(stops) || stops.length < 2) {
      return NextResponse.json({ error: 'At least 2 stops are required' }, { status: 400 });
    }
    if (stops.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 stops supported for chained public transport trips' },
        { status: 400 }
      );
    }

    const baseDate = departureTime ? new Date(departureTime) : new Date();
    const initialIso = Number.isNaN(baseDate.getTime())
      ? new Date().toISOString()
      : baseDate.toISOString();

    const transitModesParam = mapFiltersToMotisModes(transitFilters);
    const legCount = stops.length - 1;
    const legs: TransitMultiStopLeg[] = new Array(legCount);

    let totalTravelSeconds = 0;
    let totalDwellSeconds = 0;

    if (!arriveBy) {
      // Forward chaining: Origin -> Stop 1 (+dwell) -> Stop 2 (+dwell) -> Destination
      let currentDepartureIso = initialIso;

      for (let i = 0; i < legCount; i++) {
        const from = stops[i];
        const to = stops[i + 1];
        const isIntermediateDest = i < legCount - 1;
        const dwellAfterMinutes = isIntermediateDest
          ? Math.max(0, Math.round(to.dwellMinutes || 0))
          : 0;

        try {
          const alternatives = await fetchSingleTransitLeg(
            from,
            to,
            currentDepartureIso,
            false,
            transitModesParam,
            i,
            avoidSteps
          );

          const requestedAlt = selectedAlternatives[i] ?? 0;
          const selectedIndex =
            alternatives.length > 0
              ? Math.min(Math.max(0, requestedAlt), alternatives.length - 1)
              : 0;
          const chosen = alternatives[selectedIndex];

          legs[i] = {
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
          };

          if (chosen) {
            totalTravelSeconds += chosen.durationSeconds;
            if (isIntermediateDest) totalDwellSeconds += dwellAfterMinutes * 60;
            const arrivalMs = new Date(chosen.endTime).getTime();
            if (!Number.isNaN(arrivalMs)) {
              currentDepartureIso = new Date(arrivalMs + dwellAfterMinutes * 60_000).toISOString();
            }
          } else {
            const curMs = new Date(currentDepartureIso).getTime();
            currentDepartureIso = new Date(
              curMs + (dwellAfterMinutes + 15) * 60_000
            ).toISOString();
          }
        } catch (legErr) {
          legs[i] = {
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
          };
        }
      }
    } else {
      // Backward chaining: Destination (arriveBy) <- Leg n-2 <- (-dwell) <- ... <- Origin
      let currentTargetArrivalIso = initialIso;

      for (let i = legCount - 1; i >= 0; i--) {
        const from = stops[i];
        const to = stops[i + 1];
        const isIntermediateDest = i < legCount - 1;
        const dwellAfterMinutes = isIntermediateDest
          ? Math.max(0, Math.round(to.dwellMinutes || 0))
          : 0;
        // Dwell at `from` (stop i) before departing on leg i — subtracted to compute arrival deadline of leg i-1
        const dwellBeforeThisLeg = i > 0 ? Math.max(0, Math.round(from.dwellMinutes || 0)) : 0;

        try {
          const alternatives = await fetchSingleTransitLeg(
            from,
            to,
            currentTargetArrivalIso,
            true,
            transitModesParam,
            i,
            avoidSteps
          );

          const requestedAlt = selectedAlternatives[i] ?? 0;
          const selectedIndex =
            alternatives.length > 0
              ? Math.min(Math.max(0, requestedAlt), alternatives.length - 1)
              : 0;
          const chosen = alternatives[selectedIndex];

          legs[i] = {
            legIndex: i,
            fromLabel: from.name,
            toLabel: to.name,
            fromCoord: [from.lon, from.lat],
            toCoord: [to.lon, to.lat],
            requestedDepartureTime: chosen?.startTime || currentTargetArrivalIso,
            dwellAfterMinutes,
            alternatives,
            selectedIndex,
            error: alternatives.length === 0 ? 'No transit connection found for this leg' : undefined,
          };

          if (chosen) {
            totalTravelSeconds += chosen.durationSeconds;
            if (isIntermediateDest) totalDwellSeconds += dwellAfterMinutes * 60;
            const startMs = new Date(chosen.startTime).getTime();
            if (!Number.isNaN(startMs)) {
              currentTargetArrivalIso = new Date(
                startMs - dwellBeforeThisLeg * 60_000
              ).toISOString();
            }
          } else {
            const curMs = new Date(currentTargetArrivalIso).getTime();
            currentTargetArrivalIso = new Date(
              curMs - (dwellBeforeThisLeg + 15) * 60_000
            ).toISOString();
          }
        } catch (legErr) {
          legs[i] = {
            legIndex: i,
            fromLabel: from.name,
            toLabel: to.name,
            fromCoord: [from.lon, from.lat],
            toCoord: [to.lon, to.lat],
            requestedDepartureTime: currentTargetArrivalIso,
            dwellAfterMinutes,
            alternatives: [],
            selectedIndex: 0,
            error: legErr instanceof Error ? legErr.message : 'Leg routing failed',
          };
        }
      }
    }

    // Enhance street WALK segments on each leg's chosen itinerary when walking filters are active
    let aggregateWalkMetrics: WalkMetrics | undefined;
    if (hasWalkPreferences && walkOptions) {
      interface WalkUpgradeTask {
        legIdx: number;
        segIdx: number;
        seg: TransitSegment;
      }
      const tasks: WalkUpgradeTask[] = [];

      for (let lIdx = 0; lIdx < legs.length; lIdx++) {
        const leg = legs[lIdx];
        const chosen = leg?.alternatives[leg.selectedIndex];
        if (!chosen) continue;

        for (let sIdx = 0; sIdx < chosen.segments.length; sIdx++) {
          const seg = chosen.segments[sIdx];
          if (seg.mode !== 'WALK') continue;
          if (!seg.fromLat || !seg.fromLon || !seg.toLat || !seg.toLon) continue;
          const crowMeters = haversineMeters(seg.fromLat, seg.fromLon, seg.toLat, seg.toLon);
          const estDist = seg.distanceMeters ?? crowMeters;
          // Skip tiny indoor/platform corridors (< 80m) so indoor station transfers stay intact
          if (estDist < 80 && crowMeters < 70) continue;
          tasks.push({ legIdx: lIdx, segIdx: sIdx, seg });
        }
      }

      if (tasks.length > 0) {
        const upgraded = await Promise.all(
          tasks.map((task) =>
            routeFootSegment(
              { lat: task.seg.fromLat, lon: task.seg.fromLon },
              { lat: task.seg.toLat, lon: task.seg.toLon },
              walkOptions
            )
          )
        );

        let weightedGreen = 0;
        let weightedQuiet = 0;
        let metricWeightTotal = 0;
        const touchedLegs = new Set<number>();

        tasks.forEach((task, idx) => {
          const routed = upgraded[idx];
          if (!routed) return;

          const leg = legs[task.legIdx];
          const chosen = leg?.alternatives[leg.selectedIndex];
          if (!chosen) return;

          const segs = chosen.segments;
          const isOnlySeg = segs.length === 1;
          const isFirstSeg = task.segIdx === 0;
          const isLastSeg = task.segIdx === segs.length - 1;
          const seg = segs[task.segIdx];

          // For middle transfer walks between two transit vehicles, keep only if transfer window remains safe
          if (!isFirstSeg && !isLastSeg) {
            const prevEndMs = new Date(segs[task.segIdx - 1].endTime).getTime();
            const nextStartMs = new Date(segs[task.segIdx + 1].startTime).getTime();
            const windowSec = Math.round((nextStartMs - prevEndMs) / 1000);
            const maxSafeSec = Math.max(seg.durationSeconds + 45, windowSec - 30);
            if (Number.isFinite(maxSafeSec) && routed.durationSeconds > maxSafeSec) {
              return;
            }
          }

          let nextStartIso = seg.startTime;
          let nextEndIso = seg.endTime;

          if (isOnlySeg) {
            if (arriveBy) {
              const endMs = new Date(seg.endTime).getTime();
              if (!Number.isNaN(endMs)) {
                nextStartIso = new Date(endMs - routed.durationSeconds * 1000).toISOString();
              }
            } else {
              const startMs = new Date(seg.startTime).getTime();
              if (!Number.isNaN(startMs)) {
                nextEndIso = new Date(startMs + routed.durationSeconds * 1000).toISOString();
              }
            }
          } else if (isFirstSeg) {
            // Keep train boarding time anchored; shift walk start earlier/later accordingly
            const endMs = new Date(seg.endTime).getTime();
            if (!Number.isNaN(endMs)) {
              nextStartIso = new Date(endMs - routed.durationSeconds * 1000).toISOString();
            }
          } else if (isLastSeg) {
            // Keep train alighting time anchored; shift arrival time accordingly
            const startMs = new Date(seg.startTime).getTime();
            if (!Number.isNaN(startMs)) {
              nextEndIso = new Date(startMs + routed.durationSeconds * 1000).toISOString();
            }
          }

          segs[task.segIdx] = {
            ...seg,
            startTime: nextStartIso,
            scheduledStartTime: nextStartIso,
            endTime: nextEndIso,
            scheduledEndTime: nextEndIso,
            durationSeconds: routed.durationSeconds,
            distanceMeters: routed.distanceMeters,
            coordinates: routed.coordinates,
            walkMetrics: routed.walkMetrics,
          };

          if (routed.walkMetrics && routed.distanceMeters > 0) {
            weightedGreen += routed.walkMetrics.greenPercent * routed.distanceMeters;
            weightedQuiet += routed.walkMetrics.quietPercent * routed.distanceMeters;
            metricWeightTotal += routed.distanceMeters;
          }
          touchedLegs.add(task.legIdx);
        });

        for (const lIdx of touchedLegs) {
          const leg = legs[lIdx];
          const chosen = leg?.alternatives[leg.selectedIndex];
          if (!chosen || chosen.segments.length === 0) continue;
          const firstSeg = chosen.segments[0];
          const lastSeg = chosen.segments[chosen.segments.length - 1];
          const startMs = new Date(firstSeg.startTime).getTime();
          const endMs = new Date(lastSeg.endTime).getTime();
          const updatedDuration =
            !Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs
              ? Math.round((endMs - startMs) / 1000)
              : chosen.segments.reduce((acc, s) => acc + s.durationSeconds, 0);
          const updatedWalkMeters = chosen.segments
            .filter((s) => s.mode === 'WALK')
            .reduce((acc, s) => acc + (s.distanceMeters ?? 0), 0);

          leg.alternatives[leg.selectedIndex] = {
            ...chosen,
            startTime: firstSeg.startTime,
            endTime: lastSeg.endTime,
            durationSeconds: updatedDuration,
            walkDistanceMeters: Math.round(updatedWalkMeters),
          };
        }

        if (metricWeightTotal > 0) {
          aggregateWalkMetrics = {
            greenPercent: Math.min(100, Math.max(0, Math.round(weightedGreen / metricWeightTotal))),
            quietPercent: Math.min(100, Math.max(0, Math.round(weightedQuiet / metricWeightTotal))),
          };
        }

        totalTravelSeconds = legs.reduce((acc, leg) => {
          const chosen = leg?.alternatives[leg.selectedIndex];
          return acc + (chosen?.durationSeconds ?? 0);
        }, 0);
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
      departureTime: firstChosen?.startTime || initialIso,
      arriveBy,
      targetTime: initialIso,
      totalDurationSeconds,
      totalTravelSeconds,
      totalDwellSeconds,
      walkMetrics: aggregateWalkMetrics,
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
