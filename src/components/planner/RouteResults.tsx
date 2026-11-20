'use client';

import { useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Footprints,
  Loader2,
  Navigation,
  Route,
  Sparkles,
} from 'lucide-react';
import {
  formatDistance,
  formatDuration,
  formatMunichTime,
} from '@/lib/geo';
import { getTranslations } from '@/lib/i18n';
import { getLineVisualStyle } from '@/lib/mvvColors';
import { useNavStore } from '@/store/useNavStore';
import type { TransitSegment } from '@/lib/types';
import { LineBadge } from '@/components/ui/LineBadge';

function DelayTag({ delay, realTime, cancelled }: { delay: number; realTime: boolean; cancelled: boolean }) {
  const lang = useNavStore((s) => s.lang);
  const t = getTranslations(lang);

  if (cancelled) {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
        {t.cancelled}
      </span>
    );
  }
  if (!realTime) return null;
  if (delay >= 1) {
    return (
      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
        +{delay}m
      </span>
    );
  }
  if (delay <= -1) {
    return (
      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
        {delay}m
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
      {t.onTime}
    </span>
  );
}

function TransitSegmentRow({ segment }: { segment: TransitSegment }) {
  const lang = useNavStore((s) => s.lang);
  const setHighlighted = useNavStore((s) => s.setHighlighted);
  const highlighted = useNavStore((s) => s.highlighted);
  const t = getTranslations(lang);
  const [showStops, setShowStops] = useState(false);

  const isWalk = segment.mode === 'WALK';
  const style = getLineVisualStyle(
    segment.mode,
    segment.routeShortName,
    segment.routeColor,
    segment.routeTextColor
  );

  const isSelected = highlighted?.label === segment.id;

  const handleFocus = () => {
    if (segment.coordinates.length > 0) {
      setHighlighted({
        type: 'transit-segment',
        coordinates: segment.coordinates,
        label: segment.id,
      });
    }
  };

  if (isWalk) {
    return (
      <button
        type="button"
        onClick={handleFocus}
        className={`w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
          isSelected
            ? 'bg-sky-50 dark:bg-sky-950/50 ring-1 ring-sky-400'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
        }`}
      >
        <div className="w-11 text-[11px] font-mono text-slate-400 shrink-0">
          {formatMunichTime(segment.startTime, lang)}
        </div>
        <div className="w-4 flex justify-center shrink-0">
          <Footprints className="w-3.5 h-3.5 text-slate-400" />
        </div>
        <div className="flex-1 min-w-0 text-slate-600 dark:text-slate-300">
          <span className="font-medium">{t.walkSegment}</span>{' '}
          <span className="text-slate-400">
            · {formatDuration(segment.durationSeconds, lang)}
            {segment.distanceMeters ? ` (${formatDistance(segment.distanceMeters, lang)})` : ''}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl border transition-all ${
        isSelected
          ? 'border-[#0065ae] bg-sky-50/70 dark:bg-sky-950/35 shadow-xs'
          : 'border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleFocus();
        }}
        className="p-2.5 cursor-pointer"
      >
        {/* Top line: Departure station & time */}
        <div className="flex items-start gap-2.5">
          <div className="w-11 shrink-0 leading-tight">
            <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
              {formatMunichTime(segment.startTime, lang)}
            </div>
            <DelayTag
              delay={segment.startDelayMinutes}
              realTime={segment.realTime}
              cancelled={segment.cancelled}
            />
          </div>

          <div className="flex flex-col items-center self-stretch pt-1 shrink-0">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: style.bg }}
            />
            <span
              className="w-1 flex-1 my-1 rounded-full min-h-[28px]"
              style={{ backgroundColor: style.bg }}
            />
            <span
              className="w-2.5 h-2.5 rounded-full border-2 bg-white dark:bg-slate-900 shrink-0"
              style={{ borderColor: style.bg }}
            />
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {segment.fromName}
              </span>
              {segment.fromTrack && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                  {t.platform} {segment.fromTrack}
                </span>
              )}
            </div>

            {/* Line badge & direction */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <LineBadge
                mode={segment.mode}
                line={segment.routeShortName}
                color={segment.routeColor}
                textColor={segment.routeTextColor}
                size="sm"
              />
              {segment.headsign && (
                <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                  → {segment.headsign}
                </span>
              )}
              <span className="text-[10px] text-slate-400 ml-auto shrink-0">
                {formatDuration(segment.durationSeconds, lang)}
              </span>
            </div>

            {/* Intermediate stops toggle */}
            {segment.intermediateStops.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStops((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showStops ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  {segment.intermediateStops.length + 1}{' '}
                  {segment.intermediateStops.length === 0 ? t.stopSingular : t.stopsCount}
                </button>
                {showStops && (
                  <ul className="mt-1.5 pl-2 border-l border-slate-200 dark:border-slate-700 space-y-1">
                    {segment.intermediateStops.map((st, idx) => (
                      <li
                        key={`${st.name}-${idx}`}
                        className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400"
                      >
                        <span className="truncate">{st.name}</span>
                        <span className="font-mono text-[10px] shrink-0">
                          {formatMunichTime(st.departure || st.arrival, lang)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Arrival station */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {segment.toName}
              </span>
              <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-200 shrink-0">
                {formatMunichTime(segment.endTime, lang)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RouteResults() {
  const lang = useNavStore((s) => s.lang);
  const mode = useNavStore((s) => s.mode);
  const waypoints = useNavStore((s) => s.waypoints);
  const roadRoute = useNavStore((s) => s.roadRoute);
  const transitPlan = useNavStore((s) => s.transitPlan);
  const isRouting = useNavStore((s) => s.isRouting);
  const routeError = useNavStore((s) => s.routeError);
  const liveFollowActive = useNavStore((s) => s.liveFollowActive);
  const setLiveFollowActive = useNavStore((s) => s.setLiveFollowActive);
  const selectTransitAlternative = useNavStore((s) => s.selectTransitAlternative);
  const setHighlighted = useNavStore((s) => s.setHighlighted);
  const flyTo = useNavStore((s) => s.flyTo);
  const loadDemoTrip = useNavStore((s) => s.loadDemoTrip);

  const t = getTranslations(lang);
  const [expandedRoadLegs, setExpandedRoadLegs] = useState<Record<number, boolean>>({ 0: true });

  if (isRouting) {
    return (
      <div className="py-10 flex flex-col items-center justify-center gap-2.5 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-[#0065ae]" />
        <span className="text-xs font-medium">{t.calculating}</span>
      </div>
    );
  }

  if (routeError) {
    return (
      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">{t.routeError}</div>
          <div className="text-[11px] opacity-90 mt-0.5">{routeError}</div>
        </div>
      </div>
    );
  }

  // PUBLIC TRANSPORT RESULTS
  if (mode === 'transit' && transitPlan) {
    const firstLeg = transitPlan.legs[0];
    const lastLeg = transitPlan.legs[transitPlan.legs.length - 1];
    const firstItin = firstLeg?.alternatives[firstLeg.selectedIndex];
    const lastItin = lastLeg?.alternatives[lastLeg.selectedIndex];

    return (
      <div className="space-y-3">
        {/* Overall Multi-Stop Summary Card */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-[#0065ae]/10 via-sky-50 to-white dark:from-[#0065ae]/25 dark:via-slate-800/80 dark:to-slate-900 border border-sky-200/80 dark:border-sky-800/50">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#0065ae] dark:text-sky-400">
                {t.totalTrip}
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {formatDuration(transitPlan.totalDurationSeconds, lang)}
                </span>
                {firstItin && lastItin && (
                  <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
                    {formatMunichTime(firstItin.startTime, lang)} →{' '}
                    {formatMunichTime(lastItin.endTime, lang)}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLiveFollowActive(!liveFollowActive)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                liveFollowActive
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-[#0065ae] hover:bg-[#005494] text-white shadow-sm'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              {liveFollowActive ? t.liveFollowStop : t.liveFollowStart}
            </button>
          </div>

          <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
            <span>
              {t.travelTime}: <strong>{formatDuration(transitPlan.totalTravelSeconds, lang)}</strong>
            </span>
            {transitPlan.totalDwellSeconds > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <Clock className="w-3 h-3" />
                {t.stayTime}: <strong>{formatDuration(transitPlan.totalDwellSeconds, lang)}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Chained Legs */}
        <div className="space-y-3">
          {transitPlan.legs.map((leg) => {
            const chosen = leg.alternatives[leg.selectedIndex];
            const isMultiLeg = transitPlan.legs.length > 1;
            const nextLeg = transitPlan.legs[leg.legIndex + 1];
            const nextChosen = nextLeg?.alternatives[nextLeg.selectedIndex];

            return (
              <div key={leg.legIndex} className="space-y-2">
                <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-2.5 space-y-2">
                  {/* Leg header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isMultiLeg && (
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#0065ae] text-white shrink-0">
                          {t.leg} {leg.legIndex + 1}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {leg.fromLabel} → {leg.toLabel}
                      </span>
                    </div>
                    {chosen && (
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                        {formatDuration(chosen.durationSeconds, lang)}
                      </span>
                    )}
                  </div>

                  {/* Alternative connection selector pills */}
                  {leg.alternatives.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {leg.alternatives.map((alt, altIdx) => {
                        const isPicked = altIdx === leg.selectedIndex;
                        const transitSegs = alt.segments.filter((s) => s.mode !== 'WALK');
                        return (
                          <button
                            key={alt.id}
                            type="button"
                            onClick={() => selectTransitAlternative(leg.legIndex, altIdx)}
                            className={`flex flex-col items-start gap-1 px-2.5 py-1.5 rounded-lg border text-left transition-all shrink-0 cursor-pointer ${
                              isPicked
                                ? 'bg-white dark:bg-slate-800 border-[#0065ae] ring-1 ring-[#0065ae]/40 shadow-2xs'
                                : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 opacity-80 hover:opacity-100'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-900 dark:text-white">
                              <span>
                                {formatMunichTime(alt.startTime, lang)}–
                                {formatMunichTime(alt.endTime, lang)}
                              </span>
                              <span className="text-[10px] font-sans font-medium text-slate-500">
                                ({formatDuration(alt.durationSeconds, lang)})
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {transitSegs.length === 0 ? (
                                <LineBadge mode="WALK" size="xs" />
                              ) : (
                                transitSegs.slice(0, 3).map((s) => (
                                  <LineBadge
                                    key={s.id}
                                    mode={s.mode}
                                    line={s.routeShortName}
                                    color={s.routeColor}
                                    textColor={s.routeTextColor}
                                    size="xs"
                                  />
                                ))
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Selected itinerary segments */}
                  {chosen ? (
                    <div className="space-y-1.5">
                      {chosen.segments.map((seg) => (
                        <TransitSegmentRow key={seg.id} segment={seg} />
                      ))}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-300">
                      {leg.error || t.noTransitFound}
                    </div>
                  )}
                </div>

                {/* Dwell / Stay Divider between legs */}
                {leg.legIndex < transitPlan.legs.length - 1 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 text-[11px] text-amber-900 dark:text-amber-200">
                    <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="truncate">
                      <strong>
                        {t.dwellLabel} {leg.dwellAfterMinutes} {t.dwellMinutes}
                      </strong>{' '}
                      · {leg.toLabel}
                    </span>
                    {nextChosen && (
                      <span className="ml-auto font-mono font-semibold text-amber-700 dark:text-amber-300 shrink-0">
                        → {formatMunichTime(nextChosen.startTime, lang)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ROAD ROUTE RESULTS (FOOT / BIKE / CAR)
  if (mode !== 'transit' && roadRoute) {
    const filledWaypoints = waypoints.filter((w) => w.place !== null);
    const baseMs = roadRoute.calculatedAt ? new Date(roadRoute.calculatedAt).getTime() : 0;
    const etaIso =
      baseMs > 0
        ? new Date(baseMs + roadRoute.totalDurationSeconds * 1000).toISOString()
        : undefined;

    return (
      <div className="space-y-3">
        {/* Summary card */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-slate-100 via-white to-slate-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-900 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {formatDuration(roadRoute.totalDurationSeconds, lang)}
                </span>
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {formatDistance(roadRoute.totalDistanceMeters, lang)}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {etaIso ? `ETA ${formatMunichTime(etaIso, lang)} · ` : ''}
                {t.viaProvider}{' '}
                {roadRoute.provider === 'ors' ? 'OpenRouteService' : 'Valhalla OSM'}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLiveFollowActive(!liveFollowActive)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                liveFollowActive
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-[#0065ae] hover:bg-[#005494] text-white shadow-sm'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              {liveFollowActive ? t.liveFollowStop : t.liveFollowStart}
            </button>
          </div>
        </div>

        {/* Turn-by-turn legs */}
        <div className="space-y-2">
          {roadRoute.legs.map((leg, legIdx) => {
            const fromName = filledWaypoints[legIdx]?.place?.name || `Stop ${legIdx + 1}`;
            const toName = filledWaypoints[legIdx + 1]?.place?.name || `Stop ${legIdx + 2}`;
            const isExpanded = expandedRoadLegs[legIdx] ?? roadRoute.legs.length === 1;

            return (
              <div
                key={legIdx}
                className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpandedRoadLegs((prev) => ({ ...prev, [legIdx]: !isExpanded }));
                    if (leg.coordinates.length > 0) {
                      setHighlighted({
                        type: 'leg',
                        coordinates: leg.coordinates,
                        label: `road-leg-${legIdx}`,
                      });
                    }
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {fromName} → {toName}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 shrink-0">
                    {formatDuration(leg.durationSeconds, lang)} ·{' '}
                    {formatDistance(leg.distanceMeters, lang)}
                  </span>
                </button>

                {isExpanded && (
                  <ol className="divide-y divide-slate-100 dark:divide-slate-800/80 border-t border-slate-100 dark:border-slate-800">
                    {leg.maneuvers.map((m, mIdx) => (
                      <li key={mIdx}>
                        <button
                          type="button"
                          onClick={() => {
                            if (m.location) {
                              flyTo(m.location[1], m.location[0], 16.2);
                            }
                            if (
                              m.beginShapeIndex !== undefined &&
                              m.endShapeIndex !== undefined &&
                              leg.coordinates.length > 0
                            ) {
                              setHighlighted({
                                type: 'road-maneuver',
                                coordinates: leg.coordinates.slice(
                                  m.beginShapeIndex,
                                  m.endShapeIndex + 1
                                ),
                                label: `step-${legIdx}-${mIdx}`,
                              });
                            }
                          }}
                          className="w-full flex items-start justify-between gap-2.5 px-3 py-2 text-left text-xs hover:bg-sky-50/70 dark:hover:bg-sky-950/30 transition-colors cursor-pointer"
                        >
                          <span className="text-slate-700 dark:text-slate-200 leading-snug">
                            {m.instruction}
                          </span>
                          {m.distanceMeters > 0 && (
                            <span className="text-[11px] font-mono text-slate-400 shrink-0">
                              {formatDistance(m.distanceMeters, lang)}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // EMPTY STATE
  return (
    <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 space-y-3 text-center">
      <div className="mx-auto w-10 h-10 rounded-xl bg-[#0065ae]/12 dark:bg-[#0065ae]/25 flex items-center justify-center text-[#0065ae] dark:text-sky-400">
        <Route className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t.emptyStateTitle}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {t.emptyStateDesc}
        </p>
      </div>
      <button
        type="button"
        onClick={loadDemoTrip}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#0065ae] hover:bg-[#005494] text-white shadow-sm transition-colors cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{t.demoTripBtn}</span>
      </button>
      <p className="text-[11px] text-slate-400 dark:text-slate-500">{t.mapClickHint}</p>
    </div>
  );
}
