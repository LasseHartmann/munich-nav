'use client';

import { useEffect, useRef, useState } from 'react';
import { Compass, Navigation } from 'lucide-react';
import { formatDistance, formatDuration, formatMunichTime } from '@/lib/geo';
import { getTranslations } from '@/lib/i18n';
import { useNavStore, type MobileSheetSnap } from '@/store/useNavStore';
import { TopBarControls } from '@/components/ui/TopBarControls';
import { StationPopup } from '@/components/map/StationPopup';
import { MapClickCard } from '@/components/map/MapClickCard';
import { ModeSelector } from './ModeSelector';
import { CompactTripBar, StopList } from './StopList';
import { TransitOptionsBar } from './TransitOptionsBar';
import { WalkOptionsBar } from './WalkOptionsBar';
import { RouteResults } from './RouteResults';

const SNAP_ORDER: MobileSheetSnap[] = ['peek', 'half', 'full'];

const SNAP_HEIGHTS_VH: Record<MobileSheetSnap, number> = {
  peek: 20, // ~165px on iPhone 14 — keeps ~80% of map clear
  half: 50, // balanced 50/50 map & planner view
  full: 91, // full-height directions & editing below status bar
};

function getSnapHeightPx(s: MobileSheetSnap, vh: number): number {
  if (s === 'peek') return Math.max(162, Math.round(vh * 0.19));
  return Math.round((vh * SNAP_HEIGHTS_VH[s]) / 100);
}

