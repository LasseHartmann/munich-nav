'use client';

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
  ArrowRight,
  ArrowUpDown,
  Clock,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Route,
  Trash2,
  X,
} from 'lucide-react';
import { useNavStore } from '@/store/useNavStore';
import { getTranslations } from '@/lib/i18n';
import type { Waypoint } from '@/lib/types';
import { PlaceSearchInput } from './PlaceSearchInput';

const DWELL_PRESETS = [0, 10, 15, 30, 60];

interface SortableStopRowProps {
  waypoint: Waypoint;
  index: number;
  total: number;
  isTransit: boolean;
}

function SortableStopRow({ waypoint, index, total, isTransit }: SortableStopRowProps) {
  const lang = useNavStore((s) => s.lang);
  const setWaypointPlace = useNavStore((s) => s.setWaypointPlace);
  const setWaypointDwell = useNavStore((s) => s.setWaypointDwell);
  const removeWaypoint = useNavStore((s) => s.removeWaypoint);
  const t = getTranslations(lang);

  const isStart = index === 0;
  const isEnd = index === total - 1;
  const isIntermediate = !isStart && !isEnd;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: waypoint.uid,
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
      className={`group relative ${isDragging ? 'z-40 opacity-90' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="w-6 h-10 md:w-5 md:h-8 flex items-center justify-center text-[#bdbdbd] hover:text-[#686868] dark:text-[#555555] dark:hover:text-[#999999] cursor-grab active:cursor-grabbing shrink-0 touch-none"
          aria-label="Reorder stop"
        >
          <GripVertical className="w-4 h-4 md:w-3.5 md:h-3.5" />
        </button>

        {/* SBB Architectural Stop Indicator: hollow origin, numbered stop, SBB Red destination */}
        <div className="w-5 flex flex-col items-center shrink-0">
          {isStart ? (
            <span className="w-3 h-3 rounded-full border-2 border-[#111111] dark:border-white bg-white dark:bg-[#212121]" />
          ) : isEnd ? (
            <span className="w-3 h-3 rounded-full bg-[#eb0000]" />
          ) : (
            <span className="w-4.5 h-4.5 rounded-full bg-[#212121] dark:bg-white text-[10px] font-bold text-white dark:text-[#111111] flex items-center justify-center tabular-nums">
              {index}
            </span>
          )}
        </div>

        <PlaceSearchInput
          waypointUid={waypoint.uid}
          value={waypoint.place}
          placeholder={placeholder}
          onSelect={(place) => setWaypointPlace(waypoint.uid, place)}
        />

        {isIntermediate && (
          <button
            type="button"
            onClick={() => removeWaypoint(waypoint.uid)}
            className="w-8 h-10 md:w-7 md:h-8 rounded-md inline-flex items-center justify-center text-[#767676] hover:text-[#eb0000] transition-colors cursor-pointer shrink-0"
            title="Remove stop"
            aria-label="Remove stop"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Restrained SBB Dwell / Stay Control for intermediate transit stops */}
      {isIntermediate && isTransit && (
        <div
          className="ml-11 mt-1.5 mb-0.5 flex items-center gap-1 flex-wrap"
          title={t.dwellTooltip}
        >
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#686868] dark:text-[#999999] mr-0.5">
            <Clock className="w-3 h-3" />
            {t.dwellLabel}:
          </span>
          {DWELL_PRESETS.map((mins) => {
            const active = waypoint.dwellMinutes === mins;
            return (
              <button
                key={mins}
                type="button"
                onClick={() => setWaypointDwell(waypoint.uid, mins)}
                className={`h-7 md:h-6 px-2 rounded-[5px] text-xs md:text-[11px] font-medium tabular-nums border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#212121] border-[#212121] text-white dark:bg-white dark:border-white dark:text-[#111111] font-semibold'
                    : 'bg-white dark:bg-[#252525] border-[#d4d4d4] dark:border-[#3d3d3d] text-[#444444] dark:text-[#cccccc] hover:border-[#111111]'
                }`}
              >
                {mins}m
              </button>
            );
          })}
          <input
            type="number"
            min={0}
            max={720}
            step={5}
            value={waypoint.dwellMinutes}
            onChange={(e) => setWaypointDwell(waypoint.uid, Number(e.target.value) || 0)}
            aria-label={t.dwellLabel}
            className="w-13 md:w-11 h-7 md:h-6 px-1 text-base md:text-[11px] font-medium text-center tabular-nums rounded-[5px] border border-[#d4d4d4] dark:border-[#3d3d3d] bg-white dark:bg-[#252525] text-[#111111] dark:text-white focus:outline-none focus:border-[#111111]"
          />
          <span className="text-[11px] text-[#767676]">{t.dwellMinutes}</span>
        </div>
      )}
    </div>
  );
}

/** Compact SBB route summary strip shown on phones once a route is active */
export function CompactTripBar() {
  const waypoints = useNavStore((s) => s.waypoints);
  const mode = useNavStore((s) => s.mode);
  const lang = useNavStore((s) => s.lang);
  const setMobileStopsEditing = useNavStore((s) => s.setMobileStopsEditing);
  const setMobileSheetSnap = useNavStore((s) => s.setMobileSheetSnap);
  const t = getTranslations(lang);

  const filled = waypoints.filter((w) => w.place !== null);
  if (filled.length < 2) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333]">
      <div className="flex-1 min-w-0 flex items-center flex-wrap gap-x-1.5 gap-y-1">
        {filled.map((w, idx) => {
          const isStart = idx === 0;
          const isEnd = idx === filled.length - 1;
          return (
            <div key={w.uid} className="inline-flex items-center gap-1 max-w-full">
              {isStart ? (
                <span className="w-2.5 h-2.5 rounded-full border-2 border-[#111111] dark:border-white shrink-0" />
              ) : isEnd ? (
                <span className="w-2.5 h-2.5 rounded-full bg-[#eb0000] shrink-0" />
              ) : (
                <span className="w-4 h-4 rounded-full bg-[#212121] dark:bg-white text-[9px] font-bold text-white dark:text-[#111111] inline-flex items-center justify-center shrink-0">
                  {idx}
                </span>
              )}
              <span className="text-xs font-medium text-[#111111] dark:text-white max-w-[130px] truncate">
                {w.place!.name}
              </span>
              {!isStart && !isEnd && mode === 'transit' && w.dwellMinutes > 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#f0f0f0] dark:bg-[#303030] text-[#444444] dark:text-[#cccccc] tabular-nums shrink-0">
                  +{w.dwellMinutes}m
                </span>
              )}
              {!isEnd && <ArrowRight className="w-3 h-3 text-[#999999] shrink-0" />}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          setMobileStopsEditing(true);
          setMobileSheetSnap('full');
        }}
        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-[#d4d4d4] dark:border-[#3d3d3d] bg-[#f6f6f6] hover:bg-[#ececec] dark:bg-[#2a2a2a] dark:hover:bg-[#333333] text-xs font-medium text-[#111111] dark:text-white shrink-0 cursor-pointer"
      >
        <Pencil className="w-3 h-3" />
        <span>{t.editStops}</span>
      </button>
    </div>
  );
}

export function StopList() {
  const waypoints = useNavStore((s) => s.waypoints);
  const mode = useNavStore((s) => s.mode);
  const lang = useNavStore((s) => s.lang);
  const isOptimizing = useNavStore((s) => s.isOptimizing);
  const addIntermediateStop = useNavStore((s) => s.addIntermediateStop);
  const reorderWaypoints = useNavStore((s) => s.reorderWaypoints);
  const reverseWaypoints = useNavStore((s) => s.reverseWaypoints);
  const optimizeStopOrder = useNavStore((s) => s.optimizeStopOrder);
  const clearRoute = useNavStore((s) => s.clearRoute);

  const t = getTranslations(lang);
  const isTransit = mode === 'transit';
  const filledCount = waypoints.filter((w) => w.place !== null).length;
  const canOptimize = !isTransit && filledCount >= 4;

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

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={waypoints.map((w) => w.uid)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {waypoints.map((wp, idx) => (
              <SortableStopRow
                key={wp.uid}
                waypoint={wp}
                index={idx}
                total={waypoints.length}
                isTransit={isTransit}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Clean SBB Flat Utility Action Row */}
      <div className="flex items-center justify-between gap-1.5 pt-1 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => addIntermediateStop(null)}
            disabled={waypoints.length >= 10}
            className="inline-flex items-center gap-1 h-8 md:h-7 px-2.5 rounded-md text-xs font-medium text-[#111111] dark:text-white bg-white hover:bg-[#f0f0f0] dark:bg-[#262626] dark:hover:bg-[#333333] border border-[#d4d4d4] dark:border-[#3d3d3d] transition-colors cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.addStop}
          </button>

          <button
            type="button"
            onClick={reverseWaypoints}
            title={t.reverseRoute}
            className="inline-flex items-center gap-1 h-8 md:h-7 px-2.5 rounded-md text-xs font-medium text-[#444444] hover:text-[#111111] hover:bg-black/5 dark:text-[#b7b7b7] dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>{t.reverseRoute}</span>
          </button>

          {canOptimize && (
            <button
              type="button"
              onClick={() => void optimizeStopOrder()}
              disabled={isOptimizing}
              className="inline-flex items-center gap-1 h-8 md:h-7 px-2.5 rounded-md text-xs font-medium text-white bg-[#212121] hover:bg-[#000000] dark:bg-white dark:text-[#111111] dark:hover:bg-[#e5e5e5] transition-colors cursor-pointer disabled:opacity-60"
            >
              {isOptimizing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Route className="w-3.5 h-3.5" />
              )}
              {isOptimizing ? t.optimizing : t.optimizeStops}
            </button>
          )}
        </div>

        {filledCount > 0 && (
          <button
            type="button"
            onClick={clearRoute}
            className="inline-flex items-center gap-1 h-8 md:h-7 px-2 rounded-md text-xs font-medium text-[#686868] hover:text-[#eb0000] transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t.clearRoute}
          </button>
        )}
      </div>
    </div>
  );
}
