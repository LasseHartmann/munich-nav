'use client';

import { useState } from 'react';
import { ChevronDown, Clock, Flag } from 'lucide-react';
import { toLocalDateTimeInputValue } from '@/lib/geo';
import { useNowTick } from '@/lib/useNowTick';
import { useNavStore } from '@/store/useNavStore';
import { getTranslations } from '@/lib/i18n';
import type { TransitFilterKey } from '@/lib/types';
import { TransitTimeMenu } from './TransitTimeMenu';
import { WalkFilterChips } from './WalkOptionsBar';

const FILTER_KEYS: TransitFilterKey[] = ['SUBWAY', 'SUBURBAN', 'TRAM', 'BUS', 'REGIONAL'];

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

export function TransitTimeTrigger() {
  const lang = useNavStore((s) => s.lang);
  const departMode = useNavStore((s) => s.departMode);
  const departAtLocal = useNavStore((s) => s.departAtLocal);
  const nowMs = useNowTick();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = getTranslations(lang);

  const scheduleLabel = formatScheduleLabel(departMode, departAtLocal, nowMs, t);
  const isScheduled = departMode !== 'now';

  return (
    <>
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        data-testid="transit-time-trigger"
        className={`inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs transition-colors shrink-0 cursor-pointer tabular-nums ${
          isScheduled
            ? 'font-semibold text-[#111111] dark:text-white bg-black/5 dark:bg-white/10'
            : 'font-medium text-[#111111] dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
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

      {menuOpen && <TransitTimeMenu open={menuOpen} onClose={() => setMenuOpen(false)} />}
    </>
  );
}

export function TransitOptionsBar() {
  const lang = useNavStore((s) => s.lang);
  const transitFilters = useNavStore((s) => s.transitFilters);
  const toggleTransitFilter = useNavStore((s) => s.toggleTransitFilter);
  const t = getTranslations(lang);

  return (
    <div
      data-testid="route-filter-card"
      className="rounded-xl bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] divide-y divide-[#ececec] dark:divide-[#2e2e2e] overflow-hidden"
    >
      {/* Row 1: Walking-segment filters (white by default, solid black when applied) */}
      <div
        data-testid="transit-walk-filters-row"
        className="p-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar md:flex-wrap md:overflow-visible"
      >
        <WalkFilterChips />
      </div>

      {/* Row 2: Transit vehicle modes (all white/selected by default, solid black when excluded) */}
      <div
        data-testid="transit-type-filters-row"
        className="p-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar md:flex-wrap md:overflow-visible"
      >
        {FILTER_KEYS.map((key) => {
          const enabled = transitFilters.includes(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={enabled}
              onClick={() => toggleTransitFilter(key)}
              className={`inline-flex items-center h-8 md:h-7 px-2.5 rounded-md text-xs font-medium border transition-colors shrink-0 cursor-pointer ${
                enabled
                  ? 'bg-white dark:bg-[#2a2a2a] border-[#d4d4d4] dark:border-[#424242] text-[#111111] dark:text-[#f2f2f2] hover:border-[#111111] dark:hover:border-[#888888]'
                  : 'bg-[#212121] border-[#212121] text-white dark:bg-white dark:border-white dark:text-[#111111] line-through'
              }`}
            >
              {t.transitFilters[key]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
