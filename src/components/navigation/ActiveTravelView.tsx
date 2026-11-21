'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CornerUpLeft,
  CornerUpRight,
  Eye,
  Flag,
  Footprints,
  Loader2,
  Maximize2,
  Navigation,
  RefreshCw,
  RotateCcw,
  Sun,
  X,
} from 'lucide-react';
import {
  formatDistance,
  formatDuration,
  formatMunichTime,
  haversineMeters,
} from '@/lib/geo';
import { getTranslations } from '@/lib/i18n';
import { getLineVisualStyle } from '@/lib/mvvColors';
import {
  buildTransitTravelSteps,
  computeLiveRoadProgress,
  computeLiveTransitProgress,
  flattenRoadSteps,
} from '@/lib/travelEngine';
import { useNowTick } from '@/lib/useNowTick';
import { useNavStore } from '@/store/useNavStore';
import { LineBadge } from '@/components/ui/LineBadge';

function TurnArrowIcon({ instruction, className }: { instruction: string; className?: string }) {
  const lower = instruction.toLowerCase();
  if (lower.includes('arrive') || lower.includes('ziel') || lower.includes('destination')) {
    return <Flag className={className} />;
  }
  if (lower.includes('u-turn') || lower.includes('wenden')) {
    return <RotateCcw className={className} />;
  }
  if (lower.includes('left') || lower.includes('links')) {
    return <CornerUpLeft className={className} />;
  }
  if (lower.includes('right') || lower.includes('rechts')) {
    return <CornerUpRight className={className} />;
  }
  return <ArrowUp className={className} />;
}

