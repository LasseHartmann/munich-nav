'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Radio,
  X,
} from 'lucide-react';
import { toLocalDateTimeInputValue } from '@/lib/geo';
import { getTranslations } from '@/lib/i18n';
import { useNowTick } from '@/lib/useNowTick';
import { useNavStore } from '@/store/useNavStore';
import type { Language, TransitTimeMode } from '@/lib/types';

interface TransitTimeMenuProps {
  open: boolean;
  onClose: () => void;
}

const ITEM_HEIGHT = 44; // px per wheel row (5 visible rows = 220px)
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function splitDateTime(val: string): { date: string; hour: number; minute: number } {
  const fallback = toLocalDateTimeInputValue();
  const [date, timeRaw] = (val && val.includes('T') ? val : fallback).split('T');
  const [hStr, mStr] = (timeRaw || fallback.split('T')[1]).split(':');
  return {
    date: date || fallback.split('T')[0],
    hour: Math.min(23, Math.max(0, Number(hStr) || 0)),
    minute: Math.min(59, Math.max(0, Number(mStr) || 0)),
  };
}

function getBerlinDatePart(baseMs: number, offsetDays = 0): string {
  return toLocalDateTimeInputValue(new Date(baseMs + offsetDays * 86_400_000)).split('T')[0];
}

function shiftDateString(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function formatReadableDate(
  dateStr: string,
  todayStr: string,
  tomorrowStr: string,
  lang: Language,
  t: ReturnType<typeof getTranslations>
): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0));
  const formatted = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(dt);

  if (dateStr === todayStr) return `${t.today} · ${formatted}`;
  if (dateStr === tomorrowStr) return `${t.tomorrow} · ${formatted}`;
  return formatted;
}

interface WheelColumnProps {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  ariaLabel: string;
  testId: string;
  accentTextClass: string;
}

function ScrollWheelColumn({
  items,
  selectedIndex,
  onChange,
  ariaLabel,
  testId,
  accentTextClass,
}: WheelColumnProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const isProgrammaticRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef(selectedIndex);

  // Sync scroll position ONLY on initial mount or external programmatic changes (never interrupt user momentum scroll!)
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const isInitial = !mountedRef.current;
    mountedRef.current = true;

    if (!isInitial && selectedIndex === lastCommittedRef.current) {
      return;
    }

    lastCommittedRef.current = selectedIndex;
    const targetTop = selectedIndex * ITEM_HEIGHT;
    isProgrammaticRef.current = true;
    el.scrollTop = targetTop;
    const id = setTimeout(() => {
      isProgrammaticRef.current = false;
    }, 100);
    return () => clearTimeout(id);
  }, [selectedIndex]);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || isProgrammaticRef.current) return;

    const rawIdx = Math.round(el.scrollTop / ITEM_HEIGHT);
    const clamped = Math.min(items.length - 1, Math.max(0, rawIdx));

    if (clamped !== lastCommittedRef.current) {
      lastCommittedRef.current = clamped;
      onChange(clamped);
    }

    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      if (!listRef.current) return;
      const snappedIdx = Math.min(
        items.length - 1,
        Math.max(0, Math.round(listRef.current.scrollTop / ITEM_HEIGHT))
      );
      if (snappedIdx !== lastCommittedRef.current) {
        lastCommittedRef.current = snappedIdx;
        onChange(snappedIdx);
      }
    }, 80);
  };

  const handleItemClick = (idx: number) => {
    const el = listRef.current;
    lastCommittedRef.current = idx;
    onChange(idx);
    if (el) {
      isProgrammaticRef.current = true;
      el.scrollTo({ top: idx * ITEM_HEIGHT, behavior: 'smooth' });
      setTimeout(() => {
        isProgrammaticRef.current = false;
      }, 280);
    }
  };

  return (
    <div
      ref={listRef}
      data-testid={testId}
      role="listbox"
      aria-label={ariaLabel}
      onScroll={handleScroll}
      style={{ height: `${ITEM_HEIGHT * 5}px` }}
      className="relative flex-1 overflow-y-auto snap-y snap-mandatory no-scrollbar touch-pan-y overscroll-contain"
    >
      {/* Top & bottom spacer padding so first & last items snap cleanly into center band */}
      <div style={{ height: `${ITEM_HEIGHT * 2}px` }} aria-hidden="true" />
      {items.map((label, idx) => {
        const dist = Math.abs(idx - selectedIndex);
        const isSelected = dist === 0;
        return (
          <button
            key={label}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => handleItemClick(idx)}
            style={{ height: `${ITEM_HEIGHT}px` }}
            className={`w-full snap-center flex items-center justify-center font-mono tabular-nums transition-all cursor-pointer select-none ${
              isSelected
                ? `text-2xl font-extrabold ${accentTextClass}`
                : dist === 1
                  ? 'text-lg font-bold text-slate-500 dark:text-slate-400'
                  : 'text-base font-semibold text-slate-300 dark:text-slate-600'
            }`}
          >
            {label}
          </button>
        );
      })}
      <div style={{ height: `${ITEM_HEIGHT * 2}px` }} aria-hidden="true" />
    </div>
  );
}

