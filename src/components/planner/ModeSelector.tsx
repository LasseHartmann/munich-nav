'use client';

import { Bike, Car, Footprints, TrainFront } from 'lucide-react';
import { useNavStore } from '@/store/useNavStore';
import { getTranslations } from '@/lib/i18n';
import type { TravelMode } from '@/lib/types';

const MODE_META: {
  id: TravelMode;
  icon: typeof TrainFront;
  activeBg: string;
}[] = [
  { id: 'transit', icon: TrainFront, activeBg: 'bg-[#0065ae] text-white shadow-sm' },
  { id: 'foot', icon: Footprints, activeBg: 'bg-teal-600 text-white shadow-sm' },
  { id: 'bike', icon: Bike, activeBg: 'bg-emerald-600 text-white shadow-sm' },
  { id: 'car', icon: Car, activeBg: 'bg-blue-600 text-white shadow-sm' },
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
      className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70"
    >
      {MODE_META.map(({ id, icon: Icon, activeBg }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setMode(id)}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              active
                ? activeBg
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700/60'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t.modes[id]}</span>
          </button>
        );
      })}
    </div>
  );
}
