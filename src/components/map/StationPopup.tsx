'use client';

import { useEffect, useState } from 'react';
import {
  Flag,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Star,
  TrainFront,
  X,
} from 'lucide-react';
import { formatMunichTime } from '@/lib/geo';
import { getTranslations } from '@/lib/i18n';
import { useNavStore } from '@/store/useNavStore';
import type { PlaceResult, StationDeparture } from '@/lib/types';
import { LineBadge } from '@/components/ui/LineBadge';

function minutesUntil(iso: string, refIso: string): number {
  const diff = Math.round((new Date(iso).getTime() - new Date(refIso).getTime()) / 60000);
  return Math.max(0, diff);
}

export function StationPopup() {
  const station = useNavStore((s) => s.selectedStation);
  const setSelectedStation = useNavStore((s) => s.setSelectedStation);
  const applyPlaceAs = useNavStore((s) => s.applyPlaceAs);
  const favorites = useNavStore((s) => s.favorites);
  const toggleFavorite = useNavStore((s) => s.toggleFavorite);
  const lang = useNavStore((s) => s.lang);
  const t = getTranslations(lang);

  const [departuresState, setDeparturesState] = useState<{
    stopId: string | null;
    departures: StationDeparture[];
    updatedAt: string;
    error: string | null;
  }>({ stopId: null, departures: [], updatedAt: '', error: null });
  const [refreshTick, setRefreshTick] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!station) return;
    const stopId = station.stopId;
    const ctrl = new AbortController();

    fetch(`/api/transit/departures?stopId=${encodeURIComponent(stopId)}&n=18`, {
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const data = (await res.json()) as {
          departures?: StationDeparture[];
          updatedAt?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'Failed to load departures');
        if (!ctrl.signal.aborted) {
          setDeparturesState({
            stopId,
            departures: data.departures || [],
            updatedAt: data.updatedAt || new Date().toISOString(),
            error: null,
          });
          setIsRefreshing(false);
        }
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setDeparturesState({
          stopId,
          departures: [],
          updatedAt: '',
          error: err instanceof Error ? err.message : 'Failed to load departures',
        });
        setIsRefreshing(false);
      });

    return () => ctrl.abort();
  }, [station, refreshTick]);

  if (!station) return null;

  const isSameStation = departuresState.stopId === station.stopId;
  const departures = isSameStation ? departuresState.departures : [];
  const updatedAt = isSameStation ? departuresState.updatedAt : '';
  const error = isSameStation ? departuresState.error : null;
  const loading = !isSameStation || isRefreshing;

  const asPlace: PlaceResult = {
    id: `station-${station.stopId}`,
    name: station.name,
    subtitle: 'MVV Station, München',
    lat: station.lat,
    lon: station.lon,
    category: 'station',
    stopId: station.stopId,
    transitModes: station.modes,
  };

  const isFav = favorites.some(
    (f) =>
      f.id === asPlace.id ||
      (Math.abs(f.lat - asPlace.lat) < 0.0002 && Math.abs(f.lon - asPlace.lon) < 0.0002)
  );

  return (
    <div className="fixed z-30 right-3 top-28 md:bottom-4 md:top-auto w-[340px] max-w-[calc(100vw-24px)] max-h-[62vh] flex flex-col rounded-2xl bg-white/96 dark:bg-slate-900/96 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#0065ae] text-white flex items-center justify-center shrink-0">
            <TrainFront className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
              {station.name}
            </h3>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {t.liveDepartures}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => toggleFavorite(asPlace)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title={isFav ? t.removeFavorite : t.saveFavorite}
          >
            <Star className={`w-3.5 h-3.5 ${isFav ? 'text-amber-500 fill-amber-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              setRefreshTick((n) => n + 1);
            }}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Refresh departures"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setSelectedStation(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Close departures"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Departures List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
        {loading && departures.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-[#0065ae]" />
            <span>{t.loadingDepartures}</span>
          </div>
        ) : error ? (
          <div className="p-4 text-xs text-rose-600 dark:text-rose-400 text-center">{error}</div>
        ) : departures.length === 0 ? (
          <div className="p-6 text-xs text-slate-500 text-center">{t.noDepartures}</div>
        ) : (
          departures.map((dep) => {
            const mins = updatedAt ? minutesUntil(dep.realTimeTime, updatedAt) : null;
            return (
              <div
                key={dep.id}
                className={`px-3.5 py-2 flex items-center gap-2.5 text-xs ${
                  dep.cancelled ? 'opacity-55 line-through' : ''
                }`}
              >
                <LineBadge
                  mode={dep.mode}
                  line={dep.line}
                  color={dep.color}
                  textColor={dep.textColor}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {dep.headsign || dep.line}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    {dep.track && (
                      <span>
                        {t.platform} {dep.track}
                      </span>
                    )}
                    {dep.isRealTime && (
                      <span
                        className={
                          dep.delayMinutes >= 1
                            ? 'text-amber-600 dark:text-amber-400 font-semibold'
                            : 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        }
                      >
                        {dep.delayMinutes >= 1 ? `+${dep.delayMinutes} min` : t.onTime}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatMunichTime(dep.realTimeTime, lang)}
                  </div>
                  {mins !== null && (
                    <div className="text-[10px] font-semibold text-[#0065ae] dark:text-sky-400">
                      {mins === 0 ? 'now' : `${mins} min`}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Route Actions */}
      <div className="p-2 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900 grid grid-cols-3 gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => applyPlaceAs('start', asPlace)}
          className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
        >
          <MapPin className="w-3 h-3" />
          {t.startHere}
        </button>
        <button
          type="button"
          onClick={() => applyPlaceAs('stop', asPlace)}
          className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          {t.addAsStop}
        </button>
        <button
          type="button"
          onClick={() => applyPlaceAs('end', asPlace)}
          className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
        >
          <Flag className="w-3 h-3" />
          {t.goHere}
        </button>
      </div>
    </div>
  );
}
