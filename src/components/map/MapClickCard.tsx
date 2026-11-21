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
      <div className="px-4 py-3 bg-white dark:bg-[#1e1e1e] flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          {variant === 'sheet' ? (
            <button
              type="button"
              onClick={closeMapClickPin}
              className="w-8 h-8 rounded-md text-[#111111] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center shrink-0 cursor-pointer"
              aria-label={t.backToTrip}
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
          ) : (
            <div className="mt-0.5 text-[#eb0000] shrink-0">
              {mapClickPin.loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#111111] dark:text-white truncate">
              {mapClickPin.loading ? t.mapDropTitle : place.name}
            </div>
            <div className="text-xs text-[#686868] dark:text-[#999999] truncate mt-0.5">
              {place.subtitle || `${mapClickPin.lat.toFixed(4)}, ${mapClickPin.lon.toFixed(4)}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => toggleFavorite(place)}
            className="w-8 h-8 rounded-md inline-flex items-center justify-center text-[#686868] hover:text-[#111111] dark:hover:text-white cursor-pointer"
            title={isFav ? t.removeFavorite : t.saveFavorite}
          >
            <Star className={`w-4 h-4 ${isFav ? 'text-[#111111] dark:text-white fill-current' : ''}`} />
          </button>
          {variant === 'floating' && (
            <button
              type="button"
              onClick={closeMapClickPin}
              className="w-8 h-8 rounded-md inline-flex items-center justify-center text-[#686868] hover:text-[#111111] dark:hover:text-white cursor-pointer"
              aria-label="Close pin card"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div
        className={`p-3 border-t border-[#e5e5e5] dark:border-[#333333] bg-[#f6f6f6] dark:bg-[#1a1a1a] grid grid-cols-3 gap-2 ${
          variant === 'sheet' ? 'pb-safe-lg mt-auto' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => applyPlaceAs('start', place)}
          className="h-10 md:h-9 inline-flex items-center justify-center gap-1 px-2 rounded-lg text-xs font-medium bg-white hover:bg-[#f0f0f0] dark:bg-[#262626] dark:hover:bg-[#333333] border border-[#d4d4d4] dark:border-[#3d3d3d] text-[#111111] dark:text-white cursor-pointer"
        >
          <MapPin className="w-3.5 h-3.5" />
          {t.startHere}
        </button>
        <button
          type="button"
          onClick={() => applyPlaceAs('stop', place)}
          className="h-10 md:h-9 inline-flex items-center justify-center gap-1 px-2 rounded-lg text-xs font-medium bg-white hover:bg-[#f0f0f0] dark:bg-[#262626] dark:hover:bg-[#333333] border border-[#d4d4d4] dark:border-[#3d3d3d] text-[#111111] dark:text-white cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          {t.addAsStop}
        </button>
        <button
          type="button"
          onClick={() => applyPlaceAs('end', place)}
          className="h-10 md:h-9 inline-flex items-center justify-center gap-1 px-2 rounded-lg text-xs font-semibold bg-[#eb0000] hover:bg-[#c60018] text-white cursor-pointer"
        >
          <Flag className="w-3.5 h-3.5" />
          {t.goHere}
        </button>
      </div>
    </>
  );

  if (variant === 'sheet') {
    return <div className="flex-1 flex flex-col justify-between bg-white dark:bg-[#1e1e1e]">{innerContent}</div>;
  }

  return (
    <div className="hidden md:block fixed z-30 right-3 bottom-4 w-[328px] max-w-[calc(100vw-24px)] rounded-xl bg-white dark:bg-[#212121] border border-[#d4d4d4] dark:border-[#383838] shadow-xl overflow-hidden">
      {innerContent}
    </div>
  );
}
