import {
  computeRemainingDistanceMeters,
  findNearestCoordinateIndex,
  haversineMeters,
} from './geo';
import type {
  RoadManeuver,
  RoadRouteResult,
  TransitPlanResult,
  TransitSegment,
} from './types';

export interface OnboardStopPoint {
  name: string;
  lat: number;
  lon: number;
  timeIso?: string;
  track?: string;
  isBoarding?: boolean;
  isExit?: boolean;
}

export interface NextBoardingInfo {
  mode: string;
  line?: string;
  color?: string;
  textColor?: string;
  headsign?: string;
  track?: string;
  departureIso: string;
  stationName: string;
}

export type TransitTravelStep =
  | {
      kind: 'walk';
      id: string;
      legIndex: number;
      segment: TransitSegment;
      startIso: string;
      endIso: string;
      fromName: string;
      toName: string;
      durationSeconds: number;
      distanceMeters: number;
      coordinates: [number, number][];
      nextBoarding?: NextBoardingInfo;
    }
  | {
      kind: 'ride';
      id: string;
      legIndex: number;
      segment: TransitSegment;
      startIso: string;
      endIso: string;
      durationSeconds: number;
      coordinates: [number, number][];
      stops: OnboardStopPoint[];
      nextPreview?: {
        kind: 'walk' | 'ride' | 'stay' | 'arrive';
        label: string;
        detail?: string;
        line?: string;
        mode?: string;
        color?: string;
        textColor?: string;
      };
    }
  | {
      kind: 'stay';
      id: string;
      legIndex: number;
      waypointIndex: number;
      stopName: string;
      lat: number;
      lon: number;
      startIso: string;
      endIso: string;
      plannedDwellMinutes: number;
      coordinates: [number, number][];
      nextBoarding?: NextBoardingInfo;
      nextLegDestination: string;
    };

/** Flatten a multi-stop TransitPlanResult into sequential actionable travel phases. */
export function buildTransitTravelSteps(plan: TransitPlanResult): TransitTravelStep[] {
  const steps: TransitTravelStep[] = [];

  for (let lIdx = 0; lIdx < plan.legs.length; lIdx++) {
    const leg = plan.legs[lIdx];
    const itin = leg.alternatives[leg.selectedIndex];
    if (!itin) continue;

    for (let sIdx = 0; sIdx < itin.segments.length; sIdx++) {
      const seg = itin.segments[sIdx];
      const nextSeg = itin.segments[sIdx + 1];

      if (seg.mode === 'WALK') {
        const nextBoarding: NextBoardingInfo | undefined =
          nextSeg && nextSeg.mode !== 'WALK'
            ? {
                mode: nextSeg.mode,
                line: nextSeg.routeShortName,
                color: nextSeg.routeColor,
                textColor: nextSeg.routeTextColor,
                headsign: nextSeg.headsign,
                track: nextSeg.fromTrack,
                departureIso: nextSeg.startTime,
                stationName: nextSeg.fromName,
              }
            : undefined;

        steps.push({
          kind: 'walk',
          id: seg.id,
          legIndex: lIdx,
          segment: seg,
          startIso: seg.startTime,
          endIso: seg.endTime,
          fromName: seg.fromName,
          toName: seg.toName,
          durationSeconds: seg.durationSeconds,
          distanceMeters:
            seg.distanceMeters ??
            Math.round(haversineMeters(seg.fromLat, seg.fromLon, seg.toLat, seg.toLon)),
          coordinates: seg.coordinates,
          nextBoarding,
        });
      } else {
        const stops: OnboardStopPoint[] = [
          {
            name: seg.fromName,
            lat: seg.fromLat,
            lon: seg.fromLon,
            timeIso: seg.startTime,
            track: seg.fromTrack,
            isBoarding: true,
          },
          ...seg.intermediateStops.map((st) => ({
            name: st.name,
            lat: st.lat,
            lon: st.lon,
            timeIso: st.departure || st.arrival,
            track: st.track,
          })),
          {
            name: seg.toName,
            lat: seg.toLat,
            lon: seg.toLon,
            timeIso: seg.endTime,
            track: seg.toTrack,
            isExit: true,
          },
        ];

        let nextPreview: Extract<TransitTravelStep, { kind: 'ride' }>['nextPreview'];
        if (nextSeg) {
          if (nextSeg.mode === 'WALK') {
            nextPreview = {
              kind: 'walk',
              label: nextSeg.toName || leg.toLabel,
              detail: `${Math.max(1, Math.round(nextSeg.durationSeconds / 60))} min`,
            };
          } else {
            nextPreview = {
              kind: 'ride',
              label: nextSeg.headsign || nextSeg.toName,
              detail: nextSeg.fromTrack,
              line: nextSeg.routeShortName,
              mode: nextSeg.mode,
              color: nextSeg.routeColor,
              textColor: nextSeg.routeTextColor,
            };
          }
        } else if (lIdx < plan.legs.length - 1) {
          nextPreview = {
            kind: 'stay',
            label: leg.toLabel,
            detail: `${leg.dwellAfterMinutes} min`,
          };
        } else {
          nextPreview = {
            kind: 'arrive',
            label: leg.toLabel,
          };
        }

        steps.push({
          kind: 'ride',
          id: seg.id,
          legIndex: lIdx,
          segment: seg,
          startIso: seg.startTime,
          endIso: seg.endTime,
          durationSeconds: seg.durationSeconds,
          coordinates: seg.coordinates,
          stops,
          nextPreview,
        });
      }
    }

    // Add multi-stop stay phase between Leg i and Leg i+1
    if (lIdx < plan.legs.length - 1) {
      const nextLeg = plan.legs[lIdx + 1];
      const nextItin = nextLeg?.alternatives[nextLeg.selectedIndex];
      const nextFirstTransit = nextItin?.segments.find((s) => s.mode !== 'WALK');

      steps.push({
        kind: 'stay',
        id: `stay-after-leg-${lIdx}`,
        legIndex: lIdx,
        waypointIndex: lIdx + 1,
        stopName: leg.toLabel,
        lat: leg.toCoord[1],
        lon: leg.toCoord[0],
        startIso: itin.endTime,
        endIso: nextItin?.startTime || itin.endTime,
        plannedDwellMinutes: leg.dwellAfterMinutes,
        coordinates: [leg.toCoord],
        nextLegDestination: nextLeg.toLabel,
        nextBoarding: nextFirstTransit
          ? {
              mode: nextFirstTransit.mode,
              line: nextFirstTransit.routeShortName,
              color: nextFirstTransit.routeColor,
              textColor: nextFirstTransit.routeTextColor,
              headsign: nextFirstTransit.headsign,
              track: nextFirstTransit.fromTrack,
              departureIso: nextFirstTransit.startTime,
              stationName: nextFirstTransit.fromName,
            }
          : undefined,
      });
    }
  }

  return steps;
}

