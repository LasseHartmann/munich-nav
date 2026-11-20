'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Crosshair,
  Loader2,
  MapPin,
  MapPinned,
  Star,
  TrainFront,
  X,
} from 'lucide-react';
import { MUNICH_QUICK_PLACES } from '@/lib/geo';
import { getTranslations } from '@/lib/i18n';
import { useNavStore } from '@/store/useNavStore';
import type { PlaceResult } from '@/lib/types';

function ModeSquareBadges({ modes }: { modes?: string[] }) {
  if (!modes || modes.length === 0) return null;
  const set = new Set(modes.map((m) => m.toUpperCase()));
  const chips: { label: string; bg: string }[] = [];
  if (set.has('SUBWAY') || set.has('METRO')) chips.push({ label: 'U', bg: '#0065ae' });
  if (set.has('SUBURBAN')) chips.push({ label: 'S', bg: '#008e4e' });
  if (set.has('TRAM')) chips.push({ label: 'T', bg: '#e30613' });
  if (set.has('BUS')) chips.push({ label: 'B', bg: '#00586a' });
  if (set.has('REGIONAL_RAIL') || set.has('REGIONAL_FAST_RAIL')) {
    chips.push({ label: 'R', bg: '#1e3a8a' });
  }
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      {chips.slice(0, 4).map((c) => (
        <span
          key={c.label}
          style={{ backgroundColor: c.bg }}
          className="text-[10px] font-extrabold text-white w-5 h-5 rounded-md inline-flex items-center justify-center leading-none shadow-2xs"
        >
          {c.label}
        </span>
      ))}
    </span>
  );
}

