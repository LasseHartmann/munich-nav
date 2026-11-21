'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Clock,
  Crosshair,
  Loader2,
  MapPin,
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
          className="text-[9px] font-bold text-white w-4 h-4 rounded-[3px] inline-flex items-center justify-center leading-none"
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
      {/* Mobile: 42px SBB flat input trigger opening Full-Screen Search */}
      <div className="md:hidden flex items-center gap-1">
        <button
          type="button"
          onClick={() => openMobileSearch(waypointUid)}
          className="flex-1 min-w-0 h-10 rounded-lg border border-[#d4d4d4] dark:border-[#3d3d3d] bg-[#f6f6f6] dark:bg-[#262626] px-3 flex items-center text-left active:bg-[#ececec] dark:active:bg-[#303030] transition-colors cursor-pointer"
        >
          <span
            className={`text-sm truncate ${
              value
                ? 'font-medium text-[#111111] dark:text-white'
                : 'font-normal text-[#767676] dark:text-[#888888]'
            }`}
          >
            {value ? value.name : placeholder}
          </span>
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="w-8 h-10 rounded-md inline-flex items-center justify-center text-[#767676] hover:text-[#111111] dark:hover:text-white shrink-0 cursor-pointer"
            aria-label="Clear stop"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Desktop: Clean SBB flat inline input */}
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
          className="w-full h-9 rounded-lg border border-[#d4d4d4] dark:border-[#3d3d3d] bg-[#f6f6f6] dark:bg-[#262626] px-3 pr-7 text-[13px] font-medium text-[#111111] dark:text-white placeholder:font-normal placeholder:text-[#767676] dark:placeholder:text-[#888888] focus:bg-white dark:focus:bg-[#1e1e1e] focus:outline-none focus:border-[#111111] dark:focus:border-white transition-colors"
        />
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-[#686868] animate-spin absolute right-2.5 pointer-events-none" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setDraftQuery('');
              onSelect(null);
              setOpen(true);
            }}
            className="absolute right-2 p-0.5 text-[#767676] hover:text-[#111111] dark:hover:text-white cursor-pointer"
            aria-label="Clear input"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {open && (
        <div className="hidden md:block absolute left-0 right-0 top-full mt-1 z-50 max-h-72 overflow-y-auto rounded-lg border border-[#d4d4d4] dark:border-[#3d3d3d] bg-white dark:bg-[#1e1e1e] shadow-lg divide-y divide-[#ececec] dark:divide-[#2e2e2e]">
          {showSuggestions ? (
            <>
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locating}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-medium text-[#111111] dark:text-white hover:bg-[#f6f6f6] dark:hover:bg-[#282828] transition-colors cursor-pointer"
              >
                {locating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#eb0000] shrink-0" />
                ) : (
                  <Crosshair className="w-3.5 h-3.5 text-[#eb0000] shrink-0" />
                )}
                <span>{locating ? t.locating : t.myLocation}</span>
              </button>

              {favorites.length > 0 && (
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#767676]">
                    {t.favorites}
                  </div>
                  {favorites.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleChoose(p)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#f6f6f6] dark:hover:bg-[#282828] cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5 text-[#111111] dark:text-white fill-current shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-[#111111] dark:text-white truncate">
                          {p.name}
                        </div>
                        {p.subtitle && (
                          <div className="text-[11px] text-[#767676] truncate">{p.subtitle}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {recents.length > 0 && (
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#767676]">
                    {t.recent}
                  </div>
                  {recents.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleChoose(p)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#f6f6f6] dark:hover:bg-[#282828] cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5 text-[#767676] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-[#111111] dark:text-white truncate">
                          {p.name}
                        </div>
                        {p.subtitle && (
                          <div className="text-[11px] text-[#767676] truncate">{p.subtitle}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="py-1">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#767676]">
                  {t.quickPlaces}
                </div>
                {MUNICH_QUICK_PLACES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleChoose(p)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#f6f6f6] dark:hover:bg-[#282828] cursor-pointer"
                  >
                    {p.category === 'station' ? (
                      <TrainFront className="w-3.5 h-3.5 text-[#444444] dark:text-[#b7b7b7] shrink-0" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5 text-[#767676] shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-[#111111] dark:text-white truncate">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-[#767676] truncate">{p.subtitle}</div>
                    </div>
                    <ModeMiniDots modes={p.transitModes} />
                  </button>
                ))}
              </div>
            </>
          ) : loading && results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-[#686868] flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{t.searchPrompt}...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-[#686868]">{t.noResults}</div>
          ) : (
            <div className="py-1">
              {results.map((p) => {
                const starred = isFav(p);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-1 px-2 py-1 hover:bg-[#f6f6f6] dark:hover:bg-[#282828]"
                  >
                    <button
                      type="button"
                      onClick={() => handleChoose(p)}
                      className="flex items-center gap-2 flex-1 min-w-0 py-1 px-1 text-left cursor-pointer"
                    >
                      {p.category === 'station' ? (
                        <TrainFront className="w-3.5 h-3.5 text-[#444444] dark:text-[#b7b7b7] shrink-0" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5 text-[#767676] shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-[#111111] dark:text-white truncate">
                          {p.name}
                        </div>
                        {p.subtitle && (
                          <div className="text-[11px] text-[#767676] truncate">{p.subtitle}</div>
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
                      className="p-1.5 text-[#767676] hover:text-[#111111] dark:hover:text-white cursor-pointer shrink-0"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${starred ? 'text-[#111111] dark:text-white fill-current' : ''}`}
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
