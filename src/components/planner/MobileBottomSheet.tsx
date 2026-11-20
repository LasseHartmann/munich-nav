'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Compass, Navigation } from 'lucide-react';
import { formatDistance, formatDuration, formatMunichTime } from '@/lib/geo';
import { getTranslations } from '@/lib/i18n';
import { useNavStore, type MobileSheetSnap } from '@/store/useNavStore';
import { TopBarControls } from '@/components/ui/TopBarControls';
import { StationPopup } from '@/components/map/StationPopup';
import { MapClickCard } from '@/components/map/MapClickCard';
import { ModeSelector } from './ModeSelector';
import { CompactTripBar, StopList } from './StopList';
import { TransitOptionsBar } from './TransitOptionsBar';
import { RouteResults } from './RouteResults';

const SNAP_HEIGHTS_VH: Record<MobileSheetSnap, number> = {
  peek: 20, // ~165px on iPhone 14 — keeps ~80% of map clear!
  half: 50, // balanced 50/50 map & planner view
  full: 91, // full-height directions & editing below status bar
};

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

  const scrollBodyRef = useRef<HTMLDivElement>(null);

  // Scroll sheet content smoothly back to top whenever a new route arrives so the Hero Card is front & center
  useEffect(() => {
    if (transitPlan || roadRoute) {
      scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [transitPlan, roadRoute]);

  // Smooth touch-draggable sheet state
  const [dragHeightPx, setDragHeightPx] = useState<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startHeightPx: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    moved: boolean;
  } | null>(null);

  const getSnapPx = (s: MobileSheetSnap) => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
    if (s === 'peek') return Math.max(158, Math.round(vh * 0.2));
    return Math.round((vh * SNAP_HEIGHTS_VH[s]) / 100);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input, a')) return;
    const vh = window.innerHeight || 844;
    const startHeightPx = dragHeightPx ?? getSnapPx(snap);
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeightPx: Math.min(vh * 0.92, Math.max(146, startHeightPx)),
      lastY: e.clientY,
      lastTime: performance.now(),
      velocityY: 0,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dy = d.startY - e.clientY;
    if (Math.abs(dy) > 4) d.moved = true;

    const now = performance.now();
    const dt = Math.max(1, now - d.lastTime);
    d.velocityY = (d.lastY - e.clientY) / dt; // positive = dragging up
    d.lastY = e.clientY;
    d.lastTime = now;

    const vh = window.innerHeight || 844;
    const nextPx = Math.min(vh * 0.93, Math.max(138, d.startHeightPx + dy));
    setDragHeightPx(nextPx);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;

    if (!d.moved) {
      setDragHeightPx(null);
      return;
    }

    const vh = window.innerHeight || 844;
    const finalPx = dragHeightPx ?? d.startHeightPx;
    const ratio = finalPx / vh;

    // Velocity-aware snapping
    let nextSnap: MobileSheetSnap = snap;
    if (d.velocityY > 0.45) {
      nextSnap = snap === 'peek' ? 'half' : 'full';
    } else if (d.velocityY < -0.45) {
      nextSnap = snap === 'full' ? 'half' : 'peek';
    } else if (ratio < 0.33) {
      nextSnap = 'peek';
    } else if (ratio < 0.7) {
      nextSnap = 'half';
    } else {
      nextSnap = 'full';
    }

    setDragHeightPx(null);
    setSnap(nextSnap);
  };

  const cycleSnap = () => {
    if (snap === 'peek') setSnap('half');
    else if (snap === 'half') setSnap('full');
    else setSnap('peek');
  };

  const sheetStyle: React.CSSProperties =
    dragHeightPx !== null
      ? { height: `${Math.round(dragHeightPx)}px`, transition: 'none' }
      : {
          height:
            snap === 'peek'
              ? 'max(162px, calc(18dvh + env(safe-area-inset-bottom)))'
              : `${SNAP_HEIGHTS_VH[snap]}dvh`,
          transition: 'height 300ms cubic-bezier(0.22, 1, 0.36, 1)',
        };

  // Peek summary values when a route is active
  const firstTransit = transitPlan?.legs[0]?.alternatives[transitPlan.legs[0].selectedIndex];
  const lastTransit =
    transitPlan?.legs[transitPlan.legs.length - 1]?.alternatives[
      transitPlan.legs[transitPlan.legs.length - 1].selectedIndex
    ];

  return (
    <div
      style={sheetStyle}
      className="md:hidden fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[28px] bg-white/97 dark:bg-[#0f172a]/97 backdrop-blur-xl border-t-2 border-slate-200/90 dark:border-slate-700/80 shadow-[0_-12px_40px_rgba(15,23,42,0.22)] overflow-hidden"
    >
      {/* Draggable Handle Zone */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="touch-none select-none shrink-0"
      >
        <button
          type="button"
          onClick={cycleSnap}
          className="w-full pt-2.5 pb-1.5 flex items-center justify-center cursor-pointer"
          aria-label="Resize bottom sheet"
        >
          <span className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
        </button>

        {/* Single-Sheet Swap Header OR Planner Header */}
        {!showingStation && !showingPin && (
          <div className="px-4 pb-2.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={cycleSnap}
                className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
              >
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
              </button>

              <TopBarControls />
            </div>

            {/* Peek Mode: ultra-glanceable active trip strip OR mode selector */}
            {snap === 'peek' && hasRoute ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-[#0065ae]/10 dark:bg-[#0065ae]/25 border border-[#0065ae]/25">
                <button
                  type="button"
                  onClick={() => setSnap('half')}
                  className="flex-1 min-w-0 text-left flex items-center gap-2 cursor-pointer"
                >
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
                  <ChevronUp className="w-4 h-4 text-slate-400 ml-auto shrink-0" />
                </button>

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
        snap !== 'peek' && (
          <div
            ref={scrollBodyRef}
            className="flex-1 overflow-y-auto px-4 pb-safe-lg space-y-3 border-t border-slate-100 dark:border-slate-800/80 pt-3"
          >
            {/* Compact trip summary bar when a route is active, or full StopList editor */}
            {hasRoute && !stopsEditing ? (
              <CompactTripBar />
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
              </div>
            )}

            <RouteResults />
          </div>
        )
      )}
    </div>
  );
}
