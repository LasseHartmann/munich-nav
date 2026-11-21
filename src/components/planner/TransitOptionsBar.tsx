'use client';

import { useState } from 'react';
import { ChevronDown, Clock, Flag, Footprints } from 'lucide-react';
import { toLocalDateTimeInputValue } from '@/lib/geo';
import { useNowTick } from '@/lib/useNowTick';
import { useNavStore } from '@/store/useNavStore';
import { getTranslations } from '@/lib/i18n';
import type { TransitFilterKey } from '@/lib/types';
import { TransitTimeMenu } from './TransitTimeMenu';
import { WalkFilterChips } from './WalkOptionsBar';

const FILTER_PILLS: { key: TransitFilterKey; dotColor: string }[] = [
  { key: 'SUBWAY', dotColor: '#0065ae' },
  { key: 'SUBURBAN', dotColor: '#008e4e' },
  { key: 'TRAM', dotColor: '#e30613' },
  { key: 'BUS', dotColor: '#00586a' },
  { key: 'REGIONAL', dotColor: '#1e3a8a' },
];

function formatScheduleLabel(
  departMode: 'now' | 'departAt' | 'arriveBy',
  departAtLocal: string,
  nowMs: number,
  t: ReturnType<typeof getTranslations>
): string {
  if (departMode === 'now') return t.leaveNow;

  const [datePart, timePartRaw] = (departAtLocal || '').split('T');
  const timePart = (timePartRaw || '').slice(0, 5) || '--:--';
  const prefix = departMode === 'arriveBy' ? t.arriveShort : t.departShort;

  if (nowMs > 0) {
    const todayStr = toLocalDateTimeInputValue(new Date(nowMs)).split('T')[0];
    const tomorrowStr = toLocalDateTimeInputValue(new Date(nowMs + 86_400_000)).split('T')[0];
    if (!datePart || datePart === todayStr) {
      return `${prefix} · ${timePart}`;
    }
    if (datePart === tomorrowStr) {
      return `${prefix} · ${t.tomorrow} ${timePart}`;
    }
  } else if (!datePart) {
    return `${prefix} · ${timePart}`;
  }

  const [, m, d] = datePart.split('-');
  return `${prefix} · ${d}.${m}. ${timePart}`;
}

export function TransitOptionsBar() {
  const lang = useNavStore((s) => s.lang);
  const departMode = useNavStore((s) => s.departMode);
  const departAtLocal = useNavStore((s) => s.departAtLocal);
  const transitFilters = useNavStore((s) => s.transitFilters);
  const toggleTransitFilter = useNavStore((s) => s.toggleTransitFilter);

  const nowMs = useNowTick();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = getTranslations(lang);

  const scheduleLabel = formatScheduleLabel(departMode, departAtLocal, nowMs, t);
  const isScheduled = departMode !== 'now';

  return (
    <div className="pt-0.5 space-y-1.5">
      {/* Row 1: Trip Time + Transit vehicle types */}
      <div
        data-testid="transit-type-filters-row"
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar md:flex-wrap md:overflow-visible pb-0.5"
      >
        {/* SBB Clean Time Trigger */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          data-testid="transit-time-trigger"
          className={`inline-flex items-center gap-1.5 h-8 md:h-7 px-2.5 rounded-md text-xs font-medium border transition-colors shrink-0 cursor-pointer tabular-nums ${
            isScheduled
              ? 'bg-[#212121] border-[#212121] text-white dark:bg-white dark:border-white dark:text-[#111111]'
              : 'bg-white dark:bg-[#212121] border-[#d4d4d4] dark:border-[#3d3d3d] text-[#111111] dark:text-[#f5f5f5] hover:border-[#111111] dark:hover:border-[#888888]'
          }`}
        >
          {departMode === 'arriveBy' ? (
            <Flag className="w-3.5 h-3.5 text-[#eb0000] shrink-0" />
          ) : (
            <Clock
              className={`w-3.5 h-3.5 shrink-0 ${
                isScheduled ? 'text-[#eb0000]' : 'text-[#686868] dark:text-[#999999]'
              }`}
            />
          )}
          <span>{scheduleLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
        </button>

        <span className="w-px h-4 bg-[#dcdcdc] dark:bg-[#383838] shrink-0 mx-0.5" />

        {/* Monochrome SBB Filter Chips with subtle authentic transit color dot */}
        {FILTER_PILLS.map(({ key, dotColor }) => {
          const enabled = transitFilters.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleTransitFilter(key)}
              className={`inline-flex items-center gap-1.5 h-8 md:h-7 px-2.5 rounded-md text-xs font-medium border transition-colors shrink-0 cursor-pointer ${
                enabled
                  ? 'bg-white dark:bg-[#252525] border-[#bdbdbd] dark:border-[#4a4a4a] text-[#111111] dark:text-[#f5f5f5]'
                  : 'bg-[#f6f6f6] dark:bg-[#1a1a1a] border-[#e5e5e5] dark:border-[#2c2c2c] text-[#999999] dark:text-[#666666] line-through'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: enabled ? dotColor : '#a3a3a3', opacity: enabled ? 1 : 0.45 }}
              />
              {t.transitFilters[key]}
            </button>
          );
        })}
      </div>

      {/* Row 2: Walking-segment filters below transit types */}
      <div
        data-testid="transit-walk-filters-row"
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar md:flex-wrap md:overflow-visible pb-0.5"
      >
        <span
          title={t.walkSegment}
          aria-hidden="true"
          className="inline-flex items-center justify-center text-[#767676] dark:text-[#888888] shrink-0 mr-0.5"
        >
          <Footprints className="w-3.5 h-3.5" />
        </span>
        <WalkFilterChips />
      </div>

      {menuOpen && <TransitTimeMenu open={menuOpen} onClose={() => setMenuOpen(false)} />}
    </div>
  );
}
