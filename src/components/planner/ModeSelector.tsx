'use client';

import { Bike, Car, Footprints, TrainFront } from 'lucide-react';
import { useNavStore } from '@/store/useNavStore';
import { getTranslations } from '@/lib/i18n';
import type { TravelMode } from '@/lib/types';

const MODE_META: {
  id: TravelMode;
  icon: typeof TrainFront;
  activeClass: string;
}[] = [
  {
    id: 'transit',
    icon: TrainFront,
    activeClass: 'bg-[#0065ae] text-white shadow-md shadow-[#0065ae]/30',
  },
  {
    id: 'foot',
    icon: Footprints,
    activeClass: 'bg-teal-600 text-white shadow-md shadow-teal-600/30',
  },
  {
    id: 'bike',
    icon: Bike,
    activeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30',
  },
  {
    id: 'car',
    icon: Car,
    activeClass: 'bg-blue-600 text-white shadow-md shadow-blue-600/30',
  },
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
      className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80"
    >
      {MODE_META.map(({ id, icon: Icon, activeClass }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setMode(id)}
            className={`flex items-center justify-center gap-1.5 h-10 md:h-9 px-2 rounded-xl text-xs font-extrabold tracking-tight transition-all active:scale-[0.97] cursor-pointer ${
              active
                ? activeClass
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700/70'
            }`}
          >
            <Icon className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0" />
            <span className="truncate">{t.modes[id]}</span>
          </button>
        );
      })}
    </div>
  );
}
