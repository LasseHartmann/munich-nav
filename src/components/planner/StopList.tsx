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
  ArrowUpDown,
  Clock,
  GripVertical,
  Loader2,
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
          className="p-0.5 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing shrink-0 touch-none"
          aria-label="Reorder stop"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        {/* Stop marker badge */}
        <div className="w-5 flex flex-col items-center shrink-0">
          {isStart ? (
            <span className="w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-emerald-500/25 text-[9px] font-bold text-white flex items-center justify-center">
              A
            </span>
          ) : isEnd ? (
            <span className="w-4 h-4 rounded-full bg-rose-500 ring-2 ring-rose-500/25 text-[9px] font-bold text-white flex items-center justify-center">
              B
            </span>
          ) : (
            <span className="w-4 h-4 rounded-full bg-amber-500 ring-2 ring-amber-500/25 text-[9px] font-bold text-white flex items-center justify-center">
              {index}
            </span>
          )}
        </div>

        {/* Search input */}
        <PlaceSearchInput
          value={waypoint.place}
          placeholder={placeholder}
          onSelect={(place) => setWaypointPlace(waypoint.uid, place)}
        />

        {/* Remove intermediate stop button */}
        {isIntermediate && (
          <button
            type="button"
            onClick={() => removeWaypoint(waypoint.uid)}
            className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
            title="Remove stop"
            aria-label="Remove stop"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Intermediate stop stay/dwell duration selector (for public transport chaining!) */}
      {isIntermediate && isTransit && (
        <div className="ml-11 mt-1 mb-0.5 flex items-center gap-1 flex-wrap" title={t.dwellTooltip}>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
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
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
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
            className="w-12 px-1.5 py-0.5 text-[10px] font-semibold text-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <span className="text-[10px] text-slate-400">{t.dwellMinutes}</span>
        </div>
      )}
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
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#0065ae] dark:text-sky-400 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 border border-sky-200/70 dark:border-sky-800/70 transition-colors cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.addStop}
          </button>

          <button
            type="button"
            onClick={reverseWaypoints}
            title={t.reverseRoute}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.reverseRoute}</span>
          </button>

          {canOptimize && (
            <button
              type="button"
              onClick={() => void optimizeStopOrder()}
              disabled={isOptimizing}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/60 dark:hover:bg-violet-900/60 border border-violet-200/80 dark:border-violet-800/70 transition-colors cursor-pointer disabled:opacity-60"
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
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            {t.clearRoute}
          </button>
        )}
      </div>
    </div>
  );
}
