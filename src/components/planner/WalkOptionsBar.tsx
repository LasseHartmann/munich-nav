'use client';

import { Accessibility, SlidersHorizontal, Trees, VolumeX } from 'lucide-react';
import { getTranslations } from '@/lib/i18n';
import { useNavStore } from '@/store/useNavStore';

/**
 * Shared SBB monochrome filter chips for Green areas, Quiet streets, No stairs,
 * and inline Balanced/Scenic intensity toggle — white by default, solid black when applied.
 */
export function WalkFilterChips({ showNoStairs = true }: { showNoStairs?: boolean } = {}) {
  const lang = useNavStore((s) => s.lang);
  const walkOptions = useNavStore((s) => s.walkOptions);
  const toggleWalkOption = useNavStore((s) => s.toggleWalkOption);
  const setWalkIntensity = useNavStore((s) => s.setWalkIntensity);
  const t = getTranslations(lang);

  const hasWeighting = walkOptions.preferGreen || walkOptions.preferQuiet;
  const isScenic = walkOptions.intensity === 'strong';

  const chipClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 h-8 md:h-7 px-2.5 rounded-md text-xs font-medium border transition-colors shrink-0 cursor-pointer ${
      active
        ? 'bg-[#212121] border-[#212121] text-white dark:bg-white dark:border-white dark:text-[#111111]'
        : 'bg-white dark:bg-[#2a2a2a] border-[#d4d4d4] dark:border-[#424242] text-[#111111] dark:text-[#f2f2f2] hover:border-[#111111] dark:hover:border-[#888888]'
    }`;

  return (
    <>
      <button
        type="button"
        data-testid="filter-green"
        onClick={() => toggleWalkOption('preferGreen')}
        className={chipClass(walkOptions.preferGreen)}
      >
        <Trees className="w-3.5 h-3.5 shrink-0" />
        <span>{t.walkFilters.preferGreen}</span>
      </button>

      <button
        type="button"
        data-testid="filter-quiet"
        onClick={() => toggleWalkOption('preferQuiet')}
        className={chipClass(walkOptions.preferQuiet)}
      >
        <VolumeX className="w-3.5 h-3.5 shrink-0" />
        <span>{t.walkFilters.preferQuiet}</span>
      </button>

      {showNoStairs && (
        <button
          type="button"
          data-testid="filter-no-stairs"
          onClick={() => toggleWalkOption('avoidSteps')}
          className={chipClass(walkOptions.avoidSteps)}
        >
          <Accessibility className="w-3.5 h-3.5 shrink-0" />
          <span>{t.walkFilters.avoidSteps}</span>
        </button>
      )}

      {hasWeighting && (
        <>
          <span className="w-px h-4 bg-[#dcdcdc] dark:bg-[#383838] shrink-0 mx-0.5" />
          <button
            type="button"
            data-testid="filter-intensity"
            onClick={() => setWalkIntensity(isScenic ? 'balanced' : 'strong')}
            className={chipClass(isScenic)}
            title={isScenic ? t.walkFilters.strong : t.walkFilters.balanced}
          >
            <SlidersHorizontal className="w-3 h-3 shrink-0" />
            <span>{isScenic ? t.walkFilters.strong : t.walkFilters.balanced}</span>
          </button>
        </>
      )}
    </>
  );
}

export function WalkOptionsBar() {
  const mode = useNavStore((s) => s.mode);

  return (
    <div
      data-testid="route-filter-card"
      className="rounded-xl bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] p-2 overflow-hidden"
    >
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar md:flex-wrap md:overflow-visible">
        <WalkFilterChips showNoStairs={mode !== 'bike'} />
      </div>
    </div>
  );
}
