'use client';

import { useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Flag,
  Footprints,
  Loader2,
  Navigation,
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

function CountdownStatus({ isoTime, nowMs }: { isoTime?: string; nowMs: number }) {
  const lang = useNavStore((s) => s.lang);
  const t = getTranslations(lang);
  if (!isoTime || nowMs === 0) return null;

  const diffMin = Math.round((new Date(isoTime).getTime() - nowMs) / 60000);
  if (diffMin < -2 || diffMin > 90) return null;

  const isNow = diffMin <= 0;
  return (
    <span
      className={`text-xs font-semibold tabular-nums ${
        isNow ? 'text-[#eb0000]' : 'text-[#007a3e] dark:text-[#34d399]'
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
    return <span className="text-[11px] font-semibold text-[#eb0000]">{t.cancelled}</span>;
  }
  if (!realTime) return null;
  if (delay >= 1) {
    return (
      <span className="text-[11px] font-semibold text-[#eb0000] tabular-nums">+{delay}&apos;</span>
    );
  }
  if (delay <= -1) {
    return (
      <span className="text-[11px] font-semibold text-[#007a3e] dark:text-[#34d399] tabular-nums">
        {delay}&apos;
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium text-[#007a3e] dark:text-[#34d399]">{t.onTime}</span>
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
        className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs transition-colors cursor-pointer ${
          isSelected
            ? 'bg-[#efefef] dark:bg-[#2c2c2c]'
            : 'hover:bg-[#f6f6f6] dark:hover:bg-[#262626]'
        }`}
      >
        <div className="w-11 text-xs font-mono tabular-nums text-[#686868] dark:text-[#999999] shrink-0">
          {formatMunichTime(segment.startTime, lang)}
        </div>
        <div className="w-4 flex justify-center shrink-0">
          <Footprints className="w-3.5 h-3.5 text-[#686868] dark:text-[#999999]" />
        </div>
        <div className="flex-1 min-w-0 text-[#444444] dark:text-[#cccccc]">
          <span className="font-medium">{t.walkSegment}</span>
          <span className="text-[#767676] dark:text-[#888888]">
            {' '}
            · {formatDuration(segment.durationSeconds, lang)}
            {segment.distanceMeters ? ` (${formatDistance(segment.distanceMeters, lang)})` : ''}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isSelected
          ? 'border-[#111111] dark:border-white bg-[#fafafa] dark:bg-[#262626]'
          : 'border-[#e5e5e5] dark:border-[#333333] bg-white dark:bg-[#212121] hover:border-[#bdbdbd] dark:hover:border-[#4a4a4a]'
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
          {/* Swiss Timetable Clock Column */}
          <div className="w-11 shrink-0 leading-tight space-y-0.5">
            <div className="text-[13px] font-bold font-mono tabular-nums text-[#111111] dark:text-white">
              {formatMunichTime(segment.startTime, lang)}
            </div>
            <DelayTag
              delay={segment.startDelayMinutes}
              realTime={segment.realTime}
              cancelled={segment.cancelled}
            />
          </div>

          {/* Crisp MVV Vertical Line Spine */}
          <div className="flex flex-col items-center self-stretch pt-1 shrink-0">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: style.bg }}
            />
            <span
              className="w-[3px] flex-1 my-1 min-h-[30px]"
              style={{ backgroundColor: style.bg }}
            />
            <span
              className="w-2.5 h-2.5 rounded-full border-2 bg-white dark:bg-[#212121] shrink-0"
              style={{ borderColor: style.bg }}
            />
          </div>

          {/* Station, Platform Box & Direction */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-[#111111] dark:text-white truncate">
                {segment.fromName}
              </span>
              {segment.fromTrack && (
                <span className="text-[11px] font-medium px-1.5 py-[1px] rounded-[3px] border border-[#cccccc] dark:border-[#4a4a4a] text-[#212121] dark:text-[#e5e5e5] shrink-0 tabular-nums">
                  {t.platform} {segment.fromTrack}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <LineBadge
                mode={segment.mode}
                line={segment.routeShortName}
                color={segment.routeColor}
                textColor={segment.routeTextColor}
                size="sm"
              />
              {segment.headsign && (
                <span className="text-xs text-[#444444] dark:text-[#cccccc] truncate">
                  {segment.headsign}
                </span>
              )}
              <span className="text-[11px] text-[#767676] ml-auto shrink-0 tabular-nums">
                {formatDuration(segment.durationSeconds, lang)}
              </span>
            </div>

            {segment.intermediateStops.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStops((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 py-0.5 text-xs font-medium text-[#686868] hover:text-[#111111] dark:text-[#999999] dark:hover:text-white cursor-pointer"
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
                  <ul className="mt-1.5 pl-2.5 border-l border-[#dcdcdc] dark:border-[#383838] space-y-1">
                    {segment.intermediateStops.map((st, idx) => (
                      <li
                        key={`${st.name}-${idx}`}
                        className="flex items-center justify-between gap-2 text-xs text-[#686868] dark:text-[#999999]"
                      >
                        <span className="truncate">{st.name}</span>
                        <span className="font-mono text-[11px] tabular-nums shrink-0">
                          {formatMunichTime(st.departure || st.arrival, lang)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[13px] font-semibold text-[#111111] dark:text-white truncate">
                {segment.toName}
              </span>
              <span className="text-[13px] font-bold font-mono tabular-nums text-[#111111] dark:text-white shrink-0">
                {formatMunichTime(segment.endTime, lang)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RouteResultsProps {
  hideSummaryCard?: boolean;
}

export function RouteResults({ hideSummaryCard = false }: RouteResultsProps = {}) {
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
      <div className="py-10 flex flex-col items-center justify-center gap-2.5 text-[#686868] dark:text-[#999999]">
        <Loader2 className="w-5 h-5 animate-spin text-[#eb0000]" />
        <span className="text-xs font-medium">{t.calculating}</span>
      </div>
    );
  }

  if (routeError) {
    return (
      <div className="p-3.5 rounded-lg bg-white dark:bg-[#212121] border border-[#eb0000]/40 flex items-start gap-2.5 text-xs text-[#eb0000]">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">{t.routeError}</div>
          <div className="text-[#444444] dark:text-[#cccccc] mt-0.5">{routeError}</div>
        </div>
      </div>
    );
  }

  // PUBLIC TRANSPORT RESULTS (SBB Mobile Timetable Aesthetic)
  if (mode === 'transit' && transitPlan) {
    const firstLeg = transitPlan.legs[0];
    const lastLeg = transitPlan.legs[transitPlan.legs.length - 1];
    const firstItin = firstLeg?.alternatives[firstLeg.selectedIndex];
    const lastItin = lastLeg?.alternatives[lastLeg.selectedIndex];

    return (
      <div className="space-y-3">
        {/* Flat SBB Timetable Summary Card (shown on desktop; mobile uses sticky sheet header) */}
        {!hideSummaryCard && (
          <div className="p-3.5 rounded-lg bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333]">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl font-bold tracking-tight text-[#111111] dark:text-white tabular-nums">
                    {formatDuration(transitPlan.totalDurationSeconds, lang)}
                  </span>
                  {firstItin && lastItin && (
                    <span className="text-sm font-mono font-semibold tabular-nums text-[#444444] dark:text-[#cccccc]">
                      {formatMunichTime(firstItin.startTime, lang)} –{' '}
                      {formatMunichTime(lastItin.endTime, lang)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 text-xs text-[#686868] dark:text-[#999999] flex-wrap">
                  {transitPlan.arriveBy && transitPlan.targetTime ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-[#111111] dark:text-white tabular-nums">
                      <Flag className="w-3 h-3 text-[#eb0000]" />
                      {t.arriveByBadge} {formatMunichTime(transitPlan.targetTime, lang)}
                    </span>
                  ) : (
                    <CountdownStatus isoTime={firstItin?.startTime} nowMs={nowMs} />
                  )}
                  <span>
                    {t.travelTime}: {formatDuration(transitPlan.totalTravelSeconds, lang)}
                  </span>
                  {transitPlan.totalDwellSeconds > 0 && (
                    <span>
                      · {t.stayTime}: {formatDuration(transitPlan.totalDwellSeconds, lang)}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLiveFollowActive(!liveFollowActive)}
                className={`inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  liveFollowActive
                    ? 'bg-[#212121] hover:bg-black text-white dark:bg-white dark:text-[#111111]'
                    : 'bg-[#eb0000] hover:bg-[#c60018] text-white'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{liveFollowActive ? t.liveFollowStop : t.liveFollowStart}</span>
              </button>
            </div>
          </div>
        )}

        {/* Chained Legs */}
        <div className="space-y-3">
          {transitPlan.legs.map((leg) => {
            const chosen = leg.alternatives[leg.selectedIndex];
            const isMultiLeg = transitPlan.legs.length > 1;
            const nextLeg = transitPlan.legs[leg.legIndex + 1];
            const nextChosen = nextLeg?.alternatives[nextLeg.selectedIndex];

            return (
              <div key={leg.legIndex} className="space-y-2.5">
                <div className="rounded-lg border border-[#dcdcdc] dark:border-[#333333] bg-white dark:bg-[#212121] p-3 space-y-2.5">
                  {/* Leg Header */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#ececec] dark:border-[#2e2e2e]">
                    <div className="flex items-center gap-2 min-w-0">
                      {isMultiLeg && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#686868] dark:text-[#999999] shrink-0">
                          {t.leg} {leg.legIndex + 1}
                        </span>
                      )}
                      <span className="text-[13px] font-semibold text-[#111111] dark:text-white truncate">
                        {leg.fromLabel} → {leg.toLabel}
                      </span>
                    </div>
                    {chosen && (
                      <span className="text-xs font-medium text-[#686868] dark:text-[#999999] shrink-0 tabular-nums">
                        {formatDuration(chosen.durationSeconds, lang)}
                      </span>
                    )}
                  </div>

                  {/* SBB Horizontal Connection Timeline Alternatives */}
                  {leg.alternatives.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      {leg.alternatives.map((alt, altIdx) => {
                        const isPicked = altIdx === leg.selectedIndex;
                        const transitSegs = alt.segments.filter((s) => s.mode !== 'WALK');
                        return (
                          <button
                            key={alt.id}
                            type="button"
                            onClick={() => selectTransitAlternative(leg.legIndex, altIdx)}
                            className={`flex flex-col gap-1.5 px-2.5 py-2 rounded-md border text-left transition-colors shrink-0 min-w-[144px] cursor-pointer ${
                              isPicked
                                ? 'bg-[#f6f6f6] dark:bg-[#2b2b2b] border-[#111111] dark:border-white'
                                : 'bg-white dark:bg-[#212121] border-[#e5e5e5] dark:border-[#333333] hover:border-[#bdbdbd] opacity-80 hover:opacity-100'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 w-full">
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
                              <span className="text-[11px] font-medium text-[#686868] dark:text-[#999999] tabular-nums">
                                {formatDuration(alt.durationSeconds, lang)}
                              </span>
                            </div>

                            {/* Signature SBB horizontal timeline bar */}
                            <div className="flex items-center gap-1.5 w-full text-xs font-mono font-semibold tabular-nums text-[#111111] dark:text-white">
                              <span>{formatMunichTime(alt.startTime, lang)}</span>
                              <span className="flex-1 flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#111111] dark:bg-white shrink-0" />
                                <span className="h-[1.5px] flex-1 bg-[#111111] dark:bg-white" />
                                <span className="w-1.5 h-1.5 rounded-full bg-[#111111] dark:bg-white shrink-0" />
                              </span>
                              <span>{formatMunichTime(alt.endTime, lang)}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Selected Itinerary Timetable Segments */}
                  {chosen ? (
                    <div className="space-y-1.5">
                      {chosen.segments.map((seg) => (
                        <TransitSegmentRow key={seg.id} segment={seg} />
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-md bg-[#f6f6f6] dark:bg-[#2a2a2a] text-xs text-[#444444] dark:text-[#cccccc]">
                      {leg.error || t.noTransitFound}
                    </div>
                  )}
                </div>

                {/* Calm Swiss Architectural Stay Divider */}
                {leg.legIndex < transitPlan.legs.length - 1 && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] border-l-[3px] border-l-[#111111] dark:border-l-white text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-[#686868] dark:text-[#999999] shrink-0" />
                      <span className="truncate text-[#111111] dark:text-white">
                        <strong className="font-semibold">
                          {t.dwellLabel} {leg.dwellAfterMinutes} {t.dwellMinutes}
                        </strong>{' '}
                        <span className="text-[#686868] dark:text-[#999999]">· {leg.toLabel}</span>
                      </span>
                    </div>
                    {nextChosen && (
                      <span className="font-mono font-semibold tabular-nums text-[#111111] dark:text-white shrink-0">
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

  // ROAD ROUTE RESULTS (FOOT / BIKE / CAR) — Clean SBB Style
  if (mode !== 'transit' && roadRoute) {
    const filledWaypoints = waypoints.filter((w) => w.place !== null);
    const baseMs = roadRoute.calculatedAt ? new Date(roadRoute.calculatedAt).getTime() : 0;
    const etaIso =
      baseMs > 0
        ? new Date(baseMs + roadRoute.totalDurationSeconds * 1000).toISOString()
        : undefined;

    return (
      <div className="space-y-3">
        {!hideSummaryCard && (
          <div className="p-3.5 rounded-lg bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-xl font-bold tracking-tight text-[#111111] dark:text-white tabular-nums">
                    {formatDuration(roadRoute.totalDurationSeconds, lang)}
                  </span>
                  <span className="text-sm font-medium text-[#686868] dark:text-[#999999] tabular-nums">
                    {formatDistance(roadRoute.totalDistanceMeters, lang)}
                  </span>
                </div>
                <div className="text-xs text-[#686868] dark:text-[#999999] mt-0.5 tabular-nums">
                  {etaIso ? `ETA ${formatMunichTime(etaIso, lang)} · ` : ''}
                  {t.viaProvider}{' '}
                  {roadRoute.provider === 'ors' ? 'OpenRouteService' : 'Valhalla OSM'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLiveFollowActive(!liveFollowActive)}
                className={`inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  liveFollowActive
                    ? 'bg-[#212121] hover:bg-black text-white dark:bg-white dark:text-[#111111]'
                    : 'bg-[#eb0000] hover:bg-[#c60018] text-white'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{liveFollowActive ? t.liveFollowStop : t.liveFollowStart}</span>
              </button>
            </div>
          </div>
        )}

        {/* Turn-by-turn legs */}
        <div className="space-y-2">
          {roadRoute.legs.map((leg, legIdx) => {
            const fromName = filledWaypoints[legIdx]?.place?.name || `Stop ${legIdx + 1}`;
            const toName = filledWaypoints[legIdx + 1]?.place?.name || `Stop ${legIdx + 2}`;
            const isExpanded = expandedRoadLegs[legIdx] ?? roadRoute.legs.length === 1;

            return (
              <div
                key={legIdx}
                className="rounded-lg border border-[#dcdcdc] dark:border-[#333333] bg-white dark:bg-[#212121] overflow-hidden"
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
                  className="w-full min-h-[44px] flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[#f6f6f6] dark:hover:bg-[#282828] cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-[#686868] shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#686868] shrink-0" />
                    )}
                    <span className="text-[13px] font-semibold text-[#111111] dark:text-white truncate">
                      {fromName} → {toName}
                    </span>
                  </div>
                  <span className="text-xs text-[#686868] dark:text-[#999999] shrink-0 tabular-nums">
                    {formatDuration(leg.durationSeconds, lang)} ·{' '}
                    {formatDistance(leg.distanceMeters, lang)}
                  </span>
                </button>

                {isExpanded && (
                  <ol className="divide-y divide-[#ececec] dark:divide-[#2e2e2e] border-t border-[#ececec] dark:border-[#2e2e2e]">
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
                          className="w-full min-h-[42px] flex items-center justify-between gap-3 px-3.5 py-2 text-left text-[13px] hover:bg-[#f6f6f6] dark:hover:bg-[#282828] transition-colors cursor-pointer"
                        >
                          <span className="text-[#212121] dark:text-[#e5e5e5] leading-snug">
                            {m.instruction}
                          </span>
                          {m.distanceMeters > 0 && (
                            <span className="text-xs font-mono tabular-nums text-[#767676] shrink-0">
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

  // Mobile active-trip view handles empty/partial state directly via the From/To card
  if (hideSummaryCard) return null;

  // RESTRAINED SBB EMPTY STATE (Zero gradient icon boxes, zero sparkle icons!)
  return (
    <div className="p-4 rounded-lg bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-[#111111] dark:text-white tracking-tight">
          {t.emptyStateTitle}
        </h2>
        <p className="text-xs text-[#686868] dark:text-[#999999] leading-relaxed">
          {t.emptyStateDesc}
        </p>
      </div>
      <button
        type="button"
        onClick={loadDemoTrip}
        className="w-full h-10 inline-flex items-center justify-center px-3.5 rounded-lg text-xs font-semibold bg-[#eb0000] hover:bg-[#c60018] active:bg-[#a80014] text-white transition-colors cursor-pointer"
      >
        <span className="truncate">{t.demoTripBtn}</span>
      </button>
      <p className="text-[11px] text-[#767676] dark:text-[#888888]">{t.mapClickHint}</p>
    </div>
  );
}
