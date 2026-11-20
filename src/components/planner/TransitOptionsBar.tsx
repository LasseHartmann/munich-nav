'use client';

import { Clock } from 'lucide-react';
import { useNavStore } from '@/store/useNavStore';
import { getTranslations } from '@/lib/i18n';
import type { TransitFilterKey } from '@/lib/types';

const FILTER_PILLS: { key: TransitFilterKey; activeBg: string; dotColor: string }[] = [
  { key: 'SUBWAY', activeBg: '#0065ae', dotColor: '#0065ae' },
  { key: 'SUBURBAN', activeBg: '#008e4e', dotColor: '#008e4e' },
  { key: 'TRAM', activeBg: '#e30613', dotColor: '#e30613' },
  { key: 'BUS', activeBg: '#00586a', dotColor: '#00586a' },
  { key: 'REGIONAL', activeBg: '#1e3a8a', dotColor: '#1e3a8a' },
];

export function TransitOptionsBar() {
  const lang = useNavStore((s) => s.lang);
  const departMode = useNavStore((s) => s.departMode);
  const departAtLocal = useNavStore((s) => s.departAtLocal);
  const transitFilters = useNavStore((s) => s.transitFilters);
  const setDepartMode = useNavStore((s) => s.setDepartMode);
  const setDepartAtLocal = useNavStore((s) => s.setDepartAtLocal);
  const toggleTransitFilter = useNavStore((s) => s.toggleTransitFilter);

  const t = getTranslations(lang);

  return (
    <div className="space-y-2 pt-0.5">
      {/* Departure time selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold border border-slate-200/80 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setDepartMode('now')}
            className={`px-3 py-1.5 md:py-1 rounded-lg transition-all cursor-pointer ${
              departMode === 'now'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.leaveNow}
          </button>
          <button
            type="button"
            onClick={() => setDepartMode('departAt')}
            className={`px-3 py-1.5 md:py-1 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              departMode === 'departAt'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {t.departAt}
          </button>
        </div>

        {departMode === 'departAt' && (
          <input
            type="datetime-local"
            value={departAtLocal}
            onChange={(e) => setDepartAtLocal(e.target.value)}
            className="text-base md:text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0065ae]/40"
          />
        )}
      </div>

      {/* Chunky MVV Mode Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
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
    </div>
  );
}