interface CalendarPickerProps {
  selectedDate: string;
  todayStr: string;
  lang: Language;
  accentBgClass: string;
  onSelect: (dateStr: string) => void;
}

function StandardCalendarGrid({
  selectedDate,
  todayStr,
  lang,
  accentBgClass,
  onSelect,
}: CalendarPickerProps) {
  const [initYear, initMonth] = selectedDate.split('-').map(Number);
  const [viewYear, setViewYear] = useState(initYear || 2026);
  const [viewMonth, setViewMonth] = useState((initMonth || 1) - 1); // 0-indexed

  const weekdays =
    lang === 'de'
      ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
      : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const monthLabel = useMemo(() => {
    const dt = new Date(Date.UTC(viewYear, viewMonth, 15));
    return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dt);
  }, [viewYear, viewMonth, lang]);

  const calendarCells = useMemo(() => {
    const firstDayUtc = new Date(Date.UTC(viewYear, viewMonth, 1));
    // Monday = 0 .. Sunday = 6
    const startOffset = (firstDayUtc.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const pad = (n: number) => String(n).padStart(2, '0');

    const cells: ({ day: number; dateStr: string } | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        dateStr: `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`,
      });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const stepMonth = (delta: number) => {
    const next = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth());
  };

  return (
    <div
      data-testid="standard-calendar"
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70 p-3 space-y-2.5"
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => stepMonth(-1)}
          aria-label="Previous month"
          className="w-8 h-8 rounded-xl inline-flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 active:scale-90 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-sm font-extrabold text-slate-900 dark:text-white capitalize">
          {monthLabel}
        </span>

        <button
          type="button"
          onClick={() => stepMonth(1)}
          aria-label="Next month"
          className="w-8 h-8 rounded-xl inline-flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 active:scale-90 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((wd) => (
          <div
            key={wd}
            className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 py-0.5"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {calendarCells.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} className="h-9" />;
          const isSelected = cell.dateStr === selectedDate;
          const isToday = cell.dateStr === todayStr;
          const isPast = Boolean(todayStr) && cell.dateStr < todayStr;
          return (
            <button
              key={cell.dateStr}
              type="button"
              onClick={() => onSelect(cell.dateStr)}
              className={`h-9 w-9 mx-auto rounded-full text-xs font-extrabold tabular-nums transition-all active:scale-90 cursor-pointer flex items-center justify-center ${
                isSelected
                  ? `${accentBgClass} text-white shadow-sm`
                  : isToday
                    ? 'bg-sky-100 dark:bg-sky-950 text-[#0065ae] dark:text-sky-300 ring-1 ring-[#0065ae]/40'
                    : isPast
                      ? 'text-slate-400 dark:text-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                      : 'text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-700'
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TransitTimeMenu({ open, onClose }: TransitTimeMenuProps) {
  const lang = useNavStore((s) => s.lang);
  const departMode = useNavStore((s) => s.departMode);
  const departAtLocal = useNavStore((s) => s.departAtLocal);
  const setTransitSchedule = useNavStore((s) => s.setTransitSchedule);
  const nowMs = useNowTick();
  const t = getTranslations(lang);

  const [draftMode, setDraftMode] = useState<TransitTimeMode>(departMode);
  const [draftDate, setDraftDate] = useState(() => splitDateTime(departAtLocal).date);
  const [draftHour, setDraftHour] = useState(() => splitDateTime(departAtLocal).hour);
  const [draftMinute, setDraftMinute] = useState(() => splitDateTime(departAtLocal).minute);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Close cleanly on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const todayStr = nowMs > 0 ? getBerlinDatePart(nowMs, 0) : draftDate;
  const tomorrowStr = nowMs > 0 ? getBerlinDatePart(nowMs, 1) : '';
  const pad = (n: number) => String(n).padStart(2, '0');

  const handleModeSwitch = (nextMode: TransitTimeMode) => {
    setDraftMode(nextMode);
    if (nextMode === 'now') {
      setCalendarOpen(false);
      return;
    }
    const baseMs = nowMs || new Date(`${draftDate}T${pad(draftHour)}:${pad(draftMinute)}:00`).getTime();
    if (draftMode === 'now' && nextMode === 'arriveBy') {
      const target = splitDateTime(toLocalDateTimeInputValue(new Date(baseMs + 60 * 60_000)));
      setDraftDate(target.date);
      setDraftHour(target.hour);
      setDraftMinute(target.minute);
    } else if (draftMode === 'now' && nextMode === 'departAt') {
      const target = splitDateTime(toLocalDateTimeInputValue(new Date(baseMs + 15 * 60_000)));
      setDraftDate(target.date);
      setDraftHour(target.hour);
      setDraftMinute(target.minute);
    }
  };

  const handleApply = () => {
    if (draftMode === 'now') {
      setTransitSchedule('now');
    } else {
      setTransitSchedule(draftMode, `${draftDate}T${pad(draftHour)}:${pad(draftMinute)}`);
    }
    onClose();
  };

  const isArrive = draftMode === 'arriveBy';
  const accentBg = isArrive ? 'bg-violet-600' : 'bg-[#0065ae]';
  const accentBtn = isArrive
    ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-600/25'
    : 'bg-[#0065ae] hover:bg-[#005494] shadow-[#0065ae]/25';
  const accentText = isArrive
    ? 'text-violet-700 dark:text-violet-300'
    : 'text-[#0065ae] dark:text-sky-300';
  const centerBandClass = isArrive
    ? 'bg-violet-500/12 dark:bg-violet-500/20 border-violet-500/30'
    : 'bg-[#0065ae]/10 dark:bg-sky-500/18 border-[#0065ae]/25';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.timeMenuTitle}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/50 backdrop-blur-xs md:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-[400px] max-h-[90dvh] flex flex-col rounded-t-[28px] md:rounded-[26px] bg-white dark:bg-[#0f172a] border-t-2 md:border-2 border-slate-200/90 dark:border-slate-700/80 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs ${accentBg}`}
            >
              {isArrive ? <Flag className="w-4.5 h-4.5" /> : <Clock className="w-4.5 h-4.5" />}
            </div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              {t.timeMenuTitle}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl inline-flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white active:scale-90 cursor-pointer"
            aria-label={t.cancel}
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-safe-lg md:pb-5 space-y-4">
          {/* 3-Way Segmented Mode Control: Leave now | Depart at | Arrive by */}
          <div
            role="tablist"
            aria-label={t.timeMenuTitle}
            className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80"
          >
            <button
              type="button"
              role="tab"
              aria-selected={draftMode === 'now'}
              onClick={() => handleModeSwitch('now')}
              className={`h-10 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                draftMode === 'now'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/60'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{t.leaveNow}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={draftMode === 'departAt'}
              onClick={() => handleModeSwitch('departAt')}
              className={`h-10 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                draftMode === 'departAt'
                  ? 'bg-[#0065ae] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t.departAt}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={draftMode === 'arriveBy'}
              onClick={() => handleModeSwitch('arriveBy')}
              className={`h-10 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                draftMode === 'arriveBy'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/60'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>{t.arriveBy}</span>
            </button>
          </div>

          {draftMode === 'now' ? (
            <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-100 leading-relaxed">
                {t.liveTimeDesc}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Standard Google Maps–style Date Picker Bar */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraftDate((d) => shiftDateString(d, -1))}
                  aria-label="Previous day"
                  className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center justify-center active:scale-90 cursor-pointer shrink-0"
                >
                  <ChevronLeft className="w-4.5 h-4.5" />
                </button>

                <button
                  type="button"
                  data-testid="date-picker-toggle"
                  onClick={() => setCalendarOpen((v) => !v)}
                  className={`flex-1 min-w-0 h-11 px-3.5 rounded-2xl border-2 inline-flex items-center justify-center gap-2 text-sm font-extrabold transition-all active:scale-[0.98] cursor-pointer ${
                    calendarOpen
                      ? 'border-[#0065ae] bg-sky-50/70 dark:bg-sky-950/40 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-[#0065ae] dark:text-sky-400 shrink-0" />
                  <span className="truncate">
                    {formatReadableDate(draftDate, todayStr, tomorrowStr, lang, t)}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
                      calendarOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setDraftDate((d) => shiftDateString(d, 1))}
                  aria-label="Next day"
                  className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center justify-center active:scale-90 cursor-pointer shrink-0"
                >
                  <ChevronRight className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Expandable Standard Month Calendar Grid */}
              {calendarOpen && (
                <StandardCalendarGrid
                  key={draftDate.slice(0, 7)}
                  selectedDate={draftDate}
                  todayStr={todayStr}
                  lang={lang}
                  accentBgClass={accentBg}
                  onSelect={(d) => {
                    setDraftDate(d);
                    setCalendarOpen(false);
                  }}
                />
              )}

              {/* Scrollable Drum/Wheel Time Picker (Google Maps / iOS style) */}
              <div className="relative rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#0f172a] overflow-hidden">
                {/* Highlighted Center Selection Band */}
                <div
                  style={{ height: `${ITEM_HEIGHT}px` }}
                  className={`pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 rounded-xl border ${centerBandClass}`}
                />

                {/* Top & bottom soft fade gradients */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white via-white/80 to-transparent dark:from-[#0f172a] dark:via-[#0f172a]/80 z-10" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-[#0f172a] dark:via-[#0f172a]/80 z-10" />

                <div className="relative flex items-center px-6">
                  <ScrollWheelColumn
                    items={HOURS}
                    selectedIndex={draftHour}
                    onChange={setDraftHour}
                    ariaLabel="Hours"
                    testId="wheel-hours"
                    accentTextClass={accentText}
                  />

                  <span
                    aria-hidden="true"
                    className={`px-2 text-2xl font-mono font-extrabold select-none z-20 ${accentText}`}
                  >
                    :
                  </span>

                  <ScrollWheelColumn
                    items={MINUTES}
                    selectedIndex={draftMinute}
                    onChange={setDraftMinute}
                    ariaLabel="Minutes"
                    testId="wheel-minutes"
                    accentTextClass={accentText}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Apply CTA */}
          <button
            type="button"
            onClick={handleApply}
            className={`w-full h-12 rounded-2xl text-sm font-extrabold text-white shadow-lg active:scale-[0.98] transition-all cursor-pointer ${accentBtn}`}
          >
            {draftMode === 'now' ? t.leaveNow : t.applyTime}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
