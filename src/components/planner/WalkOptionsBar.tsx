'use client';

import { Accessibility, SlidersHorizontal, Trees, VolumeX } from 'lucide-react';
import { getTranslations } from '@/lib/i18n';
import { useNavStore } from '@/store/useNavStore';

export function WalkOptionsBar() {
  const lang = useNavStore((s) => s.lang);
  const walkOptions = useNavStore((s) => s.walkOptions);
  const toggleWalkOption = useNavStore((s) => s.toggleWalkOption);
  const setWalkIntensity = useNavStore((s) => s.setWalkIntensity);
  const t = getTranslations(lang);

  const hasWeighting = walkOptions.preferGreen || walkOptions.preferQuiet;
  const isScenic = walkOptions.intensity === 'strong';

  return (
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

      {hasWeighting && (
        <>
          <span className="w-px h-4 bg-[#dcdcdc] dark:bg-[#383838] shrink-0 mx-0.5" />
          <button
            type="button"
            onClick={() => setWalkIntensity(isScenic ? 'balanced' : 'strong')}
            className={`inline-flex items-center gap-1.5 h-8 md:h-7 px-2.5 rounded-md text-xs font-medium border transition-colors shrink-0 cursor-pointer ${
              isScenic
                ? 'bg-[#212121] border-[#212121] text-white dark:bg-white dark:border-white dark:text-[#111111]'
                : 'bg-white dark:bg-[#212121] border-[#d4d4d4] dark:border-[#3d3d3d] text-[#444444] dark:text-[#cccccc] hover:border-[#111111]'
            }`}
            title={isScenic ? t.walkFilters.strong : t.walkFilters.balanced}
          >
            <SlidersHorizontal className="w-3 h-3 shrink-0" />
            <span>{isScenic ? t.walkFilters.strong : t.walkFilters.balanced}</span>
          </button>
        </>
      )}
    </div>
  );
}
