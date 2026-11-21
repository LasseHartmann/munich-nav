'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Clock,
  Flag,
  Loader2,
  MapPin,
  Moon,
  Navigation,
  Route,
  Search,
  Star,
  Sun,
  TrainFront,
  X,
} from 'lucide-react';
import {
  formatDistance,
  formatDuration,
  formatMunichTime,
  MUNICH_QUICK_PLACES,
} from '@/lib/geo';
import { getTranslations } from '@/lib/i18n';
import { useNowTick } from '@/lib/useNowTick';
import { useNavStore, type MobileSheetSnap } from '@/store/useNavStore';
import type { PlaceResult } from '@/lib/types';
import { StationPopup } from '@/components/map/StationPopup';
import { MapClickCard } from '@/components/map/MapClickCard';
import { ModeSelector } from './ModeSelector';
import { StopList } from './StopList';
import { TransitOptionsBar } from './TransitOptionsBar';
import { WalkOptionsBar } from './WalkOptionsBar';
import { RouteResults } from './RouteResults';

const SNAP_ORDER: MobileSheetSnap[] = ['peek', 'half', 'full'];

const SNAP_HEIGHTS_VH: Record<MobileSheetSnap, number> = {
  peek: 16,
  half: 52,
  full: 91,
};

const IDLE_PEEK_PX = 134;
const ROUTE_PEEK_PX = 98;
const DETAIL_PEEK_PX = 158;

function ModeSquareBadges({ modes }: { modes?: string[] }) {
  if (!modes || modes.length === 0) return null;
  const set = new Set(modes.map((m) => m.toUpperCase()));
  const chips: { label: string; bg: string }[] = [];
  if (set.has('SUBWAY') || set.has('METRO')) chips.push({ label: 'U', bg: '#0065ae' });
  if (set.has('SUBURBAN')) chips.push({ label: 'S', bg: '#008e4e' });
  if (set.has('TRAM')) chips.push({ label: 'T', bg: '#e30613' });
  if (set.has('BUS')) chips.push({ label: 'B', bg: '#00586a' });
  if (set.has('REGIONAL_RAIL') || set.has('REGIONAL_FAST_RAIL')) {
    chips.push({ label: 'R', bg: '#1e3a8a' });
  }
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      {chips.slice(0, 4).map((c) => (
        <span
          key={c.label}
          style={{ backgroundColor: c.bg }}
          className="text-[10px] font-bold text-white w-4.5 h-4.5 rounded-[3px] inline-flex items-center justify-center leading-none"
        >
          {c.label}
        </span>
      ))}
    </span>
  );
}

