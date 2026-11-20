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
  Sparkles,
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
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="w-7 h-10 md:w-5 md:h-8 flex items-center justify-center text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing shrink-0 touch-none"
          aria-label="Reorder stop"
        >
          <GripVertical className="w-4 h-4 md:w-3.5 md:h-3.5" />
        </button>

        {/* Stop marker badge */}
        <div className="w-6 flex flex-col items-center shrink-0">
          {isStart ? (
            <span className="w-5 h-5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/25 text-[10px] font-extrabold text-white flex items-center justify-center shadow-2xs">
              A
            </span>
          ) : isEnd ? (
            <span className="w-5 h-5 rounded-full bg-rose-500 ring-2 ring-rose-500/25 text-[10px] font-extrabold text-white flex items-center justify-center shadow-2xs">
              B
            </span>
          ) : (
            <span className="w-5 h-5 rounded-full bg-amber-500 ring-2 ring-amber-500/25 text-[10px] font-extrabold text-white flex items-center justify-center shadow-2xs">
              {index}
            </span>
          )}
        </div>

        {/* Search input (Full-screen modal trigger on phone, inline dropdown on desktop) */}
        <PlaceSearchInput
          waypointUid={waypoint.uid}
          value={waypoint.place}
          placeholder={placeholder}
          onSelect={(place) => setWaypointPlace(waypoint.uid, place)}
        />

        {/* Remove intermediate stop button */}
        {isIntermediate && (
          <button
            type="button"
            onClick={() => removeWaypoint(waypoint.uid)}
            className="w-9 h-10 md:w-7 md:h-8 rounded-xl inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-90 transition-all cursor-pointer shrink-0"
            title="Remove stop"
            aria-label="Remove stop"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Intermediate stop stay/dwell duration selector (for public transport chaining!) */}
      {isIntermediate && isTransit && (
        <div
          className="ml-12 mt-1.5 mb-0.5 flex items-center gap-1.5 flex-wrap"
          title={t.dwellTooltip}
        >
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-700 dark:text-amber-400">
            <Clock className="w-3.5 h-3.5" />
            {t.dwellLabel}:
          </span>
          {DWELL_PRESETS.map((mins) => {
            const active = waypoint.dwellMinutes === mins;
            return (
              <button
                key={mins}
                type="button"
                onClick={() => setWaypointDwell(waypoint.uid, mins)}
                className={`h-8 md:h-6 px-2.5 md:px-2 rounded-lg text-xs md:text-[11px] font-extrabold transition-all active:scale-95 cursor-pointer ${
                  active
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/50'
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
            className="w-14 md:w-12 h-8 md:h-6 px-1.5 text-base md:text-[11px] font-bold text-center tabular-nums rounded-lg border border-amber-300/80 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-[11px] font-semibold text-slate-400">{t.dwellMinutes}</span>
        </div>
      )}
    </div>
  );
}

/** Compact single-card summary of active stops shown on phones so route results get prime space */
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
    <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80">
      <div className="flex-1 min-w-0 flex items-center flex-wrap gap-x-1.5 gap-y-1">
        {filled.map((w, idx) => {
          const isStart = idx === 0;
          const isEnd = idx === filled.length - 1;
          const dotColor = isStart ? 'bg-emerald-500' : isEnd ? 'bg-rose-500' : 'bg-amber-500';
          const label = isStart ? 'A' : isEnd ? 'B' : String(idx);
          return (
            <div key={w.uid} className="inline-flex items-center gap-1 max-w-full">
              <span
                className={`w-4.5 h-4.5 rounded-full ${dotColor} text-[9px] font-extrabold text-white inline-flex items-center justify-center shrink-0`}
              >
                {label}
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 max-w-[130px] truncate">
                {w.place!.name}
              </span>
              {!isStart && !isEnd && mode === 'transit' && w.dwellMinutes > 0 && (
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                  +{w.dwellMinutes}m
                </span>
              )}
              {!isEnd && <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />}
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
        className="inline-flex items-center gap-1 h-9 px-3 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-extrabold text-[#0065ae] dark:text-sky-300 shadow-2xs active:scale-95 shrink-0 cursor-pointer"
      >
        <Pencil className="w-3.5 h-3.5" />
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

      {/* Stop Action Row */}
      <div className="flex items-center justify-between gap-1.5 pt-1 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => addIntermediateStop(null)}
            disabled={waypoints.length >= 10}
            className="inline-flex items-center gap-1 h-9 md:h-8 px-3 rounded-xl text-xs font-extrabold text-[#0065ae] dark:text-sky-300 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/70 dark:hover:bg-sky-900/70 border border-sky-200 dark:border-sky-800/80 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.addStop}
          </button>

          <button
            type="button"
            onClick={reverseWaypoints}
            title={t.reverseRoute}
            className="inline-flex items-center gap-1 h-9 md:h-8 px-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>{t.reverseRoute}</span>
          </button>

          {canOptimize && (
            <button
              type="button"
              onClick={() => void optimizeStopOrder()}
              disabled={isOptimizing}
              className="inline-flex items-center gap-1 h-9 md:h-8 px-3 rounded-xl text-xs font-extrabold text-white bg-violet-600 hover:bg-violet-700 shadow-sm shadow-violet-600/25 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            >
              {isOptimizing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {isOptimizing ? t.optimizing : t.optimizeStops}
            </button>
          )}
        </div>

        {filledCount > 0 && (
          <button
            type="button"
            onClick={clearRoute}
            className="inline-flex items-center gap-1 h-9 md:h-8 px-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 active:scale-95 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t.clearRoute}
          </button>
        )}
      </div>
    </div>
  );
}