export function MobileSearchModal() {
  const targetUid = useNavStore((s) => s.mobileSearchTargetUid);
  const waypoints = useNavStore((s) => s.waypoints);
  const lang = useNavStore((s) => s.lang);
  const favorites = useNavStore((s) => s.favorites);
  const recents = useNavStore((s) => s.recents);
  const closeMobileSearch = useNavStore((s) => s.closeMobileSearch);
  const setWaypointPlace = useNavStore((s) => s.setWaypointPlace);
  const startMapPickForWaypoint = useNavStore((s) => s.startMapPickForWaypoint);
  const toggleFavorite = useNavStore((s) => s.toggleFavorite);

  const t = getTranslations(lang);
  const targetIdx = waypoints.findIndex((w) => w.uid === targetUid);
  const targetWp = targetIdx >= 0 ? waypoints[targetIdx] : null;

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchState, setSearchState] = useState<{ query: string; items: PlaceResult[] }>({
    query: '',
    items: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Focus input smoothly when opened
  useEffect(() => {
    if (!targetUid) return;
    const id = setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
    return () => clearTimeout(id);
  }, [targetUid]);

  // Debounced search
  useEffect(() => {
    if (!targetUid) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(trimmed)}&lang=${lang}`,
          { signal: ctrl.signal }
        );
        const data = (await res.json()) as { results?: PlaceResult[] };
        if (!ctrl.signal.aborted) {
          setSearchState({ query: trimmed, items: data.results || [] });
          setLoading(false);
        }
      } catch {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query, targetUid, lang]);

  if (!targetUid || !targetWp) return null;

  const isStart = targetIdx === 0;
  const isEnd = targetIdx === waypoints.length - 1;
  const badgeLabel = isStart ? 'A' : isEnd ? 'B' : String(targetIdx);
  const badgeColor = isStart ? '#10b981' : isEnd ? '#f43f5e' : '#f59e0b';

  const trimmed = query.trim();
  const results = searchState.query === trimmed ? searchState.items : [];
  const showingQuery = trimmed.length >= 2;

  const handleChoose = (place: PlaceResult) => {
    setQuery('');
    closeMobileSearch();
    setWaypointPlace(targetUid, place);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const res = await fetch(
            `/api/geocode?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&lang=${lang}`
          );
          const data = (await res.json()) as { place?: PlaceResult };
          const place: PlaceResult = data.place
            ? { ...data.place, category: 'gps', name: data.place.name || t.myLocation }
            : {
                id: `gps-${lat.toFixed(5)}-${lon.toFixed(5)}`,
                name: t.myLocation,
                subtitle: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                lat,
                lon,
                category: 'gps',
              };
          handleChoose(place);
        } catch {
          handleChoose({
            id: `gps-${lat.toFixed(5)}-${lon.toFixed(5)}`,
            name: t.myLocation,
            subtitle: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
            lat,
            lon,
            category: 'gps',
          });
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 9000 }
    );
  };

  const isFav = (p: PlaceResult) =>
    favorites.some(
      (f) =>
        f.id === p.id ||
        (Math.abs(f.lat - p.lat) < 0.0002 && Math.abs(f.lon - p.lon) < 0.0002)
    );

  return (
    <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-[#f4f6f9] dark:bg-[#0b1120]">
      {/* Sticky Top Search Bar (16px font prevents iOS Safari zoom!) */}
      <div className="pt-safe px-3 pb-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setQuery('');
              closeMobileSearch();
            }}
            className="w-11 h-11 rounded-2xl inline-flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-100 active:scale-95 shrink-0 cursor-pointer"
            aria-label={t.cancel}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative flex-1 flex items-center">
            <span
              style={{ backgroundColor: badgeColor }}
              className="absolute left-3 w-6 h-6 rounded-full text-[11px] font-extrabold text-white inline-flex items-center justify-center pointer-events-none shadow-xs"
            >
              {badgeLabel}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={targetWp.place?.name || t.searchPlaceholder}
              className="w-full h-12 rounded-2xl border-2 border-[#0065ae] bg-slate-50 dark:bg-slate-800 pl-11 pr-10 text-base font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
            {loading ? (
              <Loader2 className="w-5 h-5 text-[#0065ae] animate-spin absolute right-3" />
            ) : query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 w-8 h-8 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Scrollable Results & Quick Actions */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 pb-safe-lg">
        {!showingQuery ? (
          <>
            {/* Quick Action Tiles */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locating}
                className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-[#0065ae] text-white font-bold text-sm shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
              >
                {locating ? (
                  <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                ) : (
                  <Crosshair className="w-5 h-5 shrink-0" />
                )}
                <span className="truncate">{locating ? t.locating : t.myLocation}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  startMapPickForWaypoint(targetUid);
                }}
                className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
              >
                <MapPinned className="w-5 h-5 shrink-0" />
                <span className="truncate">{t.pickOnMap}</span>
              </button>
            </div>

            {/* Favorites */}
            {favorites.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="px-1 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t.favorites}
                </h3>
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs">
                  {favorites.slice(0, 6).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleChoose(p)}
                      className="w-full min-h-[54px] flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center shrink-0">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {p.name}
                        </div>
                        {p.subtitle && (
                          <div className="text-xs text-slate-500 truncate">{p.subtitle}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Recent */}
            {recents.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="px-1 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t.recent}
                </h3>
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs">
                  {recents.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleChoose(p)}
                      className="w-full min-h-[54px] flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {p.name}
                        </div>
                        {p.subtitle && (
                          <div className="text-xs text-slate-500 truncate">{p.subtitle}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Popular Munich Places */}
            <section className="space-y-1.5">
              <h3 className="px-1 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t.quickPlaces}
              </h3>
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs">
                {MUNICH_QUICK_PLACES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleChoose(p)}
                    className="w-full min-h-[56px] flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        p.category === 'station'
                          ? 'bg-[#0065ae]/12 text-[#0065ae] dark:bg-[#0065ae]/25 dark:text-sky-400'
                          : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {p.category === 'station' ? (
                        <TrainFront className="w-4.5 h-4.5" />
                      ) : (
                        <MapPin className="w-4.5 h-4.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {p.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{p.subtitle}</div>
                    </div>
                    <ModeSquareBadges modes={p.transitModes} />
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : loading && results.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-[#0065ae]" />
            <span className="text-sm font-semibold">{t.searchPrompt}...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="py-12 text-center text-sm font-medium text-slate-500">{t.noResults}</div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs">
            {results.map((p) => {
              const starred = isFav(p);
              return (
                <div key={p.id} className="flex items-center gap-1 pr-2">
                  <button
                    type="button"
                    onClick={() => handleChoose(p)}
                    className="flex-1 min-w-0 min-h-[58px] flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        p.category === 'station'
                          ? 'bg-[#0065ae]/12 text-[#0065ae] dark:bg-[#0065ae]/25 dark:text-sky-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {p.category === 'station' ? (
                        <TrainFront className="w-4.5 h-4.5" />
                      ) : (
                        <MapPin className="w-4.5 h-4.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {p.name}
                      </div>
                      {p.subtitle && (
                        <div className="text-xs text-slate-500 truncate">{p.subtitle}</div>
                      )}
                    </div>
                    <ModeSquareBadges modes={p.transitModes} />
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleFavorite(p)}
                    className="w-10 h-10 rounded-xl inline-flex items-center justify-center text-slate-400 active:scale-90 cursor-pointer shrink-0"
                    aria-label={starred ? t.removeFavorite : t.saveFavorite}
                  >
                    <Star
                      className={`w-4.5 h-4.5 ${starred ? 'text-amber-500 fill-amber-400' : ''}`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