export function ActiveTravelView() {
  const active = useNavStore((s) => s.liveFollowActive);
  const setLiveFollowActive = useNavStore((s) => s.setLiveFollowActive);
  const mode = useNavStore((s) => s.mode);
  const waypoints = useNavStore((s) => s.waypoints);
  const userLocation = useNavStore((s) => s.userLocation);
  const setUserLocation = useNavStore((s) => s.setUserLocation);
  const gpsError = useNavStore((s) => s.gpsError);
  const setGpsError = useNavStore((s) => s.setGpsError);
  const roadRoute = useNavStore((s) => s.roadRoute);
  const transitPlan = useNavStore((s) => s.transitPlan);
  const isRouting = useNavStore((s) => s.isRouting);
  const arrivalNotice = useNavStore((s) => s.arrivalNotice);
  const completeJourneyArrival = useNavStore((s) => s.completeJourneyArrival);
  const dismissArrivalNotice = useNavStore((s) => s.dismissArrivalNotice);
  const extendStayDuringTravel = useNavStore((s) => s.extendStayDuringTravel);
  const leaveStayNow = useNavStore((s) => s.leaveStayNow);
  const recalculateFromHere = useNavStore((s) => s.recalculateFromHere);
  const setHighlighted = useNavStore((s) => s.setHighlighted);
  const triggerFitBounds = useNavStore((s) => s.triggerFitBounds);
  const flyTo = useNavStore((s) => s.flyTo);
  const lang = useNavStore((s) => s.lang);

  const nowMs = useNowTick();
  const t = getTranslations(lang);

  const [wakeLocked, setWakeLocked] = useState(false);
  const [manualOverride, setManualOverride] = useState<{ key: string; index: number } | null>(null);
  const [overviewKey, setOverviewKey] = useState<string | null>(null);

  const leftStartVicinityRef = useRef(false);
  const startedBeforeScheduleEndRef = useRef(false);
  const arrivedTriggeredRef = useRef(false);

  const filledWaypoints = useMemo(
    () => waypoints.filter((w) => w.place !== null),
    [waypoints]
  );
  const originPlace = filledWaypoints[0]?.place ?? null;
  const destPlace = filledWaypoints[filledWaypoints.length - 1]?.place ?? null;

  const tripKey = `${mode}:${originPlace?.id ?? ''}:${destPlace?.id ?? ''}:${active ? '1' : '0'}`;
  const manualStepOffset =
    manualOverride && manualOverride.key === tripKey ? manualOverride.index : null;
  const overviewMode = overviewKey === tripKey;

  const setManualStepOffset = (index: number | null) => {
    setManualOverride(index === null ? null : { key: tripKey, index });
  };
  const toggleOverviewMode = () => {
    setOverviewKey((prev) => (prev === tripKey ? null : tripKey));
  };

  // Build transit travel phases & road steps
  const transitSteps = useMemo(
    () => (mode === 'transit' && transitPlan ? buildTransitTravelSteps(transitPlan) : []),
    [mode, transitPlan]
  );
  const roadSteps = useMemo(
    () => (mode !== 'transit' && roadRoute ? flattenRoadSteps(roadRoute) : []),
    [mode, roadRoute]
  );

  // Auto-dismiss arrival confirmation banner after 8 seconds
  useEffect(() => {
    if (!arrivalNotice) return;
    const id = setTimeout(() => {
      dismissArrivalNotice();
    }, 8000);
    return () => clearTimeout(id);
  }, [arrivalNotice, dismissArrivalNotice]);

  // Reset travel session tracking refs whenever active navigation starts
  useEffect(() => {
    if (!active) {
      arrivedTriggeredRef.current = false;
      leftStartVicinityRef.current = false;
      startedBeforeScheduleEndRef.current = false;
      return;
    }
    arrivedTriggeredRef.current = false;
    leftStartVicinityRef.current = false;
    const lastStep = transitSteps[transitSteps.length - 1];
    if (lastStep) {
      startedBeforeScheduleEndRef.current = Date.now() < new Date(lastStep.endIso).getTime();
    } else {
      startedBeforeScheduleEndRef.current = false;
    }
  }, [active, transitSteps]);

  // Live GPS watchPosition
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError(t.liveFollowError);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy, heading } = pos.coords;
        setGpsError(null);
        setUserLocation({ lat, lon, accuracy, heading });
      },
      () => {
        setGpsError(t.liveFollowError);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [active, setUserLocation, setGpsError, t.liveFollowError]);

  // Screen Wake Lock while actively traveling
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const acquire = () => {
      if (released || document.visibilityState !== 'visible') return;
      navigator.wakeLock
        .request('screen')
        .then((lock) => {
          if (released) {
            void lock.release();
            return;
          }
          sentinel = lock;
          setWakeLocked(true);
          lock.addEventListener('release', () => setWakeLocked(false));
        })
        .catch(() => setWakeLocked(false));
    };

    acquire();

    const onVisChange = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisChange);
      if (sentinel) {
        void sentinel.release();
        sentinel = null;
      }
      setWakeLocked(false);
    };
  }, [active]);

  // Live transit & road progress calculation
  const transitProgress = useMemo(
    () => computeLiveTransitProgress(transitSteps, nowMs, userLocation),
    [transitSteps, nowMs, userLocation]
  );

  const roadProgress = useMemo(
    () =>
      roadRoute
        ? computeLiveRoadProgress(roadRoute, roadSteps, userLocation)
        : {
            currentStepIndex: 0,
            distanceToNextTurnMeters: 0,
            remainingMeters: 0,
            remainingSeconds: 0,
            hasGpsFix: false,
          },
    [roadRoute, roadSteps, userLocation]
  );

  // AUTOMATIC DESTINATION ARRIVAL & AUTO-END (GPS for all 4 modes + schedule fallback underground!)
  useEffect(() => {
    if (!active || !destPlace || arrivedTriggeredRef.current) return;

    const arrivalThresholdMeters = mode === 'car' ? 70 : 50;
    const originToDestMeters = originPlace
      ? haversineMeters(originPlace.lat, originPlace.lon, destPlace.lat, destPlace.lon)
      : 999;

    let distToDest: number | null = null;
    if (userLocation) {
      distToDest = haversineMeters(
        userLocation.lat,
        userLocation.lon,
        destPlace.lat,
        destPlace.lon
      );
      if (distToDest > 75) {
        leftStartVicinityRef.current = true;
      }
      if (
        distToDest <= arrivalThresholdMeters &&
        (originToDestMeters > 80 || leftStartVicinityRef.current)
      ) {
        arrivedTriggeredRef.current = true;
        completeJourneyArrival(destPlace.name);
        return;
      }
    }

    // Underground / no-GPS (or weak indoor GPS within 250m) timetable completion fallback for transit
    if (
      mode === 'transit' &&
      startedBeforeScheduleEndRef.current &&
      transitProgress.scheduleFinished &&
      (distToDest === null || distToDest <= 250)
    ) {
      arrivedTriggeredRef.current = true;
      completeJourneyArrival(destPlace.name);
    }
  }, [
    active,
    mode,
    originPlace,
    destPlace,
    userLocation,
    transitProgress.scheduleFinished,
    completeJourneyArrival,
  ]);

  // Resolve displayed step index (live auto-step or manual preview override)
  const transitStepCount = transitSteps.length;
  const displayedTransitIndex =
    transitStepCount > 0
      ? Math.min(
          transitStepCount - 1,
          Math.max(0, manualStepOffset ?? transitProgress.liveStepIndex)
        )
      : 0;
  const activeTransitStep = transitSteps[displayedTransitIndex] ?? null;

  const roadStepCount = roadSteps.length;
  const displayedRoadIndex =
    roadStepCount > 0
      ? Math.min(roadStepCount - 1, Math.max(0, manualStepOffset ?? roadProgress.currentStepIndex))
      : 0;
  const activeRoadStep = roadSteps[displayedRoadIndex] ?? null;
  const nextRoadStep = roadSteps[displayedRoadIndex + 1] ?? null;

  // Auto-focus map cleanly onto the active step when focus mode is enabled
  useEffect(() => {
    if (!active) return;
    if (overviewMode) {
      setHighlighted(null);
      triggerFitBounds();
      return;
    }

    if (mode === 'transit' && activeTransitStep) {
      if (activeTransitStep.kind === 'stay') {
        setHighlighted(null);
        flyTo(activeTransitStep.lat, activeTransitStep.lon, 15.2);
      } else if (activeTransitStep.coordinates.length >= 2) {
        setHighlighted({
          type: 'transit-segment',
          coordinates: activeTransitStep.coordinates,
          label: activeTransitStep.id,
        });
      }
    } else if (
      mode !== 'transit' &&
      manualStepOffset !== null &&
      activeRoadStep?.coordinates.length
    ) {
      setHighlighted({
        type: 'road-maneuver',
        coordinates: activeRoadStep.coordinates,
        label: `travel-road-${displayedRoadIndex}`,
      });
    } else if (mode !== 'transit' && userLocation) {
      setHighlighted(null);
      flyTo(userLocation.lat, userLocation.lon, 16);
    } else if (mode !== 'transit' && activeRoadStep?.coordinates.length) {
      setHighlighted({
        type: 'road-maneuver',
        coordinates: activeRoadStep.coordinates,
        label: `travel-road-${displayedRoadIndex}`,
      });
    }
  }, [
    active,
    overviewMode,
    mode,
    manualStepOffset,
    activeTransitStep,
    activeRoadStep,
    displayedRoadIndex,
    userLocation,
    setHighlighted,
    triggerFitBounds,
    flyTo,
  ]);

  // Arrival Confirmation Banner (shown after route automatically ends on destination arrival)
  if (!active) {
    if (!arrivalNotice) return null;
    return (
      <div
        data-testid="arrival-notice"
        className="fixed pt-safe inset-x-3 top-0 md:inset-x-auto md:top-3 md:left-1/2 md:-translate-x-1/2 z-40 md:w-[min(420px,calc(100vw-24px))] pointer-events-none"
      >
        <div className="pointer-events-auto rounded-lg bg-[#181818] text-white border border-[#333333] shadow-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-[#34d399] shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {t.travel.arrivedTitle} {arrivalNotice.destinationName}
              </div>
              <div className="text-xs text-[#b7b7b7]">{t.travel.routeEnded}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissArrivalNotice}
            className="w-8 h-8 rounded-md inline-flex items-center justify-center text-[#b7b7b7] hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const handleExit = () => {
    setManualOverride(null);
    setOverviewKey(null);
    setHighlighted(null);
    setLiveFollowActive(false);
  };

  // =========================================================================
  // PUBLIC TRANSIT ACTIVE TRAVEL COMPANION (SBB Mobile Reisebegleiter)
  // =========================================================================
  if (mode === 'transit' && transitPlan && activeTransitStep) {
    const lastLeg = transitPlan.legs[transitPlan.legs.length - 1];
    const lastItin = lastLeg?.alternatives[lastLeg.selectedIndex];
    const finalEtaIso = lastItin?.endTime;
    const isManualPreview =
      manualStepOffset !== null && manualStepOffset !== transitProgress.liveStepIndex;
    const effectiveNow = nowMs || new Date(activeTransitStep.startIso).getTime();

    return (
      <>
        {/* Top Compact SBB Dark Status Bar */}
        <div className="fixed pt-safe inset-x-3 top-0 md:left-3 md:right-auto md:w-[412px] z-30 pointer-events-none">
          <div className="pointer-events-auto rounded-lg bg-[#181818] text-white border border-[#333333] shadow-lg px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {activeTransitStep.kind === 'ride' ? (
                <LineBadge
                  mode={activeTransitStep.segment.mode}
                  line={activeTransitStep.segment.routeShortName}
                  color={activeTransitStep.segment.routeColor}
                  textColor={activeTransitStep.segment.routeTextColor}
                  size="xs"
                />
              ) : (
                <span className="w-2 h-2 rounded-full bg-[#eb0000] shrink-0" />
              )}
              <div className="text-xs font-medium truncate">
                <span className="font-semibold">
                  {t.travel.stepOf} {displayedTransitIndex + 1}/{transitStepCount}
                </span>
                <span className="text-[#a3a3a3]">
                  {' '}
                  ·{' '}
                  {transitProgress.trackingSource === 'gps'
                    ? t.travel.gpsActive
                    : t.travel.scheduleSync}
                </span>
              </div>
              {wakeLocked && (
                <span title={t.screenAwake} className="inline-flex shrink-0">
                  <Sun className="w-3.5 h-3.5 text-[#a3a3a3]" />
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={toggleOverviewMode}
                className="h-7 px-2 rounded-md text-[11px] font-medium bg-[#2b2b2b] hover:bg-[#383838] text-[#e5e5e5] inline-flex items-center gap-1 cursor-pointer"
                title={overviewMode ? t.travel.focusStep : t.travel.overview}
                aria-label={overviewMode ? t.travel.focusStep : t.travel.overview}
              >
                {overviewMode ? <Eye className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">
                  {overviewMode ? t.travel.focusStep : t.travel.overview}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setManualStepOffset(null);
                  void recalculateFromHere(activeTransitStep.legIndex);
                }}
                disabled={isRouting}
                className="w-7 h-7 rounded-md bg-[#2b2b2b] hover:bg-[#383838] text-[#e5e5e5] inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
                title={t.travel.recalculate}
                aria-label={t.travel.recalculate}
              >
                {isRouting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={handleExit}
                className="h-7 px-2.5 rounded-md text-xs font-semibold bg-[#eb0000] hover:bg-[#c60018] text-white cursor-pointer"
              >
                {t.liveFollowStop}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom SBB Active Phase Card */}
        <div
          data-testid="active-travel-card"
          className="fixed inset-x-0 bottom-0 md:inset-x-auto md:left-3 md:bottom-3 md:w-[412px] z-30 rounded-t-2xl md:rounded-xl bg-white dark:bg-[#1e1e1e] border-t md:border border-[#d4d4d4] dark:border-[#333333] shadow-[0_-8px_30px_rgba(0,0,0,0.18)] overflow-hidden pb-safe md:pb-0"
        >
          <div className="p-4 space-y-3">
            {/* PHASE 1: WALK TO STATION / DESTINATION */}
            {activeTransitStep.kind === 'walk' && (() => {
              const remainingMeters =
                !isManualPreview && transitProgress.walkRemainingMeters !== undefined
                  ? transitProgress.walkRemainingMeters
                  : activeTransitStep.distanceMeters;
              const estWalkMins = Math.max(1, Math.round(remainingMeters / 75));
              const nb = activeTransitStep.nextBoarding;
              const catchMins = nb
                ? Math.round((new Date(nb.departureIso).getTime() - effectiveNow) / 60000)
                : null;
              const urgent = catchMins !== null && catchMins <= 2;

              return (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#686868] dark:text-[#999999]">
                        <Footprints className="w-3.5 h-3.5" />
                        <span>~{estWalkMins} min</span>
                      </div>
                      <h2 className="text-lg font-bold text-[#111111] dark:text-white tracking-tight leading-snug mt-0.5 truncate">
                        {t.travel.walkTo} {activeTransitStep.toName}
                      </h2>
                    </div>
                    <div className="text-base font-bold font-mono tabular-nums text-[#111111] dark:text-white shrink-0">
                      {formatDistance(remainingMeters, lang)}
                    </div>
                  </div>

                  {nb && (
                    <div
                      className={`p-2.5 rounded-md bg-[#f6f6f6] dark:bg-[#262626] border border-[#e5e5e5] dark:border-[#333333] border-l-[3px] flex items-center justify-between gap-2 ${
                        urgent ? 'border-l-[#eb0000]' : 'border-l-[#111111] dark:border-l-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <LineBadge
                          mode={nb.mode}
                          line={nb.line}
                          color={nb.color}
                          textColor={nb.textColor}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#111111] dark:text-white truncate">
                            {nb.headsign || nb.stationName}
                          </div>
                          {nb.track && (
                            <div className="text-[11px] text-[#686868] dark:text-[#999999]">
                              {t.platform} {nb.track}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {catchMins !== null && catchMins >= -1 && catchMins <= 90 && (
                          <div
                            className={`text-xs font-bold tabular-nums ${
                              urgent ? 'text-[#eb0000]' : 'text-[#111111] dark:text-white'
                            }`}
                          >
                            {catchMins <= 0 ? t.now : `${t.inMin} ${catchMins} min`}
                          </div>
                        )}
                        <div className="text-[11px] font-mono tabular-nums text-[#767676]">
                          {formatMunichTime(nb.departureIso, lang)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* PHASE 2: ONBOARD TRANSIT WITH LIVE STOP TICKER */}
            {activeTransitStep.kind === 'ride' && (() => {
              const seg = activeTransitStep.segment;
              const style = getLineVisualStyle(
                seg.mode,
                seg.routeShortName,
                seg.routeColor,
                seg.routeTextColor
              );
              const stops = activeTransitStep.stops;
              const exitIdx = Math.max(0, stops.length - 1);
              const curStopIdx = isManualPreview ? 0 : transitProgress.currentStopIndex;
              const stopsLeft = isManualPreview ? exitIdx : transitProgress.stopsRemaining;
              const minsLeft = Math.max(
                0,
                Math.round((new Date(seg.endTime).getTime() - effectiveNow) / 60000)
              );

              const headline =
                stopsLeft === 0
                  ? t.travel.getOffNow
                  : stopsLeft === 1
                    ? t.travel.getOffNext
                    : `${t.travel.getOffIn} ${stopsLeft} ${t.stopsCount}`;

              const alertExit = stopsLeft <= 1;

              return (
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#ececec] dark:border-[#2e2e2e]">
                    <div className="min-w-0">
                      <div
                        className={`text-lg font-bold tracking-tight leading-tight ${
                          alertExit ? 'text-[#eb0000]' : 'text-[#111111] dark:text-white'
                        }`}
                      >
                        {headline}
                      </div>
                      <div className="text-xs text-[#686868] dark:text-[#999999] mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-[#111111] dark:text-white">
                          {seg.toName}
                        </span>
                        <span>· {formatMunichTime(seg.endTime, lang)}</span>
                        {seg.fromTrack && (
                          <span className="px-1 py-[0.5px] rounded-[3px] border border-[#d4d4d4] dark:border-[#444444] text-[10px]">
                            {t.platform} {seg.fromTrack}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-bold font-mono tabular-nums text-[#111111] dark:text-white shrink-0">
                      {minsLeft > 0 ? `${minsLeft} min` : t.now}
                    </span>
                  </div>

                  {/* Live Stop-by-Stop Vertical Ticker */}
                  <div className="max-h-[156px] overflow-y-auto space-y-1.5 pr-1">
                    {stops.map((st, idx) => {
                      const passed = !isManualPreview && idx < curStopIdx;
                      const isNext = !isManualPreview && idx === Math.min(exitIdx, curStopIdx + 1);
                      const isExit = idx === exitIdx;
                      return (
                        <div
                          key={`${st.name}-${idx}`}
                          className={`flex items-center justify-between gap-2 text-xs ${
                            passed
                              ? 'text-[#a3a3a3] dark:text-[#555555]'
                              : isExit
                                ? 'text-[#111111] dark:text-white font-bold'
                                : isNext
                                  ? 'text-[#111111] dark:text-white font-semibold'
                                  : 'text-[#444444] dark:text-[#cccccc]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              style={
                                isExit
                                  ? { backgroundColor: '#eb0000' }
                                  : passed
                                    ? { backgroundColor: '#d4d4d4' }
                                    : isNext
                                      ? { backgroundColor: style.bg }
                                      : { borderColor: style.bg, borderWidth: '1.5px' }
                              }
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                            />
                            <span className="truncate">{st.name}</span>
                            {isExit ? (
                              <span className="text-[10px] font-semibold text-[#eb0000] shrink-0">
                                {t.travel.exitStop}
                              </span>
                            ) : isNext ? (
                              <span className="text-[10px] font-medium text-[#686868] dark:text-[#999999] shrink-0">
                                ({t.travel.nextStopTag})
                              </span>
                            ) : null}
                          </div>
                          {st.timeIso && (
                            <span className="font-mono text-[11px] tabular-nums shrink-0">
                              {formatMunichTime(st.timeIso, lang)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Next Up Preview Strip */}
                  {activeTransitStep.nextPreview && (
                    <div className="px-2.5 py-2 rounded-md bg-[#f6f6f6] dark:bg-[#262626] border border-[#e5e5e5] dark:border-[#333333] flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-[#111111] dark:text-white shrink-0">
                          {t.travel.nextUp}:
                        </span>
                        {activeTransitStep.nextPreview.kind === 'ride' &&
                          activeTransitStep.nextPreview.mode && (
                            <LineBadge
                              mode={activeTransitStep.nextPreview.mode}
                              line={activeTransitStep.nextPreview.line}
                              color={activeTransitStep.nextPreview.color}
                              textColor={activeTransitStep.nextPreview.textColor}
                              size="xs"
                            />
                          )}
                        <span className="text-[#444444] dark:text-[#cccccc] truncate">
                          {activeTransitStep.nextPreview.kind === 'walk'
                            ? `${t.walkSegment} → ${activeTransitStep.nextPreview.label}`
                            : activeTransitStep.nextPreview.kind === 'stay'
                              ? `${t.dwellLabel} ${activeTransitStep.nextPreview.detail} · ${activeTransitStep.nextPreview.label}`
                              : activeTransitStep.nextPreview.label}
                        </span>
                      </div>
                      {activeTransitStep.nextPreview.detail &&
                        activeTransitStep.nextPreview.kind !== 'stay' && (
                          <span className="text-[11px] text-[#686868] dark:text-[#999999] shrink-0">
                            {activeTransitStep.nextPreview.kind === 'ride'
                              ? `${t.platform} ${activeTransitStep.nextPreview.detail}`
                              : activeTransitStep.nextPreview.detail}
                          </span>
                        )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* PHASE 3: MULTI-STOP STAY COUNTDOWN */}
            {activeTransitStep.kind === 'stay' && (() => {
              const stayEndMs = new Date(activeTransitStep.endIso).getTime();
              const stayLeftMins = Math.max(0, Math.round((stayEndMs - effectiveNow) / 60000));
              const nb = activeTransitStep.nextBoarding;

              return (
                <div className="space-y-3">
                  <div className="border-l-[3px] border-[#111111] dark:border-white pl-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#686868] dark:text-[#999999]">
                      {t.travel.stayInProgress} · {activeTransitStep.stopName}
                    </div>
                    <div className="text-2xl font-bold tabular-nums text-[#111111] dark:text-white leading-tight mt-0.5">
                      {isManualPreview
                        ? `${activeTransitStep.plannedDwellMinutes} min`
                        : `${stayLeftMins} min ${t.remaining}`}
                    </div>
                    <div className="text-xs text-[#686868] dark:text-[#999999] mt-0.5 tabular-nums">
                      {t.travel.headOutAt}{' '}
                      <strong className="text-[#111111] dark:text-white">
                        {formatMunichTime(activeTransitStep.endIso, lang)}
                      </strong>
                    </div>
                  </div>

                  {nb && (
                    <div className="px-2.5 py-2 rounded-md bg-[#f6f6f6] dark:bg-[#262626] border border-[#e5e5e5] dark:border-[#333333] flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <LineBadge
                          mode={nb.mode}
                          line={nb.line}
                          color={nb.color}
                          textColor={nb.textColor}
                          size="xs"
                        />
                        <span className="font-medium text-[#111111] dark:text-white truncate">
                          → {activeTransitStep.nextLegDestination}
                        </span>
                      </div>
                      <span className="font-mono font-semibold tabular-nums text-[#111111] dark:text-white shrink-0">
                        {formatMunichTime(nb.departureIso, lang)}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isRouting}
                      onClick={() => {
                        setManualStepOffset(null);
                        void extendStayDuringTravel(activeTransitStep.waypointIndex, 10);
                      }}
                      className="h-10 rounded-lg border border-[#d4d4d4] dark:border-[#3d3d3d] bg-white hover:bg-[#f6f6f6] dark:bg-[#262626] dark:hover:bg-[#303030] text-xs font-semibold text-[#111111] dark:text-white inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{t.travel.extendStay}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isRouting}
                      onClick={() => {
                        setManualStepOffset(null);
                        void leaveStayNow(activeTransitStep.waypointIndex);
                      }}
                      className="h-10 rounded-lg bg-[#eb0000] hover:bg-[#c60018] text-xs font-semibold text-white inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <span>{t.travel.leaveStayNow} →</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Step Navigation Footer */}
            <div className="pt-2.5 border-t border-[#ececec] dark:border-[#2e2e2e] flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                disabled={displayedTransitIndex <= 0}
                onClick={() => setManualStepOffset(Math.max(0, displayedTransitIndex - 1))}
                className="inline-flex items-center gap-1 h-8 px-2 -ml-2 rounded-md font-medium text-[#444444] hover:text-[#111111] hover:bg-black/5 dark:text-[#b7b7b7] dark:hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{t.travel.prevStep}</span>
              </button>

              <div className="flex items-center gap-2">
                {isManualPreview && (
                  <button
                    type="button"
                    onClick={() => setManualStepOffset(null)}
                    className="px-2 py-0.5 rounded bg-[#eb0000] text-white text-[11px] font-semibold cursor-pointer"
                  >
                    {t.travel.jumpToLive}
                  </button>
                )}
                {finalEtaIso && (
                  <span className="font-mono font-semibold tabular-nums text-[#111111] dark:text-white">
                    ETA {formatMunichTime(finalEtaIso, lang)}
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={displayedTransitIndex >= transitStepCount - 1}
                onClick={() =>
                  setManualStepOffset(Math.min(transitStepCount - 1, displayedTransitIndex + 1))
                }
                className="inline-flex items-center gap-1 h-8 px-2 -mr-2 rounded-md font-medium text-[#444444] hover:text-[#111111] hover:bg-black/5 dark:text-[#b7b7b7] dark:hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <span>{t.travel.nextStepBtn}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // =========================================================================
  // WALK / BIKE / CAR TURN-BY-TURN HUD (SBB High-Contrast Top + Minimal Bottom)
  // =========================================================================
  if (mode !== 'transit' && roadRoute && activeRoadStep) {
    const isManualPreview =
      manualStepOffset !== null && manualStepOffset !== roadProgress.currentStepIndex;
    const turnDistance = isManualPreview
      ? activeRoadStep.maneuver.distanceMeters
      : roadProgress.distanceToNextTurnMeters;
    const etaIso =
      nowMs > 0
        ? new Date(nowMs + roadProgress.remainingSeconds * 1000).toISOString()
        : undefined;

    return (
      <>
        {/* Top High-Contrast SBB Turn Maneuver Banner */}
        <div className="fixed pt-safe inset-x-3 top-0 md:left-3 md:right-auto md:w-[412px] z-30 pointer-events-none">
          <div className="pointer-events-auto rounded-lg bg-[#181818] text-white border border-[#333333] shadow-xl p-3 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-[#2b2b2b] flex items-center justify-center shrink-0">
                <TurnArrowIcon
                  instruction={activeRoadStep.maneuver.instruction}
                  className="w-5 h-5 text-white"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs text-[#b7b7b7] font-mono tabular-nums">
                  {turnDistance > 0 && (
                    <span className="whitespace-nowrap shrink-0">
                      {t.travel.inDist} {formatDistance(turnDistance, lang)}
                    </span>
                  )}
                  {gpsError && (
                    <span
                      title={gpsError}
                      className="text-[#f87171] font-sans truncate"
                    >
                      · {t.travel.noGps}
                    </span>
                  )}
                </div>
                <div className="text-[15px] font-bold leading-snug text-white">
                  {activeRoadStep.maneuver.instruction}
                </div>
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  disabled={displayedRoadIndex <= 0}
                  onClick={() => setManualStepOffset(Math.max(0, displayedRoadIndex - 1))}
                  className="w-7 h-7 rounded-md hover:bg-white/10 inline-flex items-center justify-center disabled:opacity-30 cursor-pointer"
                  aria-label={t.travel.prevStep}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={displayedRoadIndex >= roadStepCount - 1}
                  onClick={() =>
                    setManualStepOffset(Math.min(roadStepCount - 1, displayedRoadIndex + 1))
                  }
                  className="w-7 h-7 rounded-md hover:bg-white/10 inline-flex items-center justify-center disabled:opacity-30 cursor-pointer"
                  aria-label={t.travel.nextStepBtn}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {nextRoadStep && (
              <div className="pt-2 border-t border-[#2d2d2d] flex items-center justify-between gap-2 text-[11px] text-[#b7b7b7]">
                <span className="truncate">
                  {t.travel.then}: {nextRoadStep.maneuver.instruction}
                </span>
                {isManualPreview && (
                  <button
                    type="button"
                    onClick={() => setManualStepOffset(null)}
                    className="px-2 py-0.5 rounded bg-[#eb0000] text-white font-semibold shrink-0 cursor-pointer"
                  >
                    {t.travel.jumpToLive}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Minimal Bottom SBB ETA Strip */}
        <div
          data-testid="active-travel-card"
          className="fixed inset-x-0 bottom-0 md:inset-x-auto md:left-3 md:bottom-3 md:w-[412px] z-30 rounded-t-2xl md:rounded-xl bg-white dark:bg-[#1e1e1e] border-t md:border border-[#d4d4d4] dark:border-[#333333] shadow-[0_-6px_24px_rgba(0,0,0,0.14)] px-4 py-3 pb-safe md:pb-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold tabular-nums text-[#111111] dark:text-white">
                  {formatDuration(roadProgress.remainingSeconds, lang)}
                </span>
                <span className="text-xs font-medium tabular-nums text-[#686868] dark:text-[#999999]">
                  · {formatDistance(roadProgress.remainingMeters, lang)}
                </span>
              </div>
              <div className="text-xs text-[#686868] dark:text-[#999999] truncate tabular-nums">
                {etaIso ? `ETA ${formatMunichTime(etaIso, lang)}` : ''}
                {destPlace ? ` · ${destPlace.name}` : ''}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={toggleOverviewMode}
                className="w-9 h-9 rounded-lg border border-[#d4d4d4] dark:border-[#3d3d3d] bg-[#f6f6f6] dark:bg-[#262626] text-[#212121] dark:text-[#e5e5e5] inline-flex items-center justify-center cursor-pointer"
                title={overviewMode ? t.travel.focusStep : t.travel.overview}
              >
                {overviewMode ? <Eye className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setManualStepOffset(null);
                  void recalculateFromHere(activeRoadStep.legIndex);
                }}
                disabled={isRouting}
                className="w-9 h-9 rounded-lg border border-[#d4d4d4] dark:border-[#3d3d3d] bg-[#f6f6f6] dark:bg-[#262626] text-[#212121] dark:text-[#e5e5e5] inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
                title={t.travel.recalculate}
              >
                {isRouting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={handleExit}
                className="h-9 px-3.5 rounded-lg text-xs font-semibold bg-[#eb0000] hover:bg-[#c60018] text-white inline-flex items-center gap-1 cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{t.liveFollowStop}</span>
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Fallback HUD while recalculating or if a very short route has no discrete steps
  return (
    <div className="fixed pt-safe inset-x-3 top-0 md:left-3 md:right-auto md:w-[412px] z-30 pointer-events-none">
      <div className="pointer-events-auto rounded-lg bg-[#181818] text-white border border-[#333333] shadow-lg px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 text-xs font-medium">
          {isRouting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#eb0000] shrink-0" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-[#eb0000] shrink-0" />
          )}
          <span className="truncate">
            {isRouting ? t.calculating : destPlace ? destPlace.name : t.liveFollowActive}
          </span>
        </div>
        <button
          type="button"
          onClick={handleExit}
          className="h-7 px-2.5 rounded-md text-xs font-semibold bg-[#eb0000] hover:bg-[#c60018] text-white cursor-pointer shrink-0"
        >
          {t.liveFollowStop}
        </button>
      </div>
    </div>
  );
}
