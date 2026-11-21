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
          className="text-[10px] font-bold text-white w-4.5 h-4.5 rounded-[3px] inline-flex items-center justify-center leading-none"
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
  const quickRouteToDestination = useNavStore((s) => s.quickRouteToDestination);
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

  useEffect(() => {
    if (!targetUid) return;
    const id = setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
    return () => clearTimeout(id);
  }, [targetUid]);

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
  const startPlace = waypoints[0]?.place ?? null;
  const endPlace = waypoints[waypoints.length - 1]?.place ?? null;

  const trimmed = query.trim();
  const results = searchState.query === trimmed ? searchState.items : [];
  const showingQuery = trimmed.length >= 2;

  const handleChoose = (place: PlaceResult) => {
    setQuery('');
    closeMobileSearch();
    if (isEnd && !startPlace) {
      void quickRouteToDestination(place);
    } else {
      setWaypointPlace(targetUid, place);
    }
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
    <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-[#f6f6f6] dark:bg-[#151515]">
      {/* SBB Clean Search Header (16px font prevents iOS Safari auto-zoom) */}
      <div className="pt-safe px-3 pb-3 bg-white dark:bg-[#1e1e1e] border-b border-[#e5e5e5] dark:border-[#333333] shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setQuery('');
              closeMobileSearch();
            }}
            className="w-10 h-10 rounded-lg inline-flex items-center justify-center text-[#111111] dark:text-white active:bg-black/5 dark:active:bg-white/10 shrink-0 cursor-pointer"
            aria-label={t.cancel}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative flex-1 flex items-center">
            <span className="absolute left-3 pointer-events-none flex items-center justify-center">
              {isStart ? (
                <span className="w-2.5 h-2.5 rounded-full border-2 border-[#111111] dark:border-white bg-white dark:bg-[#1e1e1e]" />
              ) : isEnd ? (
                <span className="w-2.5 h-2.5 rounded-full bg-[#eb0000]" />
              ) : (
                <span className="w-4 h-4 rounded-full bg-[#212121] dark:bg-white text-[9px] font-bold text-white dark:text-[#111111] inline-flex items-center justify-center">
                  {targetIdx}
                </span>
              )}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                targetWp.place?.name ||
                (isStart && endPlace
                  ? t.chooseStart
                  : isStart
                    ? t.originPlaceholder
                    : isEnd
                      ? t.whereTo
                      : t.searchPlaceholder)
              }
              className="w-full h-11 rounded-lg border border-[#212121] dark:border-[#888888] bg-[#f6f6f6] dark:bg-[#282828] pl-9 pr-9 text-base font-normal text-[#111111] dark:text-white placeholder:text-[#767676] focus:outline-none focus:bg-white dark:focus:bg-[#1e1e1e]"
            />
            {loading ? (
              <Loader2 className="w-4 h-4 text-[#686868] animate-spin absolute right-3" />
            ) : query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-1.5 w-8 h-8 rounded-md inline-flex items-center justify-center text-[#767676] hover:text-[#111111] dark:hover:text-white cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
        {isStart && endPlace && !startPlace && (
          <div className="mt-2 pl-12 pr-1 flex items-center gap-1.5 text-xs text-[#686868] dark:text-[#999999]">
            <span className="w-2 h-2 rounded-full bg-[#eb0000] shrink-0" />
            <span className="truncate">→ {endPlace.name}</span>
          </div>
        )}
      </div>

      {/* Scrollable Results & Clean Swiss Rows */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 pb-safe-lg">
        {!showingQuery ? (
          <>
            {/* Flat SBB Utility Action Rows */}
            <div className="rounded-lg bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] divide-y divide-[#ececec] dark:divide-[#2e2e2e] overflow-hidden">
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locating}
                className="w-full min-h-[48px] flex items-center gap-3 px-3.5 py-2.5 text-left text-sm font-medium text-[#111111] dark:text-white active:bg-[#f6f6f6] dark:active:bg-[#2c2c2c] cursor-pointer"
              >
                {locating ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin text-[#eb0000] shrink-0" />
                ) : (
                  <Crosshair className="w-4.5 h-4.5 text-[#eb0000] shrink-0" />
                )}
                <span>{locating ? t.locating : t.myLocation}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  startMapPickForWaypoint(targetUid);
                }}
                className="w-full min-h-[48px] flex items-center gap-3 px-3.5 py-2.5 text-left text-sm font-medium text-[#111111] dark:text-white active:bg-[#f6f6f6] dark:active:bg-[#2c2c2c] cursor-pointer"
              >
                <MapPinned className="w-4.5 h-4.5 text-[#444444] dark:text-[#b7b7b7] shrink-0" />
                <span>{t.pickOnMap}</span>
              </button>
            </div>

            {favorites.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[#686868] dark:text-[#999999]">
                  {t.favorites}
                </h3>
                <div className="rounded-lg bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] divide-y divide-[#ececec] dark:divide-[#2e2e2e] overflow-hidden">
                  {favorites.slice(0, 6).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleChoose(p)}
                      className="w-full min-h-[50px] flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-[#f6f6f6] dark:active:bg-[#2c2c2c] cursor-pointer"
                    >
                      <Star className="w-4 h-4 text-[#111111] dark:text-white fill-current shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-[#111111] dark:text-white truncate">
                          {p.name}
                        </div>
                        {p.subtitle && (
                          <div className="text-xs text-[#686868] dark:text-[#999999] truncate">
                            {p.subtitle}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {recents.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[#686868] dark:text-[#999999]">
                  {t.recent}
                </h3>
                <div className="rounded-lg bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] divide-y divide-[#ececec] dark:divide-[#2e2e2e] overflow-hidden">
                  {recents.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleChoose(p)}
                      className="w-full min-h-[50px] flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-[#f6f6f6] dark:active:bg-[#2c2c2c] cursor-pointer"
                    >
                      <Clock className="w-4 h-4 text-[#767676] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-[#111111] dark:text-white truncate">
                          {p.name}
                        </div>
                        {p.subtitle && (
                          <div className="text-xs text-[#686868] dark:text-[#999999] truncate">
                            {p.subtitle}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-1.5">
              <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-[#686868] dark:text-[#999999]">
                {t.quickPlaces}
              </h3>
              <div className="rounded-lg bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] divide-y divide-[#ececec] dark:divide-[#2e2e2e] overflow-hidden">
                {MUNICH_QUICK_PLACES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleChoose(p)}
                    className="w-full min-h-[52px] flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-[#f6f6f6] dark:active:bg-[#2c2c2c] cursor-pointer"
                  >
                    {p.category === 'station' ? (
                      <TrainFront className="w-4 h-4 text-[#444444] dark:text-[#b7b7b7] shrink-0" />
                    ) : (
                      <MapPin className="w-4 h-4 text-[#767676] shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[#111111] dark:text-white truncate">
                        {p.name}
                      </div>
                      <div className="text-xs text-[#686868] dark:text-[#999999] truncate">
                        {p.subtitle}
                      </div>
                    </div>
                    <ModeSquareBadges modes={p.transitModes} />
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : loading && results.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#686868]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs font-medium">{t.searchPrompt}...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#686868]">{t.noResults}</div>
        ) : (
          <div className="rounded-lg bg-white dark:bg-[#212121] border border-[#dcdcdc] dark:border-[#333333] divide-y divide-[#ececec] dark:divide-[#2e2e2e] overflow-hidden">
            {results.map((p) => {
              const starred = isFav(p);
              return (
                <div key={p.id} className="flex items-center gap-1 pr-1.5">
                  <button
                    type="button"
                    onClick={() => handleChoose(p)}
                    className="flex-1 min-w-0 min-h-[54px] flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-[#f6f6f6] dark:active:bg-[#2c2c2c] cursor-pointer"
                  >
                    {p.category === 'station' ? (
                      <TrainFront className="w-4 h-4 text-[#444444] dark:text-[#b7b7b7] shrink-0" />
                    ) : (
                      <MapPin className="w-4 h-4 text-[#767676] shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[#111111] dark:text-white truncate">
                        {p.name}
                      </div>
                      {p.subtitle && (
                        <div className="text-xs text-[#686868] dark:text-[#999999] truncate">
                          {p.subtitle}
                        </div>
                      )}
                    </div>
                    <ModeSquareBadges modes={p.transitModes} />
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleFavorite(p)}
                    className="w-10 h-10 rounded-md inline-flex items-center justify-center text-[#767676] hover:text-[#111111] dark:hover:text-white cursor-pointer shrink-0"
                    aria-label={starred ? t.removeFavorite : t.saveFavorite}
                  >
                    <Star
                      className={`w-4 h-4 ${starred ? 'text-[#111111] dark:text-white fill-current' : ''}`}
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
