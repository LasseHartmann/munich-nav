'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Clock, Flag, Minus, Plus, Radio, X } from 'lucide-react';
import { toLocalDateTimeInputValue } from '@/lib/geo';
import { getTranslations } from '@/lib/i18n';
import { useNowTick } from '@/lib/useNowTick';
import { useNavStore } from '@/store/useNavStore';
import type { TransitTimeMode } from '@/lib/types';

interface TransitTimeMenuProps {
  open: boolean;
  onClose: () => void;
}

function getBerlinDatePart(baseMs: number, offsetDays = 0): string {
  const d = new Date(baseMs + offsetDays * 86_400_000);
  return toLocalDateTimeInputValue(d).split('T')[0];
}

function splitDateTime(val: string): { date: string; time: string } {
  const fallback = toLocalDateTimeInputValue();
  const [date, time] = (val && val.includes('T') ? val : fallback).split('T');
  return {
    date: date || fallback.split('T')[0],
    time: (time || fallback.split('T')[1]).slice(0, 5),
  };
}

function addMinutesToLocal(dateStr: string, timeStr: string, deltaMin: number): { date: string; time: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  if (!y || !m || !d) return splitDateTime(toLocalDateTimeInputValue());
  const utc = new Date(Date.UTC(y, m - 1, d, hh || 0, (mm || 0) + deltaMin));
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`,
    time: `${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())}`,
  };
}

const QUICK_OFFSETS = [
  { label: '+15m', minutes: 15 },
  { label: '+30m', minutes: 30 },
  { label: '+1h', minutes: 60 },
  { label: '+2h', minutes: 120 },
  { label: '+3h', minutes: 180 },
];

export function TransitTimeMenu({ open, onClose }: TransitTimeMenuProps) {
  const lang = useNavStore((s) => s.lang);
  const departMode = useNavStore((s) => s.departMode);
  const departAtLocal = useNavStore((s) => s.departAtLocal);
  const setTransitSchedule = useNavStore((s) => s.setTransitSchedule);
  const nowMs = useNowTick();
  const t = getTranslations(lang);

  const [draftMode, setDraftMode] = useState<TransitTimeMode>(departMode);
  const [draftDate, setDraftDate] = useState(() => splitDateTime(departAtLocal).date);
  const [draftTime, setDraftTime] = useState(() => splitDateTime(departAtLocal).time);

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
  const isToday = draftDate === todayStr;
  const isTomorrow = Boolean(tomorrowStr) && draftDate === tomorrowStr;

  const handleModeSwitch = (nextMode: TransitTimeMode) => {
    setDraftMode(nextMode);
    // When switching from "now" to "arriveBy", default to +1 hr so it's immediately practical
    const baseMs = nowMs || new Date(`${draftDate}T${draftTime}:00`).getTime();
    if (draftMode === 'now' && nextMode === 'arriveBy') {
      const plusHour = splitDateTime(toLocalDateTimeInputValue(new Date(baseMs + 60 * 60_000)));
      setDraftDate(plusHour.date);
      setDraftTime(plusHour.time);
    } else if (draftMode === 'now' && nextMode === 'departAt') {
      const plus15 = splitDateTime(toLocalDateTimeInputValue(new Date(baseMs + 15 * 60_000)));
      setDraftDate(plus15.date);
      setDraftTime(plus15.time);
    }
  };

  const handleStep = (deltaMin: number) => {
    const next = addMinutesToLocal(draftDate, draftTime, deltaMin);
    setDraftDate(next.date);
    setDraftTime(next.time);
  };

  const handleQuickOffset = (minutes: number) => {
    const baseMs = nowMs || new Date(`${draftDate}T${draftTime}:00`).getTime();
    const target = splitDateTime(toLocalDateTimeInputValue(new Date(baseMs + minutes * 60_000)));
    setDraftDate(target.date);
    setDraftTime(target.time);
  };

  const handleApply = () => {
    if (draftMode === 'now') {
      setTransitSchedule('now');
    } else {
      setTransitSchedule(draftMode, `${draftDate}T${draftTime}`);
    }
    onClose();
  };

  const modeAccent =
    draftMode === 'arriveBy'
      ? 'bg-violet-600 hover:bg-violet-700 shadow-violet-600/25'
      : 'bg-[#0065ae] hover:bg-[#005494] shadow-[#0065ae]/25';

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
        className="w-full md:max-w-[400px] rounded-t-[28px] md:rounded-[26px] bg-white dark:bg-[#0f172a] border-t-2 md:border-2 border-slate-200/90 dark:border-slate-700/80 shadow-2xl overflow-hidden pb-safe-lg md:pb-5"
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs ${
                draftMode === 'arriveBy' ? 'bg-violet-600' : 'bg-[#0065ae]'
              }`}
            >
              {draftMode === 'arriveBy' ? (
                <Flag className="w-4.5 h-4.5" />
              ) : (
                <Clock className="w-4.5 h-4.5" />
              )}
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

        <div className="px-5 pt-4 space-y-4">
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
              {/* Day Selector: Today | Tomorrow | Custom Date */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDraftDate(todayStr)}
                  className={`h-10 rounded-xl text-xs font-extrabold border-2 transition-all active:scale-95 cursor-pointer ${
                    isToday
                      ? 'border-[#0065ae] bg-sky-50 dark:bg-sky-950/50 text-[#0065ae] dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {t.today}
                </button>

                <button
                  type="button"
                  onClick={() => setDraftDate(tomorrowStr)}
                  className={`h-10 rounded-xl text-xs font-extrabold border-2 transition-all active:scale-95 cursor-pointer ${
                    isTomorrow
                      ? 'border-[#0065ae] bg-sky-50 dark:bg-sky-950/50 text-[#0065ae] dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {t.tomorrow}
                </button>

                <label
                  className={`relative h-10 rounded-xl text-xs font-extrabold border-2 flex items-center justify-center gap-1 px-2 cursor-pointer overflow-hidden ${
                    !isToday && !isTomorrow
                      ? 'border-[#0065ae] bg-sky-50 dark:bg-sky-950/50 text-[#0065ae] dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {!isToday && !isTomorrow ? draftDate.slice(5) : t.customDate}
                  </span>
                  <input
                    type="date"
                    value={draftDate}
                    onChange={(e) => {
                      if (e.target.value) setDraftDate(e.target.value);
                    }}
                    aria-label={t.customDate}
                    className="absolute inset-0 opacity-0 cursor-pointer text-base"
                  />
                </label>
              </div>

              {/* Chunky Time Stepper (-15m | HH:mm | +15m) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStep(-15)}
                  className="h-13 px-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-extrabold text-xs inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>15m</span>
                </button>

                <input
                  type="time"
                  value={draftTime}
                  onChange={(e) => {
                    if (e.target.value) setDraftTime(e.target.value.slice(0, 5));
                  }}
                  aria-label={draftMode === 'arriveBy' ? t.arriveBy : t.departAt}
                  className="flex-1 min-w-0 h-13 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-center text-xl font-mono font-extrabold tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-[#0065ae]"
                />

                <button
                  type="button"
                  onClick={() => handleStep(15)}
                  className="h-13 px-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-extrabold text-xs inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>15m</span>
                </button>
              </div>

              {/* Quick Relative Offset Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {QUICK_OFFSETS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleQuickOffset(item.minutes)}
                    className="flex-1 min-w-[56px] h-9 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-extrabold text-slate-700 dark:text-slate-200 active:scale-95 transition-all cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Apply CTA */}
          <button
            type="button"
            onClick={handleApply}
            className={`w-full h-12 rounded-2xl text-sm font-extrabold text-white shadow-lg active:scale-[0.98] transition-all cursor-pointer ${modeAccent}`}
          >
            {draftMode === 'now' ? t.leaveNow : t.applyTime}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