export function MobileBottomSheet() {
  const snap = useNavStore((s) => s.mobileSheetSnap);
  const setSnap = useNavStore((s) => s.setMobileSheetSnap);
  const stopsEditing = useNavStore((s) => s.mobileStopsEditing);
  const setStopsEditing = useNavStore((s) => s.setMobileStopsEditing);
  const mode = useNavStore((s) => s.mode);
  const lang = useNavStore((s) => s.lang);
  const roadRoute = useNavStore((s) => s.roadRoute);
  const transitPlan = useNavStore((s) => s.transitPlan);
  const selectedStation = useNavStore((s) => s.selectedStation);
  const mapClickPin = useNavStore((s) => s.mapClickPin);
  const liveFollowActive = useNavStore((s) => s.liveFollowActive);
  const setLiveFollowActive = useNavStore((s) => s.setLiveFollowActive);

  const t = getTranslations(lang);
  const hasRoute = Boolean((mode === 'transit' && transitPlan) || (mode !== 'transit' && roadRoute));
  const showingStation = Boolean(selectedStation);
  const showingPin = !showingStation && Boolean(mapClickPin);

  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  // Scroll sheet content smoothly back to top whenever a new route arrives so the Hero Card is front & center
  useEffect(() => {
    if (transitPlan || roadRoute) {
      scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [transitPlan, roadRoute]);

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
    // Allow normal taps on real interactive controls (Share, DE, Theme, Mode tabs, GO button)
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
      // Safe ignore if pointer capture isn't supported
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
    // Keep only recent samples within the last 110ms for clean, jitter-free release velocity
    while (d.samples.length > 2 && now - d.samples[0].t > 110) {
      d.samples.shift();
    }

    const vh = window.innerHeight || 844;
    const minPx = Math.max(132, getSnapHeightPx('peek', vh) - 30);
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

    // Pressing/tapping without dragging does nothing
    if (!d.moved) {
      setDragHeightPx(null);
      return;
    }

    const vh = window.innerHeight || 844;
    const finalPx = d.currentHeightPx;
    const now = performance.now();

    // Compute smooth release velocity (px/ms; positive = flicking UP, negative = flicking DOWN)
    let velocityPxPerMs = 0;
    const latest = d.samples[d.samples.length - 1];
    // If finger paused for >90ms before releasing, treat as deliberate placement (zero momentum)
    if (latest && now - latest.t <= 90 && d.samples.length >= 2) {
      const oldest = d.samples[0];
      const dt = Math.max(16, latest.t - oldest.t);
      velocityPxPerMs = (oldest.y - latest.y) / dt;
    }

    // Project where the sheet would naturally coast with momentum (~220ms coast window)
    const minPx = getSnapHeightPx('peek', vh);
    const maxPx = getSnapHeightPx('full', vh);
    const projectedPx = Math.min(
      maxPx,
      Math.max(minPx, finalPx + velocityPxPerMs * 220)
    );

    // Spring to whichever of the 3 snap positions (peek, half, full) is closest to the momentum projection
    let closestSnap: MobileSheetSnap = snap;
    let smallestDist = Infinity;
    for (const candidate of SNAP_ORDER) {
      const dist = Math.abs(projectedPx - getSnapHeightPx(candidate, vh));
      if (dist < smallestDist) {
        smallestDist = dist;
        closestSnap = candidate;
      }
    }

    // Faster flicks snap crisply; gentle releases settle smoothly
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
            ? 'max(162px, calc(18dvh + env(safe-area-inset-bottom)))'
            : `${SNAP_HEIGHTS_VH[snap]}dvh`,
        transition: `height ${springDurationMs}ms cubic-bezier(0.34, 1.16, 0.64, 1)`,
      };

  // Peek summary values when a route is active
  const firstTransit = transitPlan?.legs[0]?.alternatives[transitPlan.legs[0].selectedIndex];
  const lastTransit =
    transitPlan?.legs[transitPlan.legs.length - 1]?.alternatives[
      transitPlan.legs[transitPlan.legs.length - 1].selectedIndex
    ];

  // Show full content when above peek OR while dragging up past peek so content reveals smoothly
  const showBodyContent = snap !== 'peek' || (isDragging && dragHeightPx > 210);

  return (
    <div
      ref={sheetRef}
      style={sheetStyle}
      className="md:hidden fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[28px] bg-white/97 dark:bg-[#0f172a]/97 backdrop-blur-xl border-t-2 border-slate-200/90 dark:border-slate-700/80 shadow-[0_-12px_40px_rgba(15,23,42,0.22)] overflow-hidden will-change-[height]"
    >
      {/* Pure Drag-Only Handle & Header Zone */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="touch-none select-none shrink-0"
      >
        {/* Pull Tab (drag-only — pressing/tapping does nothing) */}
        <div
          data-testid="sheet-pull-tab"
          aria-label="Drag to resize bottom sheet"
          className="w-full pt-3 pb-2.5 flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          <span
            className={`h-1.5 rounded-full transition-all duration-150 ${
              isDragging
                ? 'w-16 bg-[#0065ae] dark:bg-sky-400'
                : 'w-12 bg-slate-300 dark:bg-slate-600'
            }`}
          />
        </div>

        {/* Single-Sheet Swap Header OR Planner Header */}
        {!showingStation && !showingPin && (
          <div className="px-4 pb-2.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 text-left">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0065ae] to-[#00a984] flex items-center justify-center text-white shadow-sm shrink-0">
                  <Compass className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                    {t.appName}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {t.appTagline}
                  </div>
                </div>
              </div>

              <TopBarControls />
            </div>

            {/* Peek Mode: ultra-glanceable active trip strip OR mode selector */}
            {!showBodyContent && hasRoute ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-[#0065ae]/10 dark:bg-[#0065ae]/25 border border-[#0065ae]/25">
                <div className="flex-1 min-w-0 text-left flex items-center gap-2">
                  <div className="min-w-0">
                    <div className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums leading-tight">
                      {mode === 'transit' && transitPlan
                        ? formatDuration(transitPlan.totalDurationSeconds, lang)
                        : roadRoute
                          ? `${formatDuration(roadRoute.totalDurationSeconds, lang)} · ${formatDistance(roadRoute.totalDistanceMeters, lang)}`
                          : ''}
                    </div>
                    {mode === 'transit' && firstTransit && lastTransit && (
                      <div className="text-xs font-mono font-bold text-[#0065ae] dark:text-sky-300 tabular-nums">
                        {formatMunichTime(firstTransit.startTime, lang)} →{' '}
                        {formatMunichTime(lastTransit.endTime, lang)}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setLiveFollowActive(!liveFollowActive)}
                  className={`h-9 px-3.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 shrink-0 cursor-pointer ${
                    liveFollowActive
                      ? 'bg-rose-500 text-white'
                      : 'bg-[#0065ae] text-white shadow-xs'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  {liveFollowActive ? t.liveFollowStop : t.liveFollowStart}
                </button>
              </div>
            ) : (
              <ModeSelector />
            )}
          </div>
        )}
      </div>

      {/* Sheet Body: Swaps cleanly between Station Departures, Map Pin Card, or Route Planner */}
      {showingStation ? (
        <StationPopup variant="sheet" />
      ) : showingPin ? (
        <MapClickCard variant="sheet" />
      ) : (
        showBodyContent && (
          <div
            ref={scrollBodyRef}
            className="flex-1 overflow-y-auto px-4 pb-safe-lg space-y-3 border-t border-slate-100 dark:border-slate-800/80 pt-3"
          >
            {/* Compact trip summary bar when a route is active, or full StopList editor */}
            {hasRoute && !stopsEditing ? (
              <div className="space-y-2">
                <CompactTripBar />
                {mode === 'transit' && <TransitOptionsBar />}
                {mode === 'foot' && <WalkOptionsBar />}
              </div>
            ) : (
              <div className="space-y-2.5">
                {hasRoute && stopsEditing && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setStopsEditing(false);
                        setSnap('half');
                      }}
                      className="h-9 px-3.5 rounded-xl text-xs font-extrabold bg-[#0065ae] text-white active:scale-95 cursor-pointer"
                    >
                      {t.doneEditing}
                    </button>
                  </div>
                )}
                <StopList />
                {mode === 'transit' && <TransitOptionsBar />}
                {mode === 'foot' && <WalkOptionsBar />}
              </div>
            )}

            <RouteResults />
          </div>
        )
      )}
    </div>
  );
}
