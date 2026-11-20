'use client';

import { Clock } from 'lucide-react';
import { useNavStore } from '@/store/useNavStore';
import { getTranslations } from '@/lib/i18n';
import type { TransitFilterKey } from '@/lib/types';

const FILTER_PILLS: { key: TransitFilterKey; dotColor: string }[] = [
  { key: 'SUBWAY', dotColor: '#0065ae' },
  { key: 'SUBURBAN', dotColor: '#008e4e' },
  { key: 'TRAM', dotColor: '#e30613' },
  { key: 'BUS', dotColor: '#00586a' },
  { key: 'REGIONAL', dotColor: '#1e3a8a' },
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
    <div className="space-y-2 pt-1">
      {/* Departure time selector */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px] font-medium border border-slate-200/70 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setDepartMode('now')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
              departMode === 'now'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.leaveNow}
          </button>
          <button
            type="button"
            onClick={() => setDepartMode('departAt')}
            className={`px-2 py-1 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 ${
              departMode === 'departAt'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3 h-3" />
            {t.departAt}
          </button>
        </div>

        {departMode === 'departAt' && (
          <input
            type="datetime-local"
            value={departAtLocal}
            onChange={(e) => setDepartAtLocal(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0065ae]/40"
          />
        )}
      </div>

      {/* MVV Mode Filter Chips */}
      <div className="flex items-center gap-1 flex-wrap">
        {FILTER_PILLS.map(({ key, dotColor }) => {
          const enabled = transitFilters.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleTransitFilter(key)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${
                enabled
                  ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 shadow-2xs'
                  : 'bg-slate-100/70 dark:bg-slate-900/50 border-transparent text-slate-400 dark:text-slate-500 line-through'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: enabled ? dotColor : '#94a3b8' }}
              />
              {t.transitFilters[key]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
