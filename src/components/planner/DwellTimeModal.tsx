'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getTranslations } from '@/lib/i18n';
import { useNavStore } from '@/store/useNavStore';
import { ScrollWheelColumn, WHEEL_ITEM_HEIGHT } from '@/components/ui/ScrollWheelColumn';

interface DwellTimeModalProps {
  open: boolean;
  stopName: string;
  initialMinutes: number;
  onApply: (minutes: number) => void;
  onClose: () => void;
}

const HOUR_VALUES = Array.from({ length: 13 }, (_, i) => i);
const MINUTE_VALUES = Array.from({ length: 60 }, (_, i) => i);
const QUICK_PRESETS = [0, 10, 15, 30, 60];

export function DwellTimeModal({
  open,
  stopName,
  initialMinutes,
  onApply,
  onClose,
}: DwellTimeModalProps) {
  const lang = useNavStore((s) => s.lang);
  const t = getTranslations(lang);

  const clampedInit = Math.max(0, Math.min(720, Math.round(initialMinutes)));
  const [hours, setHours] = useState(() => Math.floor(clampedInit / 60));
  const [minutes, setMinutes] = useState(() => clampedInit % 60);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const totalMinutes = Math.min(720, hours * 60 + minutes);
  const hourLabels = HOUR_VALUES.map((h) => `${h} ${t.hoursShort}`);
  const minuteLabels = MINUTE_VALUES.map((m) => `${String(m).padStart(2, '0')} ${t.dwellMinutes}`);

  const handleSelectPreset = (mins: number) => {
    setHours(Math.floor(mins / 60));
    setMinutes(mins % 60);
  };

  const handleHourChange = (nextHour: number) => {
    setHours(nextHour);
    if (nextHour === 12 && minutes > 0) {
      setMinutes(0);
    }
  };

  const handleMinuteChange = (nextMin: number) => {
    if (hours === 12 && nextMin > 0) {
      setHours(11);
    }
    setMinutes(nextMin);
  };

  const formattedTotal =
    totalMinutes === 0
      ? t.noStay
      : hours > 0 && minutes > 0
        ? `${hours} ${t.hoursShort} ${minutes} ${t.dwellMinutes}`
        : hours > 0
          ? `${hours} ${t.hoursShort}`
          : `${minutes} ${t.dwellMinutes}`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.stayModalTitle}
      data-testid="dwell-time-modal"
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/45 md:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-[380px] max-h-[88dvh] flex flex-col rounded-t-2xl md:rounded-xl bg-white dark:bg-[#1e1e1e] border-t md:border border-[#dcdcdc] dark:border-[#383838] shadow-xl overflow-hidden"
      >
        {/* Clean SBB Header */}
        <div className="px-4 py-3.5 border-b border-[#e5e5e5] dark:border-[#333333] flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#111111] dark:text-white tracking-tight leading-tight">
              {t.stayModalTitle}
            </h2>
            {stopName && (
              <p className="text-xs text-[#686868] dark:text-[#999999] truncate mt-0.5">
                {stopName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md inline-flex items-center justify-center text-[#686868] hover:text-[#111111] hover:bg-black/5 dark:text-[#999999] dark:hover:text-white dark:hover:bg-white/10 cursor-pointer shrink-0"
            aria-label={t.cancel}
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-4 pt-3.5 pb-safe-lg md:pb-4 space-y-3.5">
          {/* Quick Preset Chips */}
          <div className="grid grid-cols-5 gap-1.5">
            {QUICK_PRESETS.map((preset) => {
              const active = totalMinutes === preset;
              const label = preset === 60 ? `1 ${t.hoursShort}` : `${preset}m`;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`h-9 rounded-md text-xs font-semibold tabular-nums border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#212121] border-[#212121] text-white dark:bg-white dark:border-white dark:text-[#111111]'
                      : 'bg-[#f6f6f6] dark:bg-[#262626] border-[#dcdcdc] dark:border-[#3a3a3a] text-[#212121] dark:text-[#e5e5e5] hover:border-[#111111]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Scrollable Hours / Minutes Wheel Drum */}
          <div className="relative rounded-lg border border-[#dcdcdc] dark:border-[#383838] bg-white dark:bg-[#1e1e1e] overflow-hidden">
            <div
              style={{ height: `${WHEEL_ITEM_HEIGHT}px` }}
              className="pointer-events-none absolute inset-x-2.5 top-1/2 -translate-y-1/2 rounded-md bg-[#f2f2f2] dark:bg-[#2b2b2b] border border-[#e2e2e2] dark:border-[#3d3d3d]"
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white via-white/80 to-transparent dark:from-[#1e1e1e] dark:via-[#1e1e1e]/80 z-10" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-[#1e1e1e] dark:via-[#1e1e1e]/80 z-10" />

            <div className="relative flex items-center px-5">
              <ScrollWheelColumn
                items={hourLabels}
                selectedIndex={hours}
                onChange={handleHourChange}
                ariaLabel="Stay hours"
                testId="dwell-wheel-hours"
              />
              <span
                aria-hidden="true"
                className="px-1 text-lg font-mono font-semibold text-[#999999] select-none z-20"
              >
                :
              </span>
              <ScrollWheelColumn
                items={minuteLabels}
                selectedIndex={minutes}
                onChange={handleMinuteChange}
                ariaLabel="Stay minutes"
                testId="dwell-wheel-minutes"
              />
            </div>
          </div>

          {/* Primary SBB Red CTA */}
          <button
            type="button"
            data-testid="dwell-apply-btn"
            onClick={() => {
              onApply(totalMinutes);
              onClose();
            }}
            className="w-full h-11 rounded-lg text-sm font-semibold text-white bg-[#eb0000] hover:bg-[#c60018] active:bg-[#a80014] transition-colors cursor-pointer tabular-nums"
          >
            {t.applyStay} · {formattedTotal}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
