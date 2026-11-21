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
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        <button
          type="button"
          onClick={() => toggleWalkOption('preferGreen')}
          className={`inline-flex items-center gap-1.5 h-8 md:h-7 px-2.5 rounded-md text-xs font-medium border transition-colors shrink-0 cursor-pointer ${
            walkOptions.preferGreen
              ? 'bg-[#212121] border-[#212121] text-white dark:bg-white dark:border-white dark:text-[#111111]'
              : 'bg-white dark:bg-[#212121] border-[#d4d4d4] dark:border-[#3d3d3d] text-[#212121] dark:text-[#e5e5e5] hover:border-[#111111]'
          }`}
        >
          <Trees className="w-3.5 h-3.5 shrink-0" />
          <span>{t.walkFilters.preferGreen}</span>
        </button>

        <button
          type="button"
          onClick={() => toggleWalkOption('preferQuiet')}
          className={`inline-flex items-center gap-1.5 h-8 md:h-7 px-2.5 rounded-md text-xs font-medium border transition-colors shrink-0 cursor-pointer ${
            walkOptions.preferQuiet
              ? 'bg-[#212121] border-[#212121] text-white dark:bg-white dark:border-white dark:text-[#111111]'
              : 'bg-white dark:bg-[#212121] border-[#d4d4d4] dark:border-[#3d3d3d] text-[#212121] dark:text-[#e5e5e5] hover:border-[#111111]'
          }`}
        >
          <VolumeX className="w-3.5 h-3.5 shrink-0" />
          <span>{t.walkFilters.preferQuiet}</span>
        </button>

        <button
          type="button"
          onClick={() => toggleWalkOption('avoidSteps')}
          className={`inline-flex items-center gap-1.5 h-8 md:h-7 px-2.5 rounded-md text-xs font-medium border transition-colors shrink-0 cursor-pointer ${
            walkOptions.avoidSteps
              ? 'bg-[#212121] border-[#212121] text-white dark:bg-white dark:border-white dark:text-[#111111]'
              : 'bg-white dark:bg-[#212121] border-[#d4d4d4] dark:border-[#3d3d3d] text-[#212121] dark:text-[#e5e5e5] hover:border-[#111111]'
          }`}
        >
          <Accessibility className="w-3.5 h-3.5 shrink-0" />
          <span>{t.walkFilters.avoidSteps}</span>
        </button>
      </div>

      {hasWeighting && (
        <div className="inline-flex items-center rounded-md bg-[#ececec] dark:bg-[#2a2a2a] p-0.5 text-xs font-medium border border-[#dcdcdc] dark:border-[#383838]">
          <button
            type="button"
            onClick={() => setWalkIntensity('balanced')}
            className={`px-3 py-1 rounded-[5px] transition-colors cursor-pointer ${
              walkOptions.intensity === 'balanced'
                ? 'bg-white dark:bg-[#1a1a1a] text-[#111111] dark:text-white font-semibold'
                : 'text-[#686868] dark:text-[#999999] hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            {t.walkFilters.balanced}
          </button>
          <button
            type="button"
            onClick={() => setWalkIntensity('strong')}
            className={`px-3 py-1 rounded-[5px] transition-colors cursor-pointer ${
              walkOptions.intensity === 'strong'
                ? 'bg-white dark:bg-[#1a1a1a] text-[#111111] dark:text-white font-semibold'
                : 'text-[#686868] dark:text-[#999999] hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            {t.walkFilters.strong}
          </button>
        </div>
      )}
    </div>
  );
}
