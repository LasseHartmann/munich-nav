'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
} from 'lucide-react';
import { toLocalDateTimeInputValue } from '@/lib/geo';
import { getTranslations } from '@/lib/i18n';
import { useNowTick } from '@/lib/useNowTick';
import { useNavStore } from '@/store/useNavStore';
import type { Language, TransitTimeMode } from '@/lib/types';
import { ScrollWheelColumn, WHEEL_ITEM_HEIGHT } from '@/components/ui/ScrollWheelColumn';

interface TransitTimeMenuProps {
  open: boolean;
  onClose: () => void;
}

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

  if (dateStr === todayStr) return `${t.today}, ${formatted}`;
  if (dateStr === tomorrowStr) return `${t.tomorrow}, ${formatted}`;
  return formatted;
}

interface CalendarPickerProps {
  selectedDate: string;
  todayStr: string;
  lang: Language;
  onSelect: (dateStr: string) => void;
}

function StandardCalendarGrid({ selectedDate, todayStr, lang, onSelect }: CalendarPickerProps) {
  const [initYear, initMonth] = selectedDate.split('-').map(Number);
  const [viewYear, setViewYear] = useState(initYear || 2026);
  const [viewMonth, setViewMonth] = useState((initMonth || 1) - 1);

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
      className="rounded-lg border border-[#dcdcdc] dark:border-[#383838] bg-[#f6f6f6] dark:bg-[#252525] p-3 space-y-2.5"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => stepMonth(-1)}
          aria-label="Previous month"
          className="w-8 h-8 rounded-md inline-flex items-center justify-center bg-white dark:bg-[#1e1e1e] border border-[#dcdcdc] dark:border-[#383838] text-[#212121] dark:text-[#e5e5e5] cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-sm font-semibold text-[#111111] dark:text-white capitalize">
          {monthLabel}
        </span>

        <button
          type="button"
          onClick={() => stepMonth(1)}
          aria-label="Next month"
          className="w-8 h-8 rounded-md inline-flex items-center justify-center bg-white dark:bg-[#1e1e1e] border border-[#dcdcdc] dark:border-[#383838] text-[#212121] dark:text-[#e5e5e5] cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((wd) => (
          <div key={wd} className="text-[11px] font-medium text-[#767676] dark:text-[#888888] py-0.5">
            {wd}
          </div>
        ))}
      </div>

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
              className={`h-9 w-9 mx-auto rounded-full text-xs font-semibold tabular-nums transition-colors cursor-pointer flex items-center justify-center ${
                isSelected
                  ? 'bg-[#eb0000] text-white'
                  : isToday
                    ? 'border border-[#212121] dark:border-white text-[#111111] dark:text-white'
                    : isPast
                      ? 'text-[#a3a3a3] dark:text-[#555555] hover:bg-black/5 dark:hover:bg-white/5'
                      : 'text-[#212121] dark:text-[#e5e5e5] hover:bg-white dark:hover:bg-[#333333]'
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.timeMenuTitle}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/45 md:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-[390px] max-h-[90dvh] flex flex-col rounded-t-2xl md:rounded-xl bg-white dark:bg-[#1e1e1e] border-t md:border border-[#dcdcdc] dark:border-[#383838] shadow-xl overflow-hidden"
      >
        {/* Clean Swiss Header (no icon-in-a-box) */}
        <div className="px-4 py-3.5 border-b border-[#e5e5e5] dark:border-[#333333] flex items-center justify-between gap-2 shrink-0">
          <h2 className="text-base font-semibold text-[#111111] dark:text-white tracking-tight">
            {t.timeMenuTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md inline-flex items-center justify-center text-[#686868] hover:text-[#111111] hover:bg-black/5 dark:text-[#999999] dark:hover:text-white dark:hover:bg-white/10 cursor-pointer"
            aria-label={t.cancel}
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-safe-lg md:pb-4 space-y-4">
          {/* Neutral SBB 3-Way Segmented Control */}
          <div
            role="tablist"
            aria-label={t.timeMenuTitle}
            className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#ececec] dark:bg-[#2a2a2a]"
          >
            {(['now', 'departAt', 'arriveBy'] as TransitTimeMode[]).map((m) => {
              const active = draftMode === m;
              const label = m === 'now' ? t.leaveNow : m === 'departAt' ? t.departAt : t.arriveBy;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleModeSwitch(m)}
                  className={`h-9 rounded-md text-xs transition-colors cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-[#151515] text-[#111111] dark:text-white font-semibold shadow-2xs'
                      : 'text-[#686868] dark:text-[#999999] font-medium hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {draftMode === 'now' ? (
            <div className="p-3.5 rounded-lg bg-[#f6f6f6] dark:bg-[#252525] border border-[#e5e5e5] dark:border-[#333333] flex items-center gap-3">
              <Clock className="w-4.5 h-4.5 text-[#eb0000] shrink-0" />
              <p className="text-xs text-[#444444] dark:text-[#cccccc] leading-relaxed">
                {t.liveTimeDesc}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Standard Date Bar */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDraftDate((d) => shiftDateString(d, -1))}
                  aria-label="Previous day"
                  className="w-10 h-10 rounded-lg bg-[#f6f6f6] hover:bg-[#ebebeb] dark:bg-[#2a2a2a] dark:hover:bg-[#333333] border border-[#dcdcdc] dark:border-[#383838] text-[#212121] dark:text-[#e5e5e5] inline-flex items-center justify-center cursor-pointer shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  data-testid="date-picker-toggle"
                  onClick={() => setCalendarOpen((v) => !v)}
                  className={`flex-1 min-w-0 h-10 px-3 rounded-lg border inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors cursor-pointer ${
                    calendarOpen
                      ? 'border-[#111111] dark:border-white bg-white dark:bg-[#252525] text-[#111111] dark:text-white'
                      : 'border-[#dcdcdc] dark:border-[#383838] bg-[#f6f6f6] dark:bg-[#252525] text-[#111111] dark:text-white'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-[#686868] dark:text-[#999999] shrink-0" />
                  <span className="truncate">
                    {formatReadableDate(draftDate, todayStr, tomorrowStr, lang, t)}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#686868] transition-transform shrink-0 ${
                      calendarOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setDraftDate((d) => shiftDateString(d, 1))}
                  aria-label="Next day"
                  className="w-10 h-10 rounded-lg bg-[#f6f6f6] hover:bg-[#ebebeb] dark:bg-[#2a2a2a] dark:hover:bg-[#333333] border border-[#dcdcdc] dark:border-[#383838] text-[#212121] dark:text-[#e5e5e5] inline-flex items-center justify-center cursor-pointer shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {calendarOpen && (
                <StandardCalendarGrid
                  key={draftDate.slice(0, 7)}
                  selectedDate={draftDate}
                  todayStr={todayStr}
                  lang={lang}
                  onSelect={(d) => {
                    setDraftDate(d);
                    setCalendarOpen(false);
                  }}
                />
              )}

              {/* Scrollable Drum Time Picker */}
              <div className="relative rounded-lg border border-[#dcdcdc] dark:border-[#383838] bg-white dark:bg-[#1e1e1e] overflow-hidden">
                <div
                  style={{ height: `${WHEEL_ITEM_HEIGHT}px` }}
                  className="pointer-events-none absolute inset-x-2.5 top-1/2 -translate-y-1/2 rounded-md bg-[#f2f2f2] dark:bg-[#2b2b2b] border border-[#e2e2e2] dark:border-[#3d3d3d]"
                />

                <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white via-white/80 to-transparent dark:from-[#1e1e1e] dark:via-[#1e1e1e]/80 z-10" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-[#1e1e1e] dark:via-[#1e1e1e]/80 z-10" />

                <div className="relative flex items-center px-6">
                  <ScrollWheelColumn
                    items={HOURS}
                    selectedIndex={draftHour}
                    onChange={setDraftHour}
                    ariaLabel="Hours"
                    testId="wheel-hours"
                  />

                  <span
                    aria-hidden="true"
                    className="px-2 text-2xl font-mono font-bold text-[#111111] dark:text-white select-none z-20"
                  >
                    :
                  </span>

                  <ScrollWheelColumn
                    items={MINUTES}
                    selectedIndex={draftMinute}
                    onChange={setDraftMinute}
                    ariaLabel="Minutes"
                    testId="wheel-minutes"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Solid SBB Red Primary CTA */}
          <button
            type="button"
            onClick={handleApply}
            className="w-full h-11 rounded-lg text-sm font-semibold text-white bg-[#eb0000] hover:bg-[#c60018] active:bg-[#a80014] transition-colors cursor-pointer"
          >
            {draftMode === 'now' ? t.leaveNow : t.applyTime}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
