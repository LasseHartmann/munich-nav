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
import { useNowTick } from '@/lib/useNowTick';
import { useNavStore } from '@/store/useNavStore';
import type { TransitSegment } from '@/lib/types';
import { LineBadge } from '@/components/ui/LineBadge';

function CountdownChip({ isoTime, nowMs }: { isoTime?: string; nowMs: number }) {
  const lang = useNavStore((s) => s.lang);
  const t = getTranslations(lang);
  if (!isoTime || nowMs === 0) return null;

  const diffMin = Math.round((new Date(isoTime).getTime() - nowMs) / 60000);
  if (diffMin < -2 || diffMin > 90) return null;

  const isNow = diffMin <= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums ${
        isNow
          ? 'bg-emerald-400 text-slate-950 animate-pulse'
          : 'bg-white/20 text-white backdrop-blur-xs'
      }`}
    >
      {isNow ? t.leavingNow : `${t.leaveIn} ${diffMin} min`}
    </span>
  );
}

function DelayTag({
  delay,
  realTime,
  cancelled,
}: {
  delay: number;
  realTime: boolean;
  cancelled: boolean;
}) {
  const lang = useNavStore((s) => s.lang);
  const t = getTranslations(lang);

  if (cancelled) {
    return (
      <span className="inline-block text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
        {t.cancelled}
      </span>
    );
  }
  if (!realTime) return null;
  if (delay >= 1) {
    return (
      <span className="inline-block text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 tabular-nums">
        +{delay}m
      </span>
    );
  }
  if (delay <= -1) {
    return (
      <span className="inline-block text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
        {delay}m
      </span>
    );
  }
  return (
    <span className="inline-block text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
      {t.onTime}
    </span>
  );
}

function TransitSegmentRow({ segment }: { segment: TransitSegment }) {
  const lang = useNavStore((s) => s.lang);
  const setHighlighted = useNavStore((s) => s.setHighlighted);
  const highlighted = useNavStore((s) => s.highlighted);
  const setMobileSheetSnap = useNavStore((s) => s.setMobileSheetSnap);
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
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setMobileSheetSnap('half');
      }
    }
  };

  if (isWalk) {
    return (
      <button
        type="button"
        onClick={handleFocus}
        className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all active:scale-[0.99] cursor-pointer ${
          isSelected
            ? 'bg-sky-50 dark:bg-sky-950/60 ring-2 ring-[#0065ae]'
            : 'bg-slate-100/75 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <div className="w-12 text-xs font-mono font-bold tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
          {formatMunichTime(segment.startTime, lang)}
        </div>
        <div className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
          <Footprints className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
        </div>
        <div className="flex-1 min-w-0 text-slate-700 dark:text-slate-200">
          <span className="font-bold">{t.walkSegment}</span>{' '}
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            · {formatDuration(segment.durationSeconds, lang)}
            {segment.distanceMeters ? ` (${formatDistance(segment.distanceMeters, lang)})` : ''}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div
      className={`rounded-2xl border-2 transition-all overflow-hidden ${
        isSelected
          ? 'border-[#0065ae] bg-sky-50/70 dark:bg-sky-950/35 shadow-sm'
          : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleFocus();
        }}
        className="p-3 cursor-pointer"
      >
        <div className="flex items-start gap-2.5">
          {/* Bold time column */}
          <div className="w-12 shrink-0 leading-tight space-y-1">
            <div className="text-[13px] font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatMunichTime(segment.startTime, lang)}
            </div>
            <DelayTag
              delay={segment.startDelayMinutes}
              realTime={segment.realTime}
              cancelled={segment.cancelled}
            />
          </div>

          {/* Colored transit spine */}
          <div className="flex flex-col items-center self-stretch pt-1 shrink-0">
            <span
              className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white dark:ring-slate-900 shadow-2xs"
              style={{ backgroundColor: style.bg }}
            />
            <span
              className="w-1.5 flex-1 my-1 rounded-full min-h-[34px]"
              style={{ backgroundColor: style.bg }}
            />
            <span
              className="w-3 h-3 rounded-full border-2 bg-white dark:bg-slate-900 shrink-0"
              style={{ borderColor: style.bg }}
            />
          </div>

          {/* Station & line info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-extrabold text-slate-900 dark:text-white truncate">
                {segment.fromName}
              </span>
              {segment.fromTrack && (
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 shrink-0">
                  {t.platform} {segment.fromTrack}
                </span>
              )}
            </div>

            {/* Chunky line badge & headsign */}
            <div className="flex items-center gap-2 flex-wrap">
              <LineBadge
                mode={segment.mode}
                line={segment.routeShortName}
                color={segment.routeColor}
                textColor={segment.routeTextColor}
                size="md"
              />
              {segment.headsign && (
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                  → {segment.headsign}
                </span>
              )}
              <span className="text-[11px] font-bold text-slate-400 ml-auto shrink-0 tabular-nums">
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
                  className="inline-flex items-center gap-1 py-1 px-2 -ml-2 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {showStops ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  {segment.intermediateStops.length + 1}{' '}
                  {segment.intermediateStops.length === 0 ? t.stopSingular : t.stopsCount}
                </button>
                {showStops && (
                  <ul className="mt-1.5 pl-2.5 border-l-2 border-slate-200 dark:border-slate-700 space-y-1.5">
                    {segment.intermediateStops.map((st, idx) => (
                      <li
                        key={`${st.name}-${idx}`}
                        className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300"
                      >
                        <span className="truncate font-medium">{st.name}</span>
                        <span className="font-mono text-[11px] tabular-nums text-slate-400 shrink-0">
                          {formatMunichTime(st.departure || st.arrival, lang)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Arrival row */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[13px] font-extrabold text-slate-900 dark:text-white truncate">
                {segment.toName}
              </span>
              <span className="text-[13px] font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100 shrink-0">
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
  const setMobileSheetSnap = useNavStore((s) => s.setMobileSheetSnap);
  const flyTo = useNavStore((s) => s.flyTo);
  const loadDemoTrip = useNavStore((s) => s.loadDemoTrip);

  const nowMs = useNowTick();
  const t = getTranslations(lang);
  const [expandedRoadLegs, setExpandedRoadLegs] = useState<Record<number, boolean>>({ 0: true });

  if (isRouting) {
    return (
      <div className="py-10 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
        <div className="w-11 h-11 rounded-2xl bg-[#0065ae]/12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#0065ae]" />
        </div>
        <span className="text-sm font-bold">{t.calculating}</span>
      </div>
    );
  }

  if (routeError) {
    return (
      <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-200 dark:border-rose-800/70 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
        <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
        <div>
          <div className="font-extrabold text-sm">{t.routeError}</div>
          <div className="text-xs opacity-90 mt-0.5">{routeError}</div>
        </div>
      </div>
    );
  }

  // PUBLIC TRANSPORT RESULTS (Citymapper-style Playful Utility!)
  if (mode === 'transit' && transitPlan) {
    const firstLeg = transitPlan.legs[0];
    const lastLeg = transitPlan.legs[transitPlan.legs.length - 1];
    const firstItin = firstLeg?.alternatives[firstLeg.selectedIndex];
    const lastItin = lastLeg?.alternatives[lastLeg.selectedIndex];

    return (
      <div className="space-y-3.5">
        {/* Vibrant MVV Cobalt Hero Summary Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0065ae] via-[#0277bd] to-[#00897b] text-white shadow-lg shadow-[#0065ae]/20">
          <div className="flex items-start justify-between gap-2.5">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-100">
                  {t.totalTrip}
                </span>
                <CountdownChip isoTime={firstItin?.startTime} nowMs={nowMs} />
              </div>

              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className="text-2xl font-extrabold tracking-tight tabular-nums">
                  {formatDuration(transitPlan.totalDurationSeconds, lang)}
                </span>
                {firstItin && lastItin && (
                  <span className="text-sm font-mono font-bold tabular-nums text-sky-100">
                    {formatMunichTime(firstItin.startTime, lang)} →{' '}
                    {formatMunichTime(lastItin.endTime, lang)}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLiveFollowActive(!liveFollowActive)}
              className={`inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-2xl text-sm font-extrabold transition-all active:scale-95 cursor-pointer shrink-0 shadow-md ${
                liveFollowActive
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
              }`}
            >
              <Navigation className="w-4 h-4" />
              <span>{liveFollowActive ? t.liveFollowStop : t.liveFollowStart}</span>
            </button>
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-white/15 flex items-center gap-3 text-xs font-semibold text-sky-50 flex-wrap">
            <span>
              {t.travelTime}:{' '}
              <strong className="text-white">
                {formatDuration(transitPlan.totalTravelSeconds, lang)}
              </strong>
            </span>
            {transitPlan.totalDwellSeconds > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-extrabold text-[11px]">
                <Clock className="w-3 h-3" />
                {t.stayTime}: {formatDuration(transitPlan.totalDwellSeconds, lang)}
              </span>
            )}
          </div>
        </div>

        {/* Chained Legs */}
        <div className="space-y-3.5">
          {transitPlan.legs.map((leg) => {
            const chosen = leg.alternatives[leg.selectedIndex];
            const isMultiLeg = transitPlan.legs.length > 1;
            const nextLeg = transitPlan.legs[leg.legIndex + 1];
            const nextChosen = nextLeg?.alternatives[nextLeg.selectedIndex];

            return (
              <div key={leg.legIndex} className="space-y-2.5">
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/70 p-3 space-y-2.5">
                  {/* Leg header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isMultiLeg && (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg bg-[#0065ae] text-white shrink-0">
                          {t.leg} {leg.legIndex + 1}
                        </span>
                      )}
                      <span className="text-[13px] font-extrabold text-slate-900 dark:text-white truncate">
                        {leg.fromLabel} → {leg.toLabel}
                      </span>
                    </div>
                    {chosen && (
                      <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                        {formatDuration(chosen.durationSeconds, lang)}
                      </span>
                    )}
                  </div>

                  {/* Chunky Alternative Connection Cards */}
                  {leg.alternatives.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                      {leg.alternatives.map((alt, altIdx) => {
                        const isPicked = altIdx === leg.selectedIndex;
                        const transitSegs = alt.segments.filter((s) => s.mode !== 'WALK');
                        return (
                          <button
                            key={alt.id}
                            type="button"
                            onClick={() => selectTransitAlternative(leg.legIndex, altIdx)}
                            className={`flex flex-col items-start gap-1.5 px-3 py-2 rounded-xl border-2 text-left transition-all active:scale-95 shrink-0 cursor-pointer ${
                              isPicked
                                ? 'bg-white dark:bg-slate-800 border-[#0065ae] shadow-sm'
                                : 'bg-white/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 opacity-85 hover:opacity-100'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 text-xs font-mono font-extrabold tabular-nums text-slate-900 dark:text-white">
                              <span>
                                {formatMunichTime(alt.startTime, lang)}–
                                {formatMunichTime(alt.endTime, lang)}
                              </span>
                              <span className="text-[11px] font-sans font-bold text-slate-500 dark:text-slate-400">
                                {formatDuration(alt.durationSeconds, lang)}
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
                    <div className="space-y-2">
                      {chosen.segments.map((seg) => (
                        <TransitSegmentRow key={seg.id} segment={seg} />
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-xs font-semibold text-amber-800 dark:text-amber-300">
                      {leg.error || t.noTransitFound}
                    </div>
                  )}
                </div>

                {/* High-Visibility Amber Stay Divider between legs */}
                {leg.legIndex < transitPlan.legs.length - 1 && (
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-amber-100/90 dark:bg-amber-950/60 border-2 border-amber-300/80 dark:border-amber-700/70 text-xs text-amber-950 dark:text-amber-100">
                    <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold truncate">
                        {t.dwellLabel} {leg.dwellAfterMinutes} {t.dwellMinutes} · {leg.toLabel}
                      </div>
                    </div>
                    {nextChosen && (
                      <span className="font-mono font-extrabold tabular-nums text-amber-900 dark:text-amber-300 bg-white/70 dark:bg-amber-900/60 px-2 py-0.5 rounded-lg shrink-0">
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

    const heroGradient =
      mode === 'bike'
        ? 'from-emerald-600 to-teal-600 shadow-emerald-600/20'
        : mode === 'foot'
          ? 'from-teal-600 to-cyan-600 shadow-teal-600/20'
          : 'from-blue-600 to-indigo-600 shadow-blue-600/20';

    return (
      <div className="space-y-3.5">
        {/* Vibrant Mode-Colored Hero Summary Card */}
        <div className={`p-4 rounded-2xl bg-gradient-to-br ${heroGradient} text-white shadow-lg`}>
          <div className="flex items-center justify-between gap-2.5">
            <div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-2xl font-extrabold tracking-tight tabular-nums">
                  {formatDuration(roadRoute.totalDurationSeconds, lang)}
                </span>
                <span className="text-base font-bold text-white/85 tabular-nums">
                  {formatDistance(roadRoute.totalDistanceMeters, lang)}
                </span>
              </div>
              <div className="text-xs font-semibold text-white/85 mt-0.5 tabular-nums">
                {etaIso ? `ETA ${formatMunichTime(etaIso, lang)} · ` : ''}
                {t.viaProvider}{' '}
                {roadRoute.provider === 'ors' ? 'OpenRouteService' : 'Valhalla OSM'}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLiveFollowActive(!liveFollowActive)}
              className={`inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-2xl text-sm font-extrabold transition-all active:scale-95 cursor-pointer shrink-0 shadow-md ${
                liveFollowActive
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : 'bg-white text-slate-950 hover:bg-slate-100'
              }`}
            >
              <Navigation className="w-4 h-4" />
              <span>{liveFollowActive ? t.liveFollowStop : t.liveFollowStart}</span>
            </button>
          </div>
        </div>

        {/* Turn-by-turn legs */}
        <div className="space-y-2.5">
          {roadRoute.legs.map((leg, legIdx) => {
            const fromName = filledWaypoints[legIdx]?.place?.name || `Stop ${legIdx + 1}`;
            const toName = filledWaypoints[legIdx + 1]?.place?.name || `Stop ${legIdx + 2}`;
            const isExpanded = expandedRoadLegs[legIdx] ?? roadRoute.legs.length === 1;

            return (
              <div
                key={legIdx}
                className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/80 overflow-hidden shadow-2xs"
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
                  className="w-full min-h-[48px] flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="text-[13px] font-extrabold text-slate-900 dark:text-white truncate">
                      {fromName} → {toName}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-500 shrink-0 tabular-nums">
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
                            if (typeof window !== 'undefined' && window.innerWidth < 768) {
                              setMobileSheetSnap('half');
                            }
                          }}
                          className="w-full min-h-[44px] flex items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[13px] hover:bg-sky-50/70 dark:hover:bg-sky-950/30 active:bg-sky-100/70 transition-colors cursor-pointer"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                            {m.instruction}
                          </span>
                          {m.distanceMeters > 0 && (
                            <span className="text-xs font-mono font-bold tabular-nums text-slate-400 shrink-0">
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

  // PLAYFUL EMPTY STATE
  return (
    <div className="p-4 rounded-2xl bg-gradient-to-b from-sky-50/90 to-white dark:from-slate-800/70 dark:to-slate-900/70 border-2 border-sky-100 dark:border-slate-800 space-y-3 text-center">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0065ae] to-[#00a984] flex items-center justify-center text-white shadow-md shadow-[#0065ae]/25">
        <Route className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-[15px] font-extrabold text-slate-900 dark:text-white tracking-tight">
          {t.emptyStateTitle}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {t.emptyStateDesc}
        </p>
      </div>
      <button
        type="button"
        onClick={loadDemoTrip}
        className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-[13px] font-extrabold bg-[#0065ae] hover:bg-[#005494] text-white shadow-md shadow-[#0065ae]/25 active:scale-[0.98] transition-all cursor-pointer"
      >
        <Sparkles className="w-4 h-4 shrink-0" />
        <span className="truncate">{t.demoTripBtn}</span>
      </button>
      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
        {t.mapClickHint}
      </p>
    </div>
  );
}
