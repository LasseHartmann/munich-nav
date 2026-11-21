'use client';

import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowUpDown,
  Check,
  Clock,
  GripVertical,
  Loader2,
  Plus,
  Route,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useNavStore } from '@/store/useNavStore';
import { getTranslations } from '@/lib/i18n';
import { encodeRouteToQuery } from '@/lib/urlState';
import type { Waypoint } from '@/lib/types';
import { PlaceSearchInput } from './PlaceSearchInput';
import { DwellTimeModal } from './DwellTimeModal';
import { TransitTimeTrigger } from './TransitOptionsBar';

function formatCompactDwell(minutes: number, hoursShort: string): string {
  if (minutes <= 0) return '0m';
  if (minutes >= 60 && minutes % 60 === 0) return `+${minutes / 60}${hoursShort}`;
  if (minutes > 60) return `+${Math.floor(minutes / 60)}${hoursShort}${minutes % 60}m`;
  return `+${minutes}m`;
}

interface SortableStopRowProps {
  waypoint: Waypoint;
  index: number;
  total: number;
  isTransit: boolean;
  showDragHandle: boolean;
  onOpenDwellModal: (waypoint: Waypoint) => void;
}

function SortableStopRow({
  waypoint,
  index,
  total,
  isTransit,
  showDragHandle,
  onOpenDwellModal,
}: SortableStopRowProps) {
  const lang = useNavStore((s) => s.lang);
  const setWaypointPlace = useNavStore((s) => s.setWaypointPlace);
  const removeWaypoint = useNavStore((s) => s.removeWaypoint);
  const t = getTranslations(lang);

  const isStart = index === 0;
  const isEnd = index === total - 1;
  const isIntermediate = !isStart && !isEnd;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: waypoint.uid,
    disabled: !showDragHandle,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const placeholder = isStart
    ? t.originPlaceholder
    : isEnd
      ? t.destinationPlaceholder
      : `${t.stopPlaceholder} (#${index})`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex items-center gap-1.5 pl-2.5 pr-1.5 min-h-[44px] md:min-h-[40px] ${
        isDragging ? 'z-40 bg-white dark:bg-[#242424] shadow-md rounded-md opacity-95' : ''
      }`}
    >
      {showDragHandle && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="w-5 h-9 flex items-center justify-center text-[#bdbdbd] hover:text-[#686868] dark:text-[#555555] dark:hover:text-[#999999] cursor-grab active:cursor-grabbing shrink-0 touch-none -ml-1"
          aria-label="Reorder stop"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}

      {/* SBB Architectural Stop Indicator */}
      <div className="w-5 flex items-center justify-center shrink-0">
        {isStart ? (
          <span className="w-2.5 h-2.5 rounded-full border-2 border-[#111111] dark:border-white bg-white dark:bg-[#212121]" />
        ) : isEnd ? (
          <span className="w-2.5 h-2.5 rounded-full bg-[#eb0000]" />
        ) : (
          <span className="w-4 h-4 rounded-full bg-[#212121] dark:bg-white text-[9px] font-bold text-white dark:text-[#111111] flex items-center justify-center tabular-nums">
            {index}
          </span>
        )}
      </div>

      <PlaceSearchInput
        waypointUid={waypoint.uid}
        value={waypoint.place}
        placeholder={placeholder}
        onSelect={(place) => setWaypointPlace(waypoint.uid, place)}
        borderless
      />

      {/* Compact clickable "+20m" Stay pill -> opens Wheel Picker Modal */}
      {isIntermediate && isTransit && (
        <button
          type="button"
          data-testid={`dwell-pill-${index}`}
          onClick={() => onOpenDwellModal(waypoint)}
          title={t.dwellTooltip}
          className={`h-7 md:h-6 px-2 rounded-md border text-xs md:text-[11px] font-semibold tabular-nums inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
            waypoint.dwellMinutes > 0
              ? 'bg-[#f6f6f6] dark:bg-[#2b2b2b] border-[#d0d0d0] dark:border-[#444444] text-[#111111] dark:text-white hover:border-[#111111]'
              : 'bg-transparent border-dashed border-[#cccccc] dark:border-[#444444] text-[#767676] hover:text-[#111111] dark:hover:text-white'
          }`}
        >
          <Clock className="w-3 h-3 text-[#686868] dark:text-[#999999]" />
          <span>{formatCompactDwell(waypoint.dwellMinutes, t.hoursShort)}</span>
        </button>
      )}

      {isIntermediate && (
        <button
          type="button"
          onClick={() => removeWaypoint(waypoint.uid)}
          className="w-7 h-8 rounded-md inline-flex items-center justify-center text-[#767676] hover:text-[#eb0000] transition-colors cursor-pointer shrink-0"
          title="Remove stop"
          aria-label="Remove stop"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

interface StopListProps {
  /** On mobile active-route view, Clear lives in the sticky header (×) and Share moves here */
  variant?: 'desktop' | 'mobile';
}

export function StopList({ variant = 'desktop' }: StopListProps) {
  const waypoints = useNavStore((s) => s.waypoints);
  const mode = useNavStore((s) => s.mode);
  const mapStyle = useNavStore((s) => s.mapStyle);
  const departMode = useNavStore((s) => s.departMode);
  const departAtLocal = useNavStore((s) => s.departAtLocal);
  const transitFilters = useNavStore((s) => s.transitFilters);
  const walkOptions = useNavStore((s) => s.walkOptions);
  const lang = useNavStore((s) => s.lang);
  const isOptimizing = useNavStore((s) => s.isOptimizing);
  const addIntermediateStop = useNavStore((s) => s.addIntermediateStop);
  const setWaypointDwell = useNavStore((s) => s.setWaypointDwell);
  const reorderWaypoints = useNavStore((s) => s.reorderWaypoints);
  const reverseWaypoints = useNavStore((s) => s.reverseWaypoints);
  const optimizeStopOrder = useNavStore((s) => s.optimizeStopOrder);
  const clearRoute = useNavStore((s) => s.clearRoute);

  const [dwellTargetUid, setDwellTargetUid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const t = getTranslations(lang);
  const isTransit = mode === 'transit';
  const isMultiStop = waypoints.length >= 3;
  const filledCount = waypoints.filter((w) => w.place !== null).length;
  const canOptimize = !isTransit && filledCount >= 4;

  const dwellTargetWp = dwellTargetUid
    ? (waypoints.find((w) => w.uid === dwellTargetUid) ?? null)
    : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderWaypoints(String(active.id), String(over.id));
    }
  };

  const handleShare = async () => {
    const qs = encodeRouteToQuery({
      mode,
      mapStyle,
      waypoints,
      departMode,
      departAtLocal,
      transitFilters,
      walkOptions,
    });
    const url = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ''}`;
    if (typeof navigator !== 'undefined' && navigator.share && window.innerWidth < 768) {
      try {
        await navigator.share({ title: 'MucNav Munich Route', url });
        return;
      } catch {
        // Fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.history.replaceState(null, '', url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-2">
      {/* Unified SBB Mobile From / To Card */}
      <div className="rounded-xl bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] flex items-stretch overflow-visible">
        <div className="flex-1 min-w-0 divide-y divide-[#ececec] dark:divide-[#2e2e2e]">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={waypoints.map((w) => w.uid)}
              strategy={verticalListSortingStrategy}
            >
              {waypoints.map((wp, idx) => (
                <SortableStopRow
                  key={wp.uid}
                  waypoint={wp}
                  index={idx}
                  total={waypoints.length}
                  isTransit={isTransit}
                  showDragHandle={isMultiStop}
                  onOpenDwellModal={(w) => setDwellTargetUid(w.uid)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Integrated Swap button for crisp 2-stop From/To layout */}
        {!isMultiStop && (
          <div
            data-testid="inline-flip-col"
            className="w-[42px] flex items-center justify-center border-l border-[#ececec] dark:border-[#2e2e2e] shrink-0"
          >
            <button
              type="button"
              onClick={reverseWaypoints}
              title={t.reverseRoute}
              aria-label={t.reverseRoute}
              className="w-8 h-8 rounded-md inline-flex items-center justify-center text-[#686868] hover:text-[#111111] hover:bg-black/5 dark:text-[#999999] dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Borderless Trip Utility Row */}
      {variant === 'mobile' ? (
        <div
          data-testid="mobile-trip-actions-row"
          className={`w-full min-w-0 flex items-center justify-between gap-1 overflow-hidden ${
            !isMultiStop ? 'pr-[44px]' : ''
          }`}
        >
          <button
            type="button"
            data-testid="add-stop-btn"
            onClick={() => addIntermediateStop(null)}
            disabled={waypoints.length >= 10}
            className="inline-flex items-center justify-center gap-1 h-7 px-1.5 rounded-md text-xs font-medium text-[#111111] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40 min-w-0"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t.addStop}</span>
          </button>

          {isTransit && <TransitTimeTrigger />}

          {filledCount >= 2 && (
            <button
              type="button"
              data-testid="mobile-share-btn"
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-1 h-7 px-1.5 rounded-md text-xs font-medium text-[#111111] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer min-w-0"
              title={t.shareLink}
              aria-label={t.shareLink}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#007a3e] dark:text-[#34d399] shrink-0" />
                  <span className="truncate text-[#007a3e] dark:text-[#34d399]">{t.linkCopied}</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-[#686868] dark:text-[#999999] shrink-0" />
                  <span className="truncate">{t.shareLink}</span>
                </>
              )}
            </button>
          )}

          {isMultiStop && (
            <button
              type="button"
              onClick={reverseWaypoints}
              title={t.reverseRoute}
              className="inline-flex items-center justify-center gap-1 h-7 px-1.5 rounded-md text-xs font-medium text-[#555555] hover:text-[#111111] hover:bg-black/5 dark:text-[#b0b0b0] dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer min-w-0"
            >
              <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.reverseRoute}</span>
            </button>
          )}

          {canOptimize && (
            <button
              type="button"
              onClick={() => void optimizeStopOrder()}
              disabled={isOptimizing}
              className="inline-flex items-center justify-center gap-1 h-7 px-1.5 rounded-md text-xs font-semibold text-[#111111] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-60 min-w-0"
            >
              {isOptimizing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Route className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{isOptimizing ? t.optimizing : t.optimizeStops}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-1.5 px-0.5">
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            <button
              type="button"
              data-testid="add-stop-btn"
              onClick={() => addIntermediateStop(null)}
              disabled={waypoints.length >= 10}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium text-[#111111] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>{t.addStop}</span>
            </button>

            {isTransit && <TransitTimeTrigger />}

            {isMultiStop && (
              <button
                type="button"
                onClick={reverseWaypoints}
                title={t.reverseRoute}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium text-[#555555] hover:text-[#111111] hover:bg-black/5 dark:text-[#b0b0b0] dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
                <span>{t.reverseRoute}</span>
              </button>
            )}

            {canOptimize && (
              <button
                type="button"
                onClick={() => void optimizeStopOrder()}
                disabled={isOptimizing}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-semibold text-[#111111] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isOptimizing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Route className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{isOptimizing ? t.optimizing : t.optimizeStops}</span>
              </button>
            )}
          </div>

          {filledCount > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={clearRoute}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium text-[#686868] hover:text-[#eb0000] transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.clearRoute}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Scrollable Wheel Picker Modal for Stay Duration */}
      {dwellTargetWp && (
        <DwellTimeModal
          key={dwellTargetWp.uid}
          open
          stopName={dwellTargetWp.place?.name || `${t.dwellLabel}`}
          initialMinutes={dwellTargetWp.dwellMinutes}
          onApply={(mins) => setWaypointDwell(dwellTargetWp.uid, mins)}
          onClose={() => setDwellTargetUid(null)}
        />
      )}
    </div>
  );
}
