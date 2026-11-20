'use client';

import { Flag, Loader2, MapPin, Plus, Star, X } from 'lucide-react';
import { getTranslations } from '@/lib/i18n';
import { useNavStore } from '@/store/useNavStore';

export function MapClickCard() {
  const mapClickPin = useNavStore((s) => s.mapClickPin);
  const closeMapClickPin = useNavStore((s) => s.closeMapClickPin);
  const applyPlaceAs = useNavStore((s) => s.applyPlaceAs);
  const favorites = useNavStore((s) => s.favorites);
  const toggleFavorite = useNavStore((s) => s.toggleFavorite);
  const lang = useNavStore((s) => s.lang);
  const t = getTranslations(lang);

  if (!mapClickPin) return null;

  const place = mapClickPin.place ?? {
    id: `pin-${mapClickPin.lat.toFixed(5)}-${mapClickPin.lon.toFixed(5)}`,
    name: `${mapClickPin.lat.toFixed(5)}, ${mapClickPin.lon.toFixed(5)}`,
    subtitle: 'München',
    lat: mapClickPin.lat,
    lon: mapClickPin.lon,
    category: 'pin' as const,
  };

  const isFav = favorites.some(
    (f) => Math.abs(f.lat - place.lat) < 0.0002 && Math.abs(f.lon - place.lon) < 0.0002
  );

  return (
    <div className="fixed z-30 right-3 bottom-36 md:bottom-4 w-[310px] max-w-[calc(100vw-24px)] rounded-2xl bg-white/96 dark:bg-slate-900/96 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 shadow-2xl overflow-hidden">
      <div className="px-3.5 py-2.5 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0065ae] flex items-center justify-center shrink-0 mt-0.5">
            {mapClickPin.loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MapPin className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {mapClickPin.loading ? t.mapDropTitle : place.name}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {place.subtitle || `${mapClickPin.lat.toFixed(4)}, ${mapClickPin.lon.toFixed(4)}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => toggleFavorite(place)}
            className="p-1 rounded-lg text-slate-400 hover:text-amber-500 cursor-pointer"
            title={isFav ? t.removeFavorite : t.saveFavorite}
          >
            <Star className={`w-3.5 h-3.5 ${isFav ? 'text-amber-500 fill-amber-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={closeMapClickPin}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            aria-label="Close pin card"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => applyPlaceAs('start', place)}
          className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
        >
          <MapPin className="w-3 h-3" />
          {t.startHere}
        </button>
        <button
          type="button"
          onClick={() => applyPlaceAs('stop', place)}
          className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          {t.addAsStop}
        </button>
        <button
          type="button"
          onClick={() => applyPlaceAs('end', place)}
          className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
        >
          <Flag className="w-3 h-3" />
          {t.goHere}
        </button>
      </div>
    </div>
  );
}
