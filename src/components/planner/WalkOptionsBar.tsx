'use client';

import { Accessibility, Trees, VolumeX } from 'lucide-react';
import { getTranslations } from '@/lib/i18n';
import { useNavStore } from '@/store/useNavStore';

export function WalkOptionsBar() {
  const lang = useNavStore((s) => s.lang);
  const walkOptions = useNavStore((s) => s.walkOptions);
  const toggleWalkOption = useNavStore((s) => s.toggleWalkOption);
  const setWalkIntensity = useNavStore((s) => s.setWalkIntensity);
  const t = getTranslations(lang);

  const hasWeighting = walkOptions.preferGreen || walkOptions.preferQuiet;

  return (
    <div className="space-y-2 pt-0.5">
      {/* Walk Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        <button
          type="button"
          onClick={() => toggleWalkOption('preferGreen')}
          className={`inline-flex items-center gap-1.5 h-8 md:h-7 px-2.5 rounded-full text-xs md:text-[11px] font-extrabold border transition-all active:scale-95 shrink-0 cursor-pointer ${
            walkOptions.preferGreen
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-400'
          }`}
        >
          <Trees className="w-3.5 h-3.5 shrink-0" />
          <span>{t.walkFilters.preferGreen}</span>
        </button>

        <button
          type="button"
          onClick={() => toggleWalkOption('preferQuiet')}
          className={`inline-flex items-center gap-1.5 h-8 md:h-7 px-2.5 rounded-full text-xs md:text-[11px] font-extrabold border transition-all active:scale-95 shrink-0 cursor-pointer ${
            walkOptions.preferQuiet
              ? 'bg-teal-600 border-teal-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-400'
          }`}
        >
          <VolumeX className="w-3.5 h-3.5 shrink-0" />
          <span>{t.walkFilters.preferQuiet}</span>
        </button>

        <button
          type="button"
          onClick={() => toggleWalkOption('avoidSteps')}
          className={`inline-flex items-center gap-1.5 h-8 md:h-7 px-2.5 rounded-full text-xs md:text-[11px] font-extrabold border transition-all active:scale-95 shrink-0 cursor-pointer ${
            walkOptions.avoidSteps
              ? 'bg-sky-600 border-sky-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-sky-400'
          }`}
        >
          <Accessibility className="w-3.5 h-3.5 shrink-0" />
          <span>{t.walkFilters.avoidSteps}</span>
        </button>
      </div>

      {/* Balanced vs Scenic/Strong intensity selector (only shown when Green or Quiet is active) */}
      {hasWeighting && (
        <div className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs md:text-[11px] font-bold border border-slate-200/80 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setWalkIntensity('balanced')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              walkOptions.intensity === 'balanced'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.walkFilters.balanced}
          </button>
          <button
            type="button"
            onClick={() => setWalkIntensity('strong')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              walkOptions.intensity === 'strong'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.walkFilters.strong}
          </button>
        </div>
      )}
    </div>
  );
}
