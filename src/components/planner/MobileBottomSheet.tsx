'use client';

import { useEffect, useRef, useState } from 'react';
import { Navigation } from 'lucide-react';
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
  peek: 20,
  half: 50,
  full: 91,
};

function getSnapHeightPx(s: MobileSheetSnap, vh: number): number {
  if (s === 'peek') return Math.max(158, Math.round(vh * 0.19));
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
            ? 'max(158px, calc(18dvh + env(safe-area-inset-bottom)))'
            : `${SNAP_HEIGHTS_VH[snap]}dvh`,
        transition: `height ${springDurationMs}ms cubic-bezier(0.34, 1.16, 0.64, 1)`,
      };

  const firstTransit = transitPlan?.legs[0]?.alternatives[transitPlan.legs[0].selectedIndex];
  const lastTransit =
    transitPlan?.legs[transitPlan.legs.length - 1]?.alternatives[
      transitPlan.legs[transitPlan.legs.length - 1].selectedIndex
    ];

  const showBodyContent = snap !== 'peek' || (isDragging && dragHeightPx > 210);

  return (
    <div
      ref={sheetRef}
      style={sheetStyle}
      className="md:hidden fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl bg-[#f6f6f6] dark:bg-[#151515] border-t border-[#d4d4d4] dark:border-[#333333] shadow-[0_-6px_28px_rgba(0,0,0,0.16)] overflow-hidden will-change-[height]"
    >
      {/* White SBB Top Header & Pure Drag-Only Pull Tab */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="touch-none select-none shrink-0 bg-white dark:bg-[#1e1e1e]"
      >
        <div
          data-testid="sheet-pull-tab"
          aria-label="Drag to resize bottom sheet"
          className="w-full pt-3 pb-2.5 flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          <span
            className={`h-1 rounded-full transition-all duration-150 ${
              isDragging
                ? 'w-14 bg-[#111111] dark:bg-white'
                : 'w-10 bg-[#cccccc] dark:bg-[#525252]'
            }`}
          />
        </div>

        {!showingStation && !showingPin && (
          <div>
            <div className="px-4 pb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  aria-hidden="true"
                  className="w-[3px] h-4 bg-[#eb0000] rounded-xs shrink-0"
                />
                <span className="text-[15px] font-bold tracking-tight text-[#111111] dark:text-white leading-none">
                  {t.appName}
                </span>
                <span className="text-xs text-[#767676] dark:text-[#888888] truncate">
                  München
                </span>
              </div>

              <TopBarControls />
            </div>

            {!showBodyContent && hasRoute ? (
              <div className="px-4 pb-3 pt-1 flex items-center justify-between gap-2 border-t border-[#ececec] dark:border-[#2e2e2e]">
                <div className="min-w-0">
                  <div className="text-base font-bold text-[#111111] dark:text-white tabular-nums leading-tight">
                    {mode === 'transit' && transitPlan
                      ? formatDuration(transitPlan.totalDurationSeconds, lang)
                      : roadRoute
                        ? `${formatDuration(roadRoute.totalDurationSeconds, lang)} · ${formatDistance(roadRoute.totalDistanceMeters, lang)}`
                        : ''}
                  </div>
                  {mode === 'transit' && firstTransit && lastTransit && (
                    <div className="text-xs font-mono font-medium text-[#686868] dark:text-[#999999] tabular-nums">
                      {formatMunichTime(firstTransit.startTime, lang)} –{' '}
                      {formatMunichTime(lastTransit.endTime, lang)}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setLiveFollowActive(!liveFollowActive)}
                  className={`h-9 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer ${
                    liveFollowActive
                      ? 'bg-[#212121] text-white dark:bg-white dark:text-[#111111]'
                      : 'bg-[#eb0000] hover:bg-[#c60018] text-white'
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

      {/* Sheet Body */}
      {showingStation ? (
        <StationPopup variant="sheet" />
      ) : showingPin ? (
        <MapClickCard variant="sheet" />
      ) : (
        showBodyContent && (
          <div
            ref={scrollBodyRef}
            className="flex-1 overflow-y-auto px-3.5 pb-safe-lg space-y-3 pt-3"
          >
            {hasRoute && !stopsEditing ? (
              <div className="space-y-2">
                <CompactTripBar />
                {mode === 'transit' && <TransitOptionsBar />}
                {mode === 'foot' && <WalkOptionsBar />}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] space-y-2.5">
                {hasRoute && stopsEditing && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setStopsEditing(false);
                        setSnap('half');
                      }}
                      className="h-8 px-3 rounded-md text-xs font-semibold bg-[#eb0000] hover:bg-[#c60018] text-white cursor-pointer"
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
