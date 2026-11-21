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
      {/* Clean SBB Departure Board Header */}
      <div className="px-4 py-2.5 bg-white dark:bg-[#1e1e1e] border-b border-[#e5e5e5] dark:border-[#333333] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {variant === 'sheet' && (
            <button
              type="button"
              onClick={() => setSelectedStation(null)}
              className="w-8 h-8 rounded-md text-[#111111] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center shrink-0 cursor-pointer"
              aria-label={t.backToTrip}
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#111111] dark:text-white truncate">
              {station.name}
            </h3>
            <p className="text-[11px] text-[#686868] dark:text-[#999999]">{t.liveDepartures}</p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => toggleFavorite(asPlace)}
            className="w-8 h-8 rounded-md inline-flex items-center justify-center text-[#686868] hover:text-[#111111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            title={isFav ? t.removeFavorite : t.saveFavorite}
          >
            <Star className={`w-4 h-4 ${isFav ? 'text-[#111111] dark:text-white fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              setRefreshTick((n) => n + 1);
            }}
            disabled={loading}
            className="w-8 h-8 rounded-md inline-flex items-center justify-center text-[#686868] hover:text-[#111111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            title="Refresh departures"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {variant === 'floating' && (
            <button
              type="button"
              onClick={() => setSelectedStation(null)}
              className="w-8 h-8 rounded-md inline-flex items-center justify-center text-[#686868] hover:text-[#111111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              aria-label="Close departures"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Crisp SBB Timetable Departures List */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#212121] divide-y divide-[#ececec] dark:divide-[#2e2e2e]">
        {loading && departures.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-xs text-[#686868]">
            <Loader2 className="w-5 h-5 animate-spin text-[#eb0000]" />
            <span>{t.loadingDepartures}</span>
          </div>
        ) : error ? (
          <div className="p-5 text-xs text-[#eb0000] text-center">{error}</div>
        ) : departures.length === 0 ? (
          <div className="p-8 text-xs text-[#686868] text-center">{t.noDepartures}</div>
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
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[#111111] dark:text-white truncate">
                    {dep.headsign || dep.line}
                  </div>
                  <div className="text-[11px] text-[#686868] dark:text-[#999999] flex items-center gap-2 mt-0.5">
                    {dep.track && (
                      <span>
                        {t.platform} {dep.track}
                      </span>
                    )}
                    {dep.isRealTime && (
                      <span
                        className={
                          dep.delayMinutes >= 1
                            ? 'text-[#eb0000] font-semibold'
                            : 'text-[#007a3e] dark:text-[#34d399] font-medium'
                        }
                      >
                        {dep.delayMinutes >= 1 ? `+${dep.delayMinutes}'` : t.onTime}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {mins !== null && (
                    <div
                      className={`text-sm font-bold tabular-nums leading-tight ${
                        mins <= 1 ? 'text-[#eb0000]' : 'text-[#111111] dark:text-white'
                      }`}
                    >
                      {mins === 0 ? t.now : `${mins}'`}
                    </div>
                  )}
                  <div className="font-mono text-[11px] tabular-nums text-[#767676]">
                    {formatMunichTime(dep.realTimeTime, lang)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Restrained SBB Action Footer */}
      <div
        className={`p-3 border-t border-[#e5e5e5] dark:border-[#333333] bg-[#f6f6f6] dark:bg-[#1a1a1a] grid grid-cols-3 gap-2 shrink-0 ${
          variant === 'sheet' ? 'pb-safe-lg' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => applyPlaceAs('start', asPlace)}
          className="h-10 md:h-9 inline-flex items-center justify-center gap-1 px-2 rounded-lg text-xs font-medium bg-white hover:bg-[#f0f0f0] dark:bg-[#262626] dark:hover:bg-[#333333] border border-[#d4d4d4] dark:border-[#3d3d3d] text-[#111111] dark:text-white cursor-pointer"
        >
          <MapPin className="w-3.5 h-3.5" />
          {t.startHere}
        </button>
        <button
          type="button"
          onClick={() => applyPlaceAs('stop', asPlace)}
          className="h-10 md:h-9 inline-flex items-center justify-center gap-1 px-2 rounded-lg text-xs font-medium bg-white hover:bg-[#f0f0f0] dark:bg-[#262626] dark:hover:bg-[#333333] border border-[#d4d4d4] dark:border-[#3d3d3d] text-[#111111] dark:text-white cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          {t.addAsStop}
        </button>
        <button
          type="button"
          onClick={() => applyPlaceAs('end', asPlace)}
          className="h-10 md:h-9 inline-flex items-center justify-center gap-1 px-2 rounded-lg text-xs font-semibold bg-[#eb0000] hover:bg-[#c60018] text-white cursor-pointer"
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
    <div className="hidden md:flex fixed z-30 right-3 bottom-4 w-[356px] max-w-[calc(100vw-24px)] max-h-[64vh] flex-col rounded-xl bg-white dark:bg-[#212121] border border-[#d4d4d4] dark:border-[#383838] shadow-xl overflow-hidden">
      {innerContent}
    </div>
  );
}
