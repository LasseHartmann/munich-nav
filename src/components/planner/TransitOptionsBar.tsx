'use client';

import { useState } from 'react';
import { ChevronDown, Clock, Flag } from 'lucide-react';
import { toLocalDateTimeInputValue } from '@/lib/geo';
import { useNowTick } from '@/lib/useNowTick';
import { useNavStore } from '@/store/useNavStore';
import { getTranslations } from '@/lib/i18n';
import type { TransitFilterKey } from '@/lib/types';
import { TransitTimeMenu } from './TransitTimeMenu';

const FILTER_PILLS: { key: TransitFilterKey; activeBg: string; dotColor: string }[] = [
  { key: 'SUBWAY', activeBg: '#0065ae', dotColor: '#0065ae' },
  { key: 'SUBURBAN', activeBg: '#008e4e', dotColor: '#008e4e' },
  { key: 'TRAM', activeBg: '#e30613', dotColor: '#e30613' },
  { key: 'BUS', activeBg: '#00586a', dotColor: '#00586a' },
  { key: 'REGIONAL', activeBg: '#1e3a8a', dotColor: '#1e3a8a' },
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

  const triggerColorClass =
    departMode === 'arriveBy'
      ? 'bg-violet-600 border-violet-600 text-white shadow-xs'
      : departMode === 'departAt'
        ? 'bg-[#0065ae] border-[#0065ae] text-white shadow-xs'
        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-[#0065ae]';

  return (
    <div className="space-y-2 pt-0.5">
      {/* Proper Time Menu Trigger + MVV Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          data-testid="transit-time-trigger"
          className={`inline-flex items-center gap-1.5 h-8 md:h-7 px-3 rounded-full text-xs md:text-[11px] font-extrabold border transition-all active:scale-95 shrink-0 cursor-pointer tabular-nums ${triggerColorClass}`}
        >
          {departMode === 'arriveBy' ? (
            <Flag className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Clock
              className={`w-3.5 h-3.5 shrink-0 ${
                departMode === 'now' ? 'text-[#0065ae] dark:text-sky-400' : 'text-white'
              }`}
            />
          )}
          <span>{scheduleLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-80 shrink-0" />
        </button>

        <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" />

        {FILTER_PILLS.map(({ key, activeBg, dotColor }) => {
          const enabled = transitFilters.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleTransitFilter(key)}
              style={enabled ? { backgroundColor: activeBg, borderColor: activeBg } : undefined}
              className={`inline-flex items-center gap-1.5 h-8 md:h-7 px-2.5 rounded-full text-xs md:text-[11px] font-bold border transition-all active:scale-95 shrink-0 cursor-pointer ${
                enabled
                  ? 'text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 line-through'
              }`}
            >
              {!enabled && (
                <span
                  className="w-2 h-2 rounded-full shrink-0 opacity-45"
                  style={{ backgroundColor: dotColor }}
                />
              )}
              {t.transitFilters[key]}
            </button>
          );
        })}
      </div>

      {/* Key resets internal draft state cleanly each time the menu opens */}
      {menuOpen && <TransitTimeMenu open={menuOpen} onClose={() => setMenuOpen(false)} />}
    </div>
  );
}