export function MobileBottomSheet() {
  const snap = useNavStore((s) => s.mobileSheetSnap);
  const setSnap = useNavStore((s) => s.setMobileSheetSnap);
  const mode = useNavStore((s) => s.mode);
  const lang = useNavStore((s) => s.lang);
  const setLang = useNavStore((s) => s.setLang);
  const theme = useNavStore((s) => s.theme);
  const toggleTheme = useNavStore((s) => s.toggleTheme);
  const waypoints = useNavStore((s) => s.waypoints);
  const roadRoute = useNavStore((s) => s.roadRoute);
  const transitPlan = useNavStore((s) => s.transitPlan);
  const isRouting = useNavStore((s) => s.isRouting);
  const isLocatingStart = useNavStore((s) => s.isLocatingStart);
  const routeError = useNavStore((s) => s.routeError);
  const selectedStation = useNavStore((s) => s.selectedStation);
  const mapClickPin = useNavStore((s) => s.mapClickPin);
  const favorites = useNavStore((s) => s.favorites);
  const recents = useNavStore((s) => s.recents);
  const liveFollowActive = useNavStore((s) => s.liveFollowActive);
  const setLiveFollowActive = useNavStore((s) => s.setLiveFollowActive);
  const openMobileSearch = useNavStore((s) => s.openMobileSearch);
  const quickRouteToDestination = useNavStore((s) => s.quickRouteToDestination);
  const loadDemoTrip = useNavStore((s) => s.loadDemoTrip);
  const clearRoute = useNavStore((s) => s.clearRoute);

  const nowMs = useNowTick();
  const t = getTranslations(lang);

  const hasRoute = Boolean((mode === 'transit' && transitPlan) || (mode !== 'transit' && roadRoute));
  const filledCount = waypoints.filter((w) => w.place !== null).length;
  const showingStation = Boolean(selectedStation);
  const showingPin = !showingStation && Boolean(mapClickPin);
  const inTripMode =
    !showingStation &&
    !showingPin &&
    (hasRoute || isRouting || isLocatingStart || Boolean(routeError) || filledCount > 0);

  const peekBasePx =
    showingStation || showingPin
      ? DETAIL_PEEK_PX
      : inTripMode
        ? ROUTE_PEEK_PX
        : IDLE_PEEK_PX;

  const getSnapHeightPx = (s: MobileSheetSnap, vh: number): number => {
    if (s === 'peek') return peekBasePx;
    return Math.round((vh * SNAP_HEIGHTS_VH[s]) / 100);
  };

  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transitPlan || roadRoute) {
      scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [transitPlan, roadRoute]);

  // Quick chips for the idle resting peek state (Saved -> Recent -> Popular Munich fallback)
  const quickChips = useMemo(() => {
    const out: { place: PlaceResult; source: 'fav' | 'recent' | 'popular' }[] = [];
    const seen = new Set<string>();
    const add = (place: PlaceResult, source: 'fav' | 'recent' | 'popular') => {
      const key = `${place.lat.toFixed(3)},${place.lon.toFixed(3)}`;
      if (seen.has(key) || out.length >= 6) return;
      seen.add(key);
      out.push({ place, source });
    };
    favorites.slice(0, 4).forEach((p) => add(p, 'fav'));
    recents.slice(0, 4).forEach((p) => add(p, 'recent'));
    MUNICH_QUICK_PLACES.forEach((p) => add(p, 'popular'));
    return out;
  }, [favorites, recents]);

  // Pure drag-only bottom sheet state with momentum-projected snapping (tapping/pressing does nothing)
  const [dragHeightPx, setDragHeightPx] = useState<number | null>(null);
  const [springDurationMs, setSpringDurationMs] = useState(360);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startHeightPx: number;
    currentHeightPx: number;
    moved: boolean;
    samples: { y: number; t: number }[];
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input, a, select, textarea')) return;

    const vh = window.innerHeight || 844;
    const measuredHeight =
      sheetRef.current?.getBoundingClientRect().height ?? getSnapHeightPx(snap, vh);
    const now = performance.now();

    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeightPx: measuredHeight,
      currentHeightPx: measuredHeight,
      moved: false,
      samples: [{ y: e.clientY, t: now }],
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Safe ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;

    const dy = d.startY - e.clientY;
    if (!d.moved && Math.abs(dy) < 3) return;
    d.moved = true;

    const now = performance.now();
    d.samples.push({ y: e.clientY, t: now });
    while (d.samples.length > 2 && now - d.samples[0].t > 110) {
      d.samples.shift();
    }

    const vh = window.innerHeight || 844;
    const minPx = Math.max(84, peekBasePx - 20);
    const maxPx = Math.round(vh * 0.94);
    const nextPx = Math.min(maxPx, Math.max(minPx, d.startHeightPx + dy));

    d.currentHeightPx = nextPx;
    setDragHeightPx(nextPx);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Safe ignore
    }

    if (!d.moved) {
      setDragHeightPx(null);
      return;
    }

    const vh = window.innerHeight || 844;
    const finalPx = d.currentHeightPx;
    const now = performance.now();

    let velocityPxPerMs = 0;
    const latest = d.samples[d.samples.length - 1];
    if (latest && now - latest.t <= 90 && d.samples.length >= 2) {
      const oldest = d.samples[0];
      const dt = Math.max(16, latest.t - oldest.t);
      velocityPxPerMs = (oldest.y - latest.y) / dt;
    }

    const minPx = getSnapHeightPx('peek', vh);
    const maxPx = getSnapHeightPx('full', vh);
    const projectedPx = Math.min(maxPx, Math.max(minPx, finalPx + velocityPxPerMs * 220));

    let closestSnap: MobileSheetSnap = snap;
    let smallestDist = Infinity;
    for (const candidate of SNAP_ORDER) {
      const dist = Math.abs(projectedPx - getSnapHeightPx(candidate, vh));
      if (dist < smallestDist) {
        smallestDist = dist;
        closestSnap = candidate;
      }
    }

    const dynamicMs = Math.max(240, Math.min(390, Math.round(375 - Math.abs(velocityPxPerMs) * 65)));
    setSpringDurationMs(dynamicMs);
    setDragHeightPx(null);
    setSnap(closestSnap);
  };

  const isDragging = dragHeightPx !== null;

  const sheetStyle: React.CSSProperties = isDragging
    ? { height: `${Math.round(dragHeightPx)}px`, transition: 'none' }
    : {
        height:
          snap === 'peek'
            ? `calc(${peekBasePx}px + env(safe-area-inset-bottom))`
            : `${SNAP_HEIGHTS_VH[snap]}dvh`,
        transition: `height ${springDurationMs}ms cubic-bezier(0.34, 1.16, 0.64, 1)`,
      };

  const showBodyContent = snap !== 'peek' || (isDragging && dragHeightPx > peekBasePx + 38);

  const destWp = waypoints[waypoints.length - 1];
  const firstTransit = transitPlan?.legs[0]?.alternatives[transitPlan.legs[0].selectedIndex];
  const lastTransit =
    transitPlan?.legs[transitPlan.legs.length - 1]?.alternatives[
      transitPlan.legs[transitPlan.legs.length - 1].selectedIndex
    ];
  const transitDiffMin =
    firstTransit?.startTime && nowMs > 0
      ? Math.round((new Date(firstTransit.startTime).getTime() - nowMs) / 60000)
      : null;

  const roadEtaIso =
    roadRoute?.calculatedAt
      ? new Date(
          new Date(roadRoute.calculatedAt).getTime() + roadRoute.totalDurationSeconds * 1000
        ).toISOString()
      : undefined;

  return (
    <div
      ref={sheetRef}
      style={sheetStyle}
      data-testid="mobile-bottom-sheet"
      className="md:hidden fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl bg-[#f6f6f6] dark:bg-[#151515] border-t border-[#d4d4d4] dark:border-[#333333] shadow-[0_-6px_28px_rgba(0,0,0,0.16)] overflow-hidden will-change-[height]"
    >
      {/* Pure Drag-Only SBB Sticky Header */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`touch-none select-none shrink-0 bg-white dark:bg-[#1e1e1e] ${
          showBodyContent && !showingStation && !showingPin
            ? 'border-b border-[#e5e5e5] dark:border-[#303030]'
            : ''
        }`}
      >
        {/* Pull Handle */}
        <div
          data-testid="sheet-pull-tab"
          aria-label="Drag to resize bottom sheet"
          className="w-full pt-2.5 pb-2 flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          <span
            className={`h-1 rounded-full transition-all duration-150 ${
              isDragging
                ? 'w-14 bg-[#111111] dark:bg-white'
                : 'w-10 bg-[#cccccc] dark:bg-[#525252]'
            }`}
          />
        </div>

        {/* IDLE STICKY HEADER: Action-First "Where to?" + Quick Chips */}
        {!showingStation && !showingPin && !inTripMode && (
          <div className="px-3.5 pb-3 space-y-2">
            <button
              type="button"
              data-testid="where-to-trigger"
              onClick={() => destWp && openMobileSearch(destWp.uid)}
              className="w-full h-11 px-3.5 rounded-xl bg-[#f4f4f4] hover:bg-[#ececec] dark:bg-[#2a2a2a] dark:hover:bg-[#333333] border border-[#dcdcdc] dark:border-[#3c3c3c] flex items-center gap-2.5 text-left transition-colors cursor-pointer"
            >
              <Search className="w-4.5 h-4.5 text-[#eb0000] shrink-0" />
              <span className="text-[15px] font-medium text-[#555555] dark:text-[#cccccc] truncate">
                {t.whereTo}
              </span>
            </button>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {quickChips.map(({ place, source }) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => void quickRouteToDestination(place)}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-white dark:bg-[#252525] border border-[#dcdcdc] dark:border-[#3a3a3a] active:bg-[#f2f2f2] dark:active:bg-[#303030] text-xs font-medium text-[#111111] dark:text-[#f2f2f2] shrink-0 max-w-[165px] cursor-pointer"
                >
                  {source === 'fav' ? (
                    <Star className="w-3 h-3 text-[#111111] dark:text-white fill-current shrink-0" />
                  ) : source === 'recent' ? (
                    <Clock className="w-3 h-3 text-[#686868] dark:text-[#999999] shrink-0" />
                  ) : place.category === 'station' ? (
                    <TrainFront className="w-3 h-3 text-[#686868] dark:text-[#999999] shrink-0" />
                  ) : (
                    <MapPin className="w-3 h-3 text-[#686868] dark:text-[#999999] shrink-0" />
                  )}
                  <span className="truncate">{place.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ACTIVE TRIP STICKY HEADER: Compact Route Summary + Red GO + Close (×) */}
        {inTripMode && (
          <div className="px-4 pb-3 pt-0.5 flex items-center justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              {isLocatingStart ? (
                <div className="flex items-center gap-2 min-w-0">
                  <Loader2 className="w-4 h-4 animate-spin text-[#eb0000] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#111111] dark:text-white truncate">
                      {t.locatingStart}
                    </div>
                    {destWp?.place && (
                      <div className="text-xs text-[#686868] dark:text-[#999999] truncate">
                        → {destWp.place.name}
                      </div>
                    )}
                  </div>
                </div>
              ) : isRouting ? (
                <div className="flex items-center gap-2 min-w-0">
                  <Loader2 className="w-4 h-4 animate-spin text-[#eb0000] shrink-0" />
                  <span className="text-sm font-semibold text-[#111111] dark:text-white truncate">
                    {t.calculating}
                  </span>
                </div>
              ) : hasRoute && mode === 'transit' && transitPlan ? (
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-lg font-bold tracking-tight text-[#111111] dark:text-white tabular-nums shrink-0">
                      {formatDuration(transitPlan.totalDurationSeconds, lang)}
                    </span>
                    {firstTransit && lastTransit && (
                      <span className="text-xs font-mono font-semibold text-[#555555] dark:text-[#cccccc] tabular-nums truncate">
                        {formatMunichTime(firstTransit.startTime, lang)} –{' '}
                        {formatMunichTime(lastTransit.endTime, lang)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#686868] dark:text-[#999999] truncate tabular-nums">
                    {transitPlan.arriveBy && transitPlan.targetTime ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-[#111111] dark:text-white shrink-0">
                        <Flag className="w-3 h-3 text-[#eb0000]" />
                        {t.arriveByBadge} {formatMunichTime(transitPlan.targetTime, lang)}
                      </span>
                    ) : transitDiffMin !== null && transitDiffMin >= -2 && transitDiffMin <= 90 ? (
                      <span
                        className={`font-semibold shrink-0 ${
                          transitDiffMin <= 0
                            ? 'text-[#eb0000]'
                            : 'text-[#007a3e] dark:text-[#34d399]'
                        }`}
                      >
                        {transitDiffMin <= 0 ? t.leavingNow : `${t.leaveIn} ${transitDiffMin} min`}
                      </span>
                    ) : null}
                    {transitPlan.totalDwellSeconds > 0 && (
                      <span className="truncate">
                        · {t.stayTime}: {formatDuration(transitPlan.totalDwellSeconds, lang)}
                      </span>
                    )}
                  </div>
                </div>
              ) : hasRoute && mode !== 'transit' && roadRoute ? (
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-lg font-bold tracking-tight text-[#111111] dark:text-white tabular-nums shrink-0">
                      {formatDuration(roadRoute.totalDurationSeconds, lang)}
                    </span>
                    <span className="text-xs font-medium text-[#686868] dark:text-[#999999] tabular-nums shrink-0">
                      · {formatDistance(roadRoute.totalDistanceMeters, lang)}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#686868] dark:text-[#999999] truncate tabular-nums">
                    {roadEtaIso ? `ETA ${formatMunichTime(roadEtaIso, lang)}` : ''}
                    {destWp?.place ? ` · ${destWp.place.name}` : ''}
                  </div>
                </div>
              ) : routeError ? (
                <div className="text-xs font-semibold text-[#eb0000] truncate">{t.routeError}</div>
              ) : (
                <div className="space-y-0.5 min-w-0">
                  <div className="text-sm font-semibold text-[#111111] dark:text-white truncate">
                    {waypoints[0]?.place ? t.whereTo : t.chooseStart}
                  </div>
                  {destWp?.place && (
                    <div className="text-xs text-[#686868] dark:text-[#999999] truncate">
                      → {destWp.place.name}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {hasRoute && !isRouting && !isLocatingStart && (
                <button
                  type="button"
                  onClick={() => setLiveFollowActive(!liveFollowActive)}
                  className="h-9 px-3.5 rounded-lg text-xs font-semibold bg-[#eb0000] hover:bg-[#c60018] active:bg-[#a80014] text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{t.liveFollowStart}</span>
                </button>
              )}

              <button
                type="button"
                data-testid="close-route-btn"
                onClick={clearRoute}
                aria-label={t.clearRoute}
                title={t.clearRoute}
                className="w-9 h-9 rounded-lg border border-[#dcdcdc] dark:border-[#383838] bg-[#f6f6f6] hover:bg-[#ebebeb] dark:bg-[#2a2a2a] dark:hover:bg-[#333333] text-[#444444] dark:text-[#d4d4d4] inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SHEET BODY */}
      {showingStation ? (
        <StationPopup variant="sheet" />
      ) : showingPin ? (
        <MapClickCard variant="sheet" />
      ) : !showBodyContent ? null : !inTripMode ? (
        /* IDLE EXPANDED BODY: Saved -> Recent -> Popular -> Demo -> Settings */
        <div
          ref={scrollBodyRef}
          className="flex-1 overflow-y-auto px-3.5 pt-3 pb-safe-lg space-y-4"
        >
          {favorites.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[#686868] dark:text-[#999999]">
                {t.favorites}
              </h3>
              <div className="rounded-xl bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] divide-y divide-[#ececec] dark:divide-[#2e2e2e] overflow-hidden">
                {favorites.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void quickRouteToDestination(p)}
                    className="w-full min-h-[48px] flex items-center gap-3 px-3.5 py-2 text-left active:bg-[#f6f6f6] dark:active:bg-[#2a2a2a] cursor-pointer"
                  >
                    <Star className="w-4 h-4 text-[#111111] dark:text-white fill-current shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[#111111] dark:text-white truncate">
                        {p.name}
                      </div>
                      {p.subtitle && (
                        <div className="text-xs text-[#686868] dark:text-[#999999] truncate">
                          {p.subtitle}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {recents.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[#686868] dark:text-[#999999]">
                {t.recent}
              </h3>
              <div className="rounded-xl bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] divide-y divide-[#ececec] dark:divide-[#2e2e2e] overflow-hidden">
                {recents.slice(0, 5).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void quickRouteToDestination(p)}
                    className="w-full min-h-[48px] flex items-center gap-3 px-3.5 py-2 text-left active:bg-[#f6f6f6] dark:active:bg-[#2a2a2a] cursor-pointer"
                  >
                    <Clock className="w-4 h-4 text-[#767676] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[#111111] dark:text-white truncate">
                        {p.name}
                      </div>
                      {p.subtitle && (
                        <div className="text-xs text-[#686868] dark:text-[#999999] truncate">
                          {p.subtitle}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-1.5">
            <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[#686868] dark:text-[#999999]">
              {t.quickPlaces}
            </h3>
            <div className="rounded-xl bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] divide-y divide-[#ececec] dark:divide-[#2e2e2e] overflow-hidden">
              {MUNICH_QUICK_PLACES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void quickRouteToDestination(p)}
                  className="w-full min-h-[50px] flex items-center gap-3 px-3.5 py-2 text-left active:bg-[#f6f6f6] dark:active:bg-[#2a2a2a] cursor-pointer"
                >
                  {p.category === 'station' ? (
                    <TrainFront className="w-4 h-4 text-[#444444] dark:text-[#b7b7b7] shrink-0" />
                  ) : (
                    <MapPin className="w-4 h-4 text-[#767676] shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[#111111] dark:text-white truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-[#686868] dark:text-[#999999] truncate">
                      {p.subtitle}
                    </div>
                  </div>
                  <ModeSquareBadges modes={p.transitModes} />
                </button>
              ))}
            </div>
          </section>

          {/* Compact Multi-Stop Demo Trigger */}
          <button
            type="button"
            data-testid="mobile-demo-trip-btn"
            onClick={loadDemoTrip}
            className="w-full rounded-xl bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] px-3.5 py-3 flex items-center justify-between gap-3 text-left active:bg-[#f6f6f6] dark:active:bg-[#2a2a2a] cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Route className="w-4 h-4 text-[#eb0000] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#111111] dark:text-white">
                  {t.demoShort}
                </div>
                <div className="text-[11px] text-[#686868] dark:text-[#999999] truncate">
                  {t.demoRouteSub}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#999999] shrink-0" />
          </button>

          {/* Flat SBB Settings Section (Language + Appearance) */}
          <section className="space-y-1.5">
            <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[#686868] dark:text-[#999999]">
              {t.settings}
            </h3>
            <div className="rounded-xl bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] divide-y divide-[#ececec] dark:divide-[#2e2e2e] overflow-hidden">
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-[#111111] dark:text-white">
                  {t.language}
                </span>
                <div className="inline-flex p-0.5 rounded-md bg-[#ececec] dark:bg-[#2c2c2c]">
                  {(['en', 'de'] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLang(code)}
                      className={`h-7 px-3 rounded-[5px] text-xs font-semibold uppercase transition-colors cursor-pointer ${
                        lang === code
                          ? 'bg-white dark:bg-[#151515] text-[#111111] dark:text-white shadow-2xs'
                          : 'text-[#686868] dark:text-[#999999]'
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-[#111111] dark:text-white">
                  {t.appearance}
                </span>
                <div className="inline-flex p-0.5 rounded-md bg-[#ececec] dark:bg-[#2c2c2c]">
                  <button
                    type="button"
                    onClick={() => theme === 'dark' && toggleTheme()}
                    className={`h-7 px-2.5 rounded-[5px] text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer ${
                      theme === 'light'
                        ? 'bg-white text-[#111111] font-semibold shadow-2xs'
                        : 'text-[#999999]'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>{t.lightMode}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => theme === 'light' && toggleTheme()}
                    className={`h-7 px-2.5 rounded-[5px] text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-[#151515] text-white font-semibold shadow-2xs'
                        : 'text-[#686868]'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>{t.darkMode}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-1 pb-2 flex items-center justify-center gap-1.5 text-[11px] text-[#888888]">
              <span aria-hidden="true" className="w-[2.5px] h-3 bg-[#eb0000] rounded-xs" />
              <span className="font-semibold text-[#555555] dark:text-[#aaaaaa]">{t.appName}</span>
              <span>· München</span>
            </div>
          </section>
        </div>
      ) : (
        /* ACTIVE TRIP EXPANDED BODY: Mode Tabs -> Clean From/To Card -> Single Options Strip -> Results */
        <div ref={scrollBodyRef} className="flex-1 overflow-y-auto pb-safe-lg">
          <div className="bg-white dark:bg-[#1e1e1e] sticky top-0 z-10">
            <ModeSelector />
          </div>

          <div className="px-3.5 pt-3 space-y-2.5">
            <StopList variant="mobile" />
            {mode === 'transit' && <TransitOptionsBar />}
            {mode === 'foot' && <WalkOptionsBar />}
            <RouteResults hideSummaryCard />
          </div>
        </div>
      )}
    </div>
  );
}
