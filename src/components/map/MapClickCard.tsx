'use client';

import { ArrowLeft, Flag, Loader2, MapPin, Plus, Star, X } from 'lucide-react';
import { getTranslations } from '@/lib/i18n';
import { useNavStore } from '@/store/useNavStore';

interface MapClickCardProps {
  variant?: 'floating' | 'sheet';
}

export function MapClickCard({ variant = 'floating' }: MapClickCardProps) {
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

  const innerContent = (
    <>
      <div className="px-4 py-3 flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          {variant === 'sheet' ? (
            <button
              type="button"
              onClick={closeMapClickPin}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center active:scale-95 shrink-0 cursor-pointer"
              aria-label={t.backToTrip}
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-[#0065ae]/12 dark:bg-[#0065ae]/25 text-[#0065ae] dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
              {mapClickPin.loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
              {mapClickPin.loading ? t.mapDropTitle : place.name}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {place.subtitle || `${mapClickPin.lat.toFixed(4)}, ${mapClickPin.lon.toFixed(4)}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => toggleFavorite(place)}
            className="w-9 h-9 rounded-xl inline-flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 cursor-pointer"
            title={isFav ? t.removeFavorite : t.saveFavorite}
          >
            <Star className={`w-4 h-4 ${isFav ? 'text-amber-500 fill-amber-400' : ''}`} />
          </button>
          {variant === 'floating' && (
            <button
              type="button"
              onClick={closeMapClickPin}
              className="w-9 h-9 rounded-xl inline-flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Close pin card"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div
        className={`p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900 grid grid-cols-3 gap-2 ${
          variant === 'sheet' ? 'pb-safe-lg mt-auto' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => applyPlaceAs('start', place)}
          className="h-11 md:h-9 inline-flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
        >
          <MapPin className="w-3.5 h-3.5" />
          {t.startHere}
        </button>
        <button
          type="button"
          onClick={() => applyPlaceAs('stop', place)}
          className="h-11 md:h-9 inline-flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          {t.addAsStop}
        </button>
        <button
          type="button"
          onClick={() => applyPlaceAs('end', place)}
          className="h-11 md:h-9 inline-flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
        >
          <Flag className="w-3.5 h-3.5" />
          {t.goHere}
        </button>
      </div>
    </>
  );

  if (variant === 'sheet') {
    return <div className="flex-1 flex flex-col justify-between">{innerContent}</div>;
  }

  return (
    <div className="hidden md:block fixed z-30 right-3 bottom-4 w-[330px] max-w-[calc(100vw-24px)] rounded-[22px] bg-white/96 dark:bg-[#0f172a]/96 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xl overflow-hidden">
      {innerContent}
    </div>
  );
}
