'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
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
import { useNowTick } from '@/lib/useNowTick';
import { useNavStore } from '@/store/useNavStore';
import type { PlaceResult, StationDeparture } from '@/lib/types';
import { LineBadge } from '@/components/ui/LineBadge';

function minutesUntil(iso: string, refMs: number): number {
  const diff = Math.round((new Date(iso).getTime() - refMs) / 60000);
  return Math.max(0, diff);
}

interface StationPopupProps {
  variant?: 'floating' | 'sheet';
}

export function StationPopup({ variant = 'floating' }: StationPopupProps) {
  const station = useNavStore((s) => s.selectedStation);
  const setSelectedStation = useNavStore((s) => s.setSelectedStation);
  const applyPlaceAs = useNavStore((s) => s.applyPlaceAs);
  const favorites = useNavStore((s) => s.favorites);
  const toggleFavorite = useNavStore((s) => s.toggleFavorite);
  const lang = useNavStore((s) => s.lang);
  const nowMs = useNowTick();
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

  const refMs = nowMs || (updatedAt ? new Date(updatedAt).getTime() : 0);

  const innerContent = (
    <>
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {variant === 'sheet' ? (
            <button
              type="button"
              onClick={() => setSelectedStation(null)}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center active:scale-95 shrink-0 cursor-pointer"
              aria-label={t.backToTrip}
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-[#0065ae] text-white flex items-center justify-center shrink-0 shadow-xs">
              <TrainFront className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
              {station.name}
            </h3>
            <p className="text-[11px] font-bold text-[#0065ae] dark:text-sky-400">
              {t.liveDepartures}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => toggleFavorite(asPlace)}
            className="w-9 h-9 rounded-xl inline-flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 cursor-pointer"
            title={isFav ? t.removeFavorite : t.saveFavorite}
          >
            <Star className={`w-4 h-4 ${isFav ? 'text-amber-500 fill-amber-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              setRefreshTick((n) => n + 1);
            }}
            disabled={loading}
            className="w-9 h-9 rounded-xl inline-flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 cursor-pointer"
            title="Refresh departures"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {variant === 'floating' && (
            <button
              type="button"
              onClick={() => setSelectedStation(null)}
              className="w-9 h-9 rounded-xl inline-flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Close departures"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Departures List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
        {loading && departures.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2.5 text-xs font-semibold text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-[#0065ae]" />
            <span>{t.loadingDepartures}</span>
          </div>
        ) : error ? (
          <div className="p-5 text-xs font-semibold text-rose-600 dark:text-rose-400 text-center">
            {error}
          </div>
        ) : departures.length === 0 ? (
          <div className="p-8 text-xs font-semibold text-slate-500 text-center">
            {t.noDepartures}
          </div>
        ) : (
          departures.map((dep) => {
            const mins = refMs > 0 ? minutesUntil(dep.realTimeTime, refMs) : null;
            return (
              <div
                key={dep.id}
                className={`px-4 py-2.5 flex items-center gap-3 text-xs ${
                  dep.cancelled ? 'opacity-50 line-through' : ''
                }`}
              >
                <LineBadge
                  mode={dep.mode}
                  line={dep.line}
                  color={dep.color}
                  textColor={dep.textColor}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-extrabold text-slate-900 dark:text-white truncate">
                    {dep.headsign || dep.line}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                    {dep.track && (
                      <span className="font-bold">
                        {t.platform} {dep.track}
                      </span>
                    )}
                    {dep.isRealTime && (
                      <span
                        className={
                          dep.delayMinutes >= 1
                            ? 'text-amber-600 dark:text-amber-400 font-extrabold'
                            : 'text-emerald-600 dark:text-emerald-400 font-bold'
                        }
                      >
                        {dep.delayMinutes >= 1 ? `+${dep.delayMinutes} min` : t.onTime}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {mins !== null && (
                    <div
                      className={`text-sm font-extrabold tabular-nums leading-tight ${
                        mins <= 1
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-[#0065ae] dark:text-sky-400'
                      }`}
                    >
                      {mins === 0 ? t.now : `${mins} min`}
                    </div>
                  )}
                  <div className="font-mono text-[11px] font-bold tabular-nums text-slate-400">
                    {formatMunichTime(dep.realTimeTime, lang)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Chunky Thumb-Friendly Route Action Bar */}
      <div
        className={`p-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900 grid grid-cols-3 gap-2 shrink-0 ${
          variant === 'sheet' ? 'pb-safe-lg' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => applyPlaceAs('start', asPlace)}
          className="h-11 md:h-9 inline-flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
        >
          <MapPin className="w-3.5 h-3.5" />
          {t.startHere}
        </button>
        <button
          type="button"
          onClick={() => applyPlaceAs('stop', asPlace)}
          className="h-11 md:h-9 inline-flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          {t.addAsStop}
        </button>
        <button
          type="button"
          onClick={() => applyPlaceAs('end', asPlace)}
          className="h-11 md:h-9 inline-flex items-center justify-center gap-1.5 px-2.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white active:scale-95 transition-all cursor-pointer shadow-xs"
        >
          <Flag className="w-3.5 h-3.5" />
          {t.goHere}
        </button>
      </div>
    </>
  );

  if (variant === 'sheet') {
    return <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{innerContent}</div>;
  }

  return (
    <div className="hidden md:flex fixed z-30 right-3 bottom-4 w-[360px] max-w-[calc(100vw-24px)] max-h-[64vh] flex-col rounded-[24px] bg-white/96 dark:bg-[#0f172a]/96 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xl overflow-hidden">
      {innerContent}
    </div>
  );
}
