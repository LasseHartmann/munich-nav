'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Clock,
  Crosshair,
  Loader2,
  MapPin,
  Search,
  Star,
  TrainFront,
  X,
} from 'lucide-react';
import { MUNICH_QUICK_PLACES } from '@/lib/geo';
import { getTranslations } from '@/lib/i18n';
import { useNavStore } from '@/store/useNavStore';
import type { PlaceResult } from '@/lib/types';

interface PlaceSearchInputProps {
  waypointUid: string;
  value: PlaceResult | null;
  placeholder: string;
  onSelect: (place: PlaceResult | null) => void;
}

function ModeMiniDots({ modes }: { modes?: string[] }) {
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
    <span className="inline-flex items-center gap-0.5 shrink-0">
      {chips.slice(0, 4).map((c) => (
        <span
          key={c.label}
          style={{ backgroundColor: c.bg }}
          className="text-[9px] font-extrabold text-white w-4 h-4 rounded-sm inline-flex items-center justify-center leading-none"
        >
          {c.label}
        </span>
      ))}
    </span>
  );
}

export function PlaceSearchInput({
  waypointUid,
  value,
  placeholder,
  onSelect,
}: PlaceSearchInputProps) {
  const lang = useNavStore((s) => s.lang);
  const favorites = useNavStore((s) => s.favorites);
  const recents = useNavStore((s) => s.recents);
  const toggleFavorite = useNavStore((s) => s.toggleFavorite);
  const openMobileSearch = useNavStore((s) => s.openMobileSearch);
  const t = getTranslations(lang);

  const [draftQuery, setDraftQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchState, setSearchState] = useState<{ query: string; items: PlaceResult[] }>({
    query: '',
    items: [],
  });

  const query = draftQuery !== null ? draftQuery : (value?.name ?? '');
  const results = searchState.query === query.trim() ? searchState.items : [];

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setDraftQuery(null);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed === value?.name) {
      return;
    }

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
        if (!ctrl.signal.aborted) {
          setLoading(false);
        }
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [query, open, lang, value?.name]);

  const handleChoose = (place: PlaceResult) => {
    setDraftQuery(null);
    setOpen(false);
    onSelect(place);
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
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  };

  const isFav = (p: PlaceResult) =>
    favorites.some(
      (f) =>
        f.id === p.id ||
        (Math.abs(f.lat - p.lat) < 0.0002 && Math.abs(f.lon - p.lon) < 0.0002)
    );

  const showSuggestions = open && (query.trim().length < 2 || query.trim() === value?.name);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      {/* Mobile: 44px thumb-friendly trigger that opens Full-Screen Mobile Search Overlay */}
      <div className="md:hidden flex items-center gap-1">
        <button
          type="button"
          onClick={() => openMobileSearch(waypointUid)}
          className="flex-1 min-w-0 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/90 px-3 flex items-center gap-2 text-left active:bg-slate-100 dark:active:bg-slate-700 transition-colors cursor-pointer"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span
            className={`text-sm truncate ${
              value
                ? 'font-bold text-slate-900 dark:text-white'
                : 'font-medium text-slate-400 dark:text-slate-500'
            }`}
          >
            {value ? value.name : placeholder}
          </span>
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="w-9 h-11 rounded-xl inline-flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 active:scale-95 shrink-0 cursor-pointer"
            aria-label="Clear stop"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Desktop: Crisp inline autocomplete input */}
      <div className="hidden md:flex relative items-center">
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setDraftQuery(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/90 px-3 pr-8 text-[13px] font-semibold text-slate-900 dark:text-slate-100 placeholder:font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0065ae]/40 focus:border-[#0065ae] transition-all"
        />
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-[#0065ae] animate-spin absolute right-2.5 pointer-events-none" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setDraftQuery('');
              onSelect(null);
              setOpen(true);
            }}
            className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            aria-label="Clear input"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {open && (
        <div className="hidden md:block absolute left-0 right-0 top-full mt-1.5 z-50 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl divide-y divide-slate-100 dark:divide-slate-800">
          {showSuggestions ? (
            <>
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locating}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-bold text-[#0065ae] dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
              >
                {locating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Crosshair className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{locating ? t.locating : t.myLocation}</span>
              </button>

              {favorites.length > 0 && (
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {t.favorites}
                  </div>
                  {favorites.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleChoose(p)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {p.name}
                        </div>
                        {p.subtitle && (
                          <div className="text-[11px] text-slate-500 truncate">{p.subtitle}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {recents.length > 0 && (
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {t.recent}
                  </div>
                  {recents.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleChoose(p)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {p.name}
                        </div>
                        {p.subtitle && (
                          <div className="text-[11px] text-slate-500 truncate">{p.subtitle}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="py-1">
                <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  {t.quickPlaces}
                </div>
                {MUNICH_QUICK_PLACES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleChoose(p)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer"
                  >
                    {p.category === 'station' ? (
                      <TrainFront className="w-3.5 h-3.5 text-[#0065ae] shrink-0" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{p.subtitle}</div>
                    </div>
                    <ModeMiniDots modes={p.transitModes} />
                  </button>
                ))}
              </div>
            </>
          ) : loading && results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs font-medium text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0065ae]" />
              <span>{t.searchPrompt}...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-slate-500">{t.noResults}</div>
          ) : (
            <div className="py-1">
              {results.map((p) => {
                const starred = isFav(p);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-1 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  >
                    <button
                      type="button"
                      onClick={() => handleChoose(p)}
                      className="flex items-center gap-2 flex-1 min-w-0 py-1 px-1 text-left cursor-pointer"
                    >
                      {p.category === 'station' ? (
                        <TrainFront className="w-3.5 h-3.5 text-[#0065ae] shrink-0" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {p.name}
                        </div>
                        {p.subtitle && (
                          <div className="text-[11px] text-slate-500 truncate">{p.subtitle}</div>
                        )}
                      </div>
                      <ModeMiniDots modes={p.transitModes} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(p);
                      }}
                      title={starred ? t.removeFavorite : t.saveFavorite}
                      className="p-1.5 text-slate-400 hover:text-amber-500 cursor-pointer shrink-0"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${starred ? 'text-amber-500 fill-amber-400' : ''}`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
