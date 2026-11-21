'use client';

import { Bike, Car, Footprints, TrainFront } from 'lucide-react';
import { useNavStore } from '@/store/useNavStore';
import { getTranslations } from '@/lib/i18n';
import type { TravelMode } from '@/lib/types';

const MODE_META: {
  id: TravelMode;
  icon: typeof TrainFront;
}[] = [
  { id: 'transit', icon: TrainFront },
  { id: 'foot', icon: Footprints },
  { id: 'bike', icon: Bike },
  { id: 'car', icon: Car },
];

export function ModeSelector() {
  const mode = useNavStore((s) => s.mode);
  const setMode = useNavStore((s) => s.setMode);
  const lang = useNavStore((s) => s.lang);
  const t = getTranslations(lang);

  return (
    <div
      role="tablist"
      aria-label="Travel mode"
      className="grid grid-cols-4 border-b border-[#e5e5e5] dark:border-[#333333]"
    >
      {MODE_META.map(({ id, icon: Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setMode(id)}
            className={`relative flex items-center justify-center gap-1.5 h-10 md:h-9 px-2 text-xs transition-colors cursor-pointer ${
              active
                ? 'font-semibold text-[#111111] dark:text-white'
                : 'font-medium text-[#686868] hover:text-[#111111] dark:text-[#999999] dark:hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0" />
            <span className="truncate">{t.modes[id]}</span>
            {active && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 inset-x-2 h-[2px] bg-[#eb0000]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