export interface LiveTransitProgress {
  liveStepIndex: number;
  trackingSource: 'gps' | 'schedule';
  /** For 'ride' steps: index of the last passed or current stop inside step.stops[] */
  currentStopIndex: number;
  /** For 'ride' steps: stops remaining until exit (0 = at exit stop, 1 = next stop is exit!) */
  stopsRemaining: number;
  /** For 'walk' steps: remaining meters */
  walkRemainingMeters?: number;
  /** True when final destination reached (either GPS arrival or schedule completion) */
  scheduleFinished: boolean;
}

export function computeLiveTransitProgress(
  steps: TransitTravelStep[],
  nowMs: number,
  userLocation: { lat: number; lon: number; accuracy?: number } | null
): LiveTransitProgress {
  if (steps.length === 0) {
    return {
      liveStepIndex: 0,
      trackingSource: 'schedule',
      currentStopIndex: 0,
      stopsRemaining: 0,
      scheduleFinished: false,
    };
  }

  const effectiveNow = nowMs > 0 ? nowMs : new Date(steps[0].startIso).getTime();

  // 1. Determine time-based step index (works seamlessly underground in U-Bahn/S-Bahn tunnels!)
  let timeStepIdx = 0;
  let scheduleFinished = false;
  const lastEndMs = new Date(steps[steps.length - 1].endIso).getTime();

  if (effectiveNow >= lastEndMs) {
    timeStepIdx = steps.length - 1;
    // Mark schedule finished 90s after planned arrival
    scheduleFinished = effectiveNow >= lastEndMs + 90_000;
  } else {
    for (let i = 0; i < steps.length; i++) {
      const sMs = new Date(steps[i].startIso).getTime();
      const eMs = new Date(steps[i].endIso).getTime();
      if (effectiveNow < sMs) {
        timeStepIdx = i;
        break;
      }
      if (effectiveNow >= sMs && effectiveNow < eMs) {
        timeStepIdx = i;
        break;
      }
      timeStepIdx = i;
    }
  }

  const hasReliableGps = Boolean(
    userLocation && (userLocation.accuracy === undefined || userLocation.accuracy <= 150)
  );

  // 2. Compute step-specific live details
  const activeStep = steps[timeStepIdx];
  let trackingSource: 'gps' | 'schedule' = 'schedule';
  let currentStopIndex = 0;
  let stopsRemaining = 0;
  let walkRemainingMeters: number | undefined;

  if (activeStep.kind === 'walk') {
    if (hasReliableGps && userLocation && activeStep.coordinates.length > 1) {
      const { index, distanceMeters } = findNearestCoordinateIndex(
        userLocation.lat,
        userLocation.lon,
        activeStep.coordinates
      );
      if (distanceMeters < 250) {
        trackingSource = 'gps';
        walkRemainingMeters = Math.round(
          computeRemainingDistanceMeters(index, activeStep.coordinates)
        );
      } else {
        walkRemainingMeters = activeStep.distanceMeters;
      }
    } else {
      walkRemainingMeters = activeStep.distanceMeters;
    }
  } else if (activeStep.kind === 'ride') {
    const stops = activeStep.stops;
    const exitIdx = Math.max(0, stops.length - 1);

    // First compute time-interpolated stop index (bulletproof underground!)
    let timeStopIdx = 0;
    for (let i = 0; i < stops.length; i++) {
      const tIso = stops[i].timeIso;
      if (tIso && effectiveNow >= new Date(tIso).getTime()) {
        timeStopIdx = i;
      }
    }
    currentStopIndex = Math.min(exitIdx, timeStopIdx);

    // If GPS is reliable and near one of the stops (Tram / Bus / above-ground S-Bahn), fuse GPS!
    if (hasReliableGps && userLocation && activeStep.segment.mode !== 'SUBWAY') {
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < stops.length; i++) {
        const d = haversineMeters(userLocation.lat, userLocation.lon, stops[i].lat, stops[i].lon);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0 && bestDist < 220) {
        trackingSource = 'gps';
        currentStopIndex = Math.max(currentStopIndex, bestIdx);
      }
    }

    stopsRemaining = Math.max(0, exitIdx - currentStopIndex);
  } else if (activeStep.kind === 'stay') {
    if (hasReliableGps && userLocation) {
      const distToStop = haversineMeters(
        userLocation.lat,
        userLocation.lon,
        activeStep.lat,
        activeStep.lon
      );
      if (distToStop < 350) trackingSource = 'gps';
    }
  }

  return {
    liveStepIndex: timeStepIdx,
    trackingSource,
    currentStopIndex,
    stopsRemaining,
    walkRemainingMeters,
    scheduleFinished,
  };
}

export interface FlattenedRoadStep {
  legIndex: number;
  maneuverIndex: number;
  maneuver: RoadManeuver;
  globalStartShapeIndex: number;
  globalEndShapeIndex: number;
  coordinates: [number, number][];
}

export function flattenRoadSteps(route: RoadRouteResult): FlattenedRoadStep[] {
  const flat: FlattenedRoadStep[] = [];
  let offset = 0;

  for (let legIdx = 0; legIdx < route.legs.length; legIdx++) {
    const leg = route.legs[legIdx];
    for (let mIdx = 0; mIdx < leg.maneuvers.length; mIdx++) {
      const m = leg.maneuvers[mIdx];
      const localStart = m.beginShapeIndex ?? 0;
      const localEnd = m.endShapeIndex ?? Math.min(leg.coordinates.length - 1, localStart + 1);
      flat.push({
        legIndex: legIdx,
        maneuverIndex: mIdx,
        maneuver: m,
        globalStartShapeIndex: offset + localStart,
        globalEndShapeIndex: offset + localEnd,
        coordinates: leg.coordinates.slice(localStart, localEnd + 1),
      });
    }
    offset += Math.max(0, leg.coordinates.length - 1);
  }

  return flat;
}

export interface LiveRoadProgress {
  currentStepIndex: number;
  distanceToNextTurnMeters: number;
  remainingMeters: number;
  remainingSeconds: number;
  hasGpsFix: boolean;
}

export function computeLiveRoadProgress(
  route: RoadRouteResult,
  flatSteps: FlattenedRoadStep[],
  userLocation: { lat: number; lon: number } | null
): LiveRoadProgress {
  if (!userLocation || route.coordinates.length < 2 || flatSteps.length === 0) {
    return {
      currentStepIndex: 0,
      distanceToNextTurnMeters: flatSteps[0]?.maneuver.distanceMeters ?? 0,
      remainingMeters: route.totalDistanceMeters,
      remainingSeconds: route.totalDurationSeconds,
      hasGpsFix: false,
    };
  }

  const { index } = findNearestCoordinateIndex(
    userLocation.lat,
    userLocation.lon,
    route.coordinates
  );
  const remainingMeters = Math.round(computeRemainingDistanceMeters(index, route.coordinates));
  const ratio =
    route.totalDistanceMeters > 0
      ? Math.min(1, Math.max(0, remainingMeters / route.totalDistanceMeters))
      : 0;
  const remainingSeconds = Math.round(route.totalDurationSeconds * ratio);

  let stepIdx = flatSteps.length - 1;
  for (let i = 0; i < flatSteps.length; i++) {
    if (index <= flatSteps[i].globalEndShapeIndex) {
      stepIdx = i;
      break;
    }
  }

  const cur = flatSteps[stepIdx];
  const distToTurn = Math.round(
    computeRemainingDistanceMeters(
      index,
      route.coordinates.slice(0, Math.min(route.coordinates.length, cur.globalEndShapeIndex + 1))
    )
  );

  return {
    currentStepIndex: stepIdx,
    distanceToNextTurnMeters: Math.max(0, distToTurn),
    remainingMeters,
    remainingSeconds,
    hasGpsFix: true,
  };
}
