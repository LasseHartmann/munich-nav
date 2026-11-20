'use client';

import { create } from 'zustand';
import { arrayMove } from '@dnd-kit/sortable';
import { MUNICH_QUICK_PLACES, toLocalDateTimeInputValue } from '@/lib/geo';
import {
  loadFavorites,
  loadRecents,
  loadSavedLang,
  loadSavedTheme,
  persistLang,
  persistTheme,
  saveFavorites,
  saveRecents,
} from '@/lib/storage';
import { decodeRouteFromQuery } from '@/lib/urlState';
import type {
  HighlightSelection,
  Language,
  MapStation,
  MapStyleMode,
  PlaceResult,
  RoadRouteResult,
  SavedPlace,
  ThemeMode,
  TransitFilterKey,
  TransitPlanResult,
  TravelMode,
  WalkIntensity,
  WalkOptions,
  Waypoint,
} from '@/lib/types';

export type MobileSheetSnap = 'peek' | 'half' | 'full';

function makeUid(): string {
  return `wp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createInitialWaypoints(): Waypoint[] {
  return [
    { uid: makeUid(), place: null, dwellMinutes: 0 },
    { uid: makeUid(), place: null, dwellMinutes: 0 },
  ];
}

const ALL_TRANSIT_FILTERS: TransitFilterKey[] = ['SUBWAY', 'SUBURBAN', 'TRAM', 'BUS', 'REGIONAL'];

const DEFAULT_WALK_OPTIONS: WalkOptions = {
  preferGreen: false,
  preferQuiet: false,
  avoidSteps: false,
  intensity: 'balanced',
};

/** Convert a YYYY-MM-DDTHH:mm string representing Europe/Berlin local time into an ISO UTC timestamp. */
function berlinLocalToIso(localVal: string): string {
  if (!localVal || !localVal.includes('T')) return new Date().toISOString();
  const [datePart, timePart] = localVal.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  if (!y || !m || !d) return new Date().toISOString();

  const roughUtc = new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0));
  const berlinParts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(roughUtc);

  const get = (t: string) => Number(berlinParts.find((p) => p.type === t)?.value ?? 0);
  const berlinAsUtcMs = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute')
  );
  const offsetMs = berlinAsUtcMs - roughUtc.getTime();
  return new Date(roughUtc.getTime() - offsetMs).toISOString();
}

let activeRouteAbort: AbortController | null = null;

interface MapClickPinState {
  lat: number;
  lon: number;
  place: PlaceResult | null;
  loading: boolean;
}

interface UserLocationState {
  lat: number;
  lon: number;
  accuracy?: number;
  heading?: number | null;
}

interface NavStore {
  initialized: boolean;
  mode: TravelMode;
  mapStyle: MapStyleMode;
  theme: ThemeMode;
  lang: Language;
  showStations: boolean;

  waypoints: Waypoint[];
  departMode: 'now' | 'departAt';
  departAtLocal: string;
  transitFilters: TransitFilterKey[];
  walkOptions: WalkOptions;
  selectedTransitAlternatives: Record<number, number>;

  roadRoute: RoadRouteResult | null;
  transitPlan: TransitPlanResult | null;
  isRouting: boolean;
  isOptimizing: boolean;
  routeError: string | null;

  highlighted: HighlightSelection | null;
  selectedStation: MapStation | null;
  mapClickPin: MapClickPinState | null;

  // Mobile-first UX state
  mobileSheetSnap: MobileSheetSnap;
  mobileStopsEditing: boolean;
  mobileSearchTargetUid: string | null;
  mapPickTargetUid: string | null;

  favorites: SavedPlace[];
  recents: PlaceResult[];

  liveFollowActive: boolean;
  userLocation: UserLocationState | null;
  gpsError: string | null;

  fitBoundsVersion: number;
  flyToTarget: { lat: number; lon: number; zoom?: number; seq: number } | null;

  // Actions
  hydrateClient: () => void;
  setMode: (mode: TravelMode) => void;
  setMapStyle: (style: MapStyleMode) => void;
  toggleTheme: () => void;
  setLang: (lang: Language) => void;
  toggleShowStations: () => void;

  setMobileSheetSnap: (snap: MobileSheetSnap) => void;
  setMobileStopsEditing: (editing: boolean) => void;
  openMobileSearch: (uid: string) => void;
  closeMobileSearch: () => void;
  startMapPickForWaypoint: (uid: string) => void;
  cancelMapPick: () => void;
  completeMapPick: (lat: number, lon: number) => Promise<void>;

  setWaypointPlace: (uid: string, place: PlaceResult | null) => void;
  setWaypointDwell: (uid: string, minutes: number) => void;
  addIntermediateStop: (place?: PlaceResult | null) => void;
  removeWaypoint: (uid: string) => void;
  reorderWaypoints: (activeUid: string, overUid: string) => void;
  reverseWaypoints: () => void;
  clearRoute: () => void;
  applyPlaceAs: (role: 'start' | 'stop' | 'end', place: PlaceResult) => void;
  loadDemoTrip: () => void;

  setDepartMode: (dm: 'now' | 'departAt') => void;
  setDepartAtLocal: (val: string) => void;
  toggleTransitFilter: (key: TransitFilterKey) => void;
  toggleWalkOption: (key: 'preferGreen' | 'preferQuiet' | 'avoidSteps') => void;
  setWalkIntensity: (intensity: WalkIntensity) => void;
  selectTransitAlternative: (legIndex: number, altIndex: number) => void;

  calculateRoute: (overrideAlts?: Record<number, number>) => Promise<void>;
  optimizeStopOrder: () => Promise<void>;

  setHighlighted: (h: HighlightSelection | null) => void;
  setSelectedStation: (s: MapStation | null) => void;
  openMapClickPin: (lat: number, lon: number) => Promise<void>;
  closeMapClickPin: () => void;

  toggleFavorite: (place: PlaceResult) => void;
  addRecent: (place: PlaceResult) => void;

  setLiveFollowActive: (active: boolean) => void;
  setUserLocation: (loc: UserLocationState | null) => void;
  setGpsError: (err: string | null) => void;
  triggerFitBounds: () => void;
  flyTo: (lat: number, lon: number, zoom?: number) => void;
}

export const useNavStore = create<NavStore>((set, get) => ({
  initialized: false,
  mode: 'transit',
  mapStyle: 'standard',
  theme: 'light',
  lang: 'en',
  showStations: true,

  waypoints: createInitialWaypoints(),
  departMode: 'now',
  departAtLocal: toLocalDateTimeInputValue(),
  transitFilters: [...ALL_TRANSIT_FILTERS],
  walkOptions: { ...DEFAULT_WALK_OPTIONS },
  selectedTransitAlternatives: {},

  roadRoute: null,
  transitPlan: null,
  isRouting: false,
  isOptimizing: false,
  routeError: null,

  highlighted: null,
  selectedStation: null,
  mapClickPin: null,

  mobileSheetSnap: 'half',
  mobileStopsEditing: true,
  mobileSearchTargetUid: null,
  mapPickTargetUid: null,

  favorites: [],
  recents: [],

  liveFollowActive: false,
  userLocation: null,
  gpsError: null,

  fitBoundsVersion: 0,
  flyToTarget: null,

  hydrateClient: () => {
    if (get().initialized || typeof window === 'undefined') return;

    const savedTheme =
      loadSavedTheme() ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const savedLang =
      loadSavedLang() ?? (navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en');
    const favorites = loadFavorites();
    const recents = loadRecents();

    const fromUrl = decodeRouteFromQuery(window.location.search);
    const hasUrlRoute = Boolean(
      fromUrl?.waypoints && fromUrl.waypoints.filter((w) => w.place).length >= 2
    );

    set({
      initialized: true,
      theme: savedTheme,
      lang: savedLang,
      favorites,
      recents,
      mobileStopsEditing: !hasUrlRoute,
      ...(fromUrl?.mode ? { mode: fromUrl.mode } : {}),
      ...(fromUrl?.mapStyle ? { mapStyle: fromUrl.mapStyle } : {}),
      ...(fromUrl?.waypoints ? { waypoints: fromUrl.waypoints } : {}),
      ...(fromUrl?.departMode ? { departMode: fromUrl.departMode } : {}),
      ...(fromUrl?.departAtLocal ? { departAtLocal: fromUrl.departAtLocal } : {}),
      ...(fromUrl?.transitFilters ? { transitFilters: fromUrl.transitFilters } : {}),
      ...(fromUrl?.walkOptions ? { walkOptions: fromUrl.walkOptions } : {}),
    });

    if (hasUrlRoute) {
      void get().calculateRoute();
    }
  },

  setMode: (mode) => {
    if (get().mode === mode) return;
    set({
      mode,
      highlighted: null,
      routeError: null,
      selectedTransitAlternatives: {},
    });
    const filled = get().waypoints.filter((w) => w.place !== null);
    if (filled.length >= 2) {
      void get().calculateRoute({});
    }
  },

  setMapStyle: (mapStyle) => set({ mapStyle }),

  toggleTheme: () => {
    const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
    persistTheme(next);
    set({ theme: next });
  },

  setLang: (lang) => {
    persistLang(lang);
    const prev = get().lang;
    set({ lang });
    if (prev !== lang && get().mode !== 'transit' && get().roadRoute) {
      void get().calculateRoute();
    }
  },

  toggleShowStations: () => set((s) => ({ showStations: !s.showStations })),

  setMobileSheetSnap: (mobileSheetSnap) => set({ mobileSheetSnap }),
  setMobileStopsEditing: (mobileStopsEditing) => set({ mobileStopsEditing }),
  openMobileSearch: (uid) =>
    set({ mobileSearchTargetUid: uid, selectedStation: null, mapClickPin: null }),
  closeMobileSearch: () => set({ mobileSearchTargetUid: null }),

  startMapPickForWaypoint: (uid) =>
    set({
      mobileSearchTargetUid: null,
      mapPickTargetUid: uid,
      mobileSheetSnap: 'peek',
      selectedStation: null,
      mapClickPin: null,
    }),

  cancelMapPick: () => set({ mapPickTargetUid: null, mobileSheetSnap: 'half' }),

  completeMapPick: async (lat, lon) => {
    const targetUid = get().mapPickTargetUid;
    if (!targetUid) return;
    set({ mapPickTargetUid: null, mobileSheetSnap: 'half' });

    let place: PlaceResult = {
      id: `pin-${lat.toFixed(5)}-${lon.toFixed(5)}`,
      name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      subtitle: 'München',
      lat,
      lon,
      category: 'pin',
    };

    try {
      const res = await fetch(
        `/api/geocode?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&lang=${get().lang}`
      );
      const data = (await res.json()) as { place?: PlaceResult };
      if (data.place) place = data.place;
    } catch {
      // Keep coordinate fallback
    }

    get().setWaypointPlace(targetUid, place);
  },

  setWaypointPlace: (uid, place) => {
    if (place) get().addRecent(place);
    set((s) => ({
      waypoints: s.waypoints.map((w) => (w.uid === uid ? { ...w, place } : w)),
      selectedTransitAlternatives: {},
      highlighted: null,
      routeError: null,
    }));
    if (place) {
      const filled = get().waypoints.filter((w) => w.place !== null);
      if (filled.length >= 2) {
        void get().calculateRoute({});
      } else {
        get().flyTo(place.lat, place.lon, 14.5);
      }
    } else {
      const filled = get().waypoints.filter((w) => w.place !== null);
      if (filled.length < 2) {
        set({ roadRoute: null, transitPlan: null, mobileStopsEditing: true });
      } else {
        void get().calculateRoute({});
      }
    }
  },

  setWaypointDwell: (uid, minutes) => {
    const clamped = Math.max(0, Math.min(720, Math.round(minutes)));
    set((s) => ({
      waypoints: s.waypoints.map((w) => (w.uid === uid ? { ...w, dwellMinutes: clamped } : w)),
      selectedTransitAlternatives: {},
    }));
    const filled = get().waypoints.filter((w) => w.place !== null);
    if (get().mode === 'transit' && filled.length >= 2) {
      void get().calculateRoute({});
    }
  },

  addIntermediateStop: (place = null) => {
    const newUid = makeUid();
    set((s) => {
      if (s.waypoints.length >= 10) return s;
      const next = [...s.waypoints];
      next.splice(next.length - 1, 0, {
        uid: newUid,
        place,
        dwellMinutes: 15,
      });
      return {
        waypoints: next,
        selectedTransitAlternatives: {},
        highlighted: null,
        mobileStopsEditing: true,
      };
    });
    if (place) {
      get().addRecent(place);
      const filled = get().waypoints.filter((w) => w.place !== null);
      if (filled.length >= 2) {
        void get().calculateRoute({});
      }
    }
  },

  removeWaypoint: (uid) => {
    set((s) => {
      if (s.waypoints.length <= 2) {
        return {
          waypoints: s.waypoints.map((w) =>
            w.uid === uid ? { ...w, place: null, dwellMinutes: 0 } : w
          ),
          roadRoute: null,
          transitPlan: null,
          highlighted: null,
          selectedTransitAlternatives: {},
          mobileStopsEditing: true,
        };
      }
      const next = s.waypoints.filter((w) => w.uid !== uid);
      if (next.length > 0) next[0] = { ...next[0], dwellMinutes: 0 };
      if (next.length > 1) next[next.length - 1] = { ...next[next.length - 1], dwellMinutes: 0 };
      return {
        waypoints: next,
        highlighted: null,
        selectedTransitAlternatives: {},
      };
    });
    const filled = get().waypoints.filter((w) => w.place !== null);
    if (filled.length >= 2) {
      void get().calculateRoute({});
    } else {
      set({ roadRoute: null, transitPlan: null, mobileStopsEditing: true });
    }
  },

  reorderWaypoints: (activeUid, overUid) => {
    if (activeUid === overUid) return;
    set((s) => {
      const oldIdx = s.waypoints.findIndex((w) => w.uid === activeUid);
      const newIdx = s.waypoints.findIndex((w) => w.uid === overUid);
      if (oldIdx === -1 || newIdx === -1) return s;
      const moved = arrayMove(s.waypoints, oldIdx, newIdx).map((w, idx, arr) => {
        const isEdge = idx === 0 || idx === arr.length - 1;
        return {
          ...w,
          dwellMinutes: isEdge ? 0 : w.dwellMinutes > 0 ? w.dwellMinutes : 15,
        };
      });
      return {
        waypoints: moved,
        selectedTransitAlternatives: {},
        highlighted: null,
      };
    });
    if (get().waypoints.filter((w) => w.place !== null).length >= 2) {
      void get().calculateRoute({});
    }
  },

  reverseWaypoints: () => {
    set((s) => {
      const rev = [...s.waypoints].reverse().map((w, idx, arr) => {
        const isEdge = idx === 0 || idx === arr.length - 1;
        return { ...w, dwellMinutes: isEdge ? 0 : w.dwellMinutes };
      });
      return {
        waypoints: rev,
        selectedTransitAlternatives: {},
        highlighted: null,
      };
    });
    if (get().waypoints.filter((w) => w.place !== null).length >= 2) {
      void get().calculateRoute({});
    }
  },

  clearRoute: () => {
    if (activeRouteAbort) {
      activeRouteAbort.abort();
      activeRouteAbort = null;
    }
    set({
      waypoints: createInitialWaypoints(),
      roadRoute: null,
      transitPlan: null,
      isRouting: false,
      routeError: null,
      highlighted: null,
      selectedTransitAlternatives: {},
      liveFollowActive: false,
      mobileStopsEditing: true,
    });
  },

  applyPlaceAs: (role, place) => {
    get().addRecent(place);
    set((s) => {
      const next = [...s.waypoints];
      if (role === 'start') {
        next[0] = { ...next[0], place, dwellMinutes: 0 };
      } else if (role === 'end') {
        next[next.length - 1] = { ...next[next.length - 1], place, dwellMinutes: 0 };
      } else {
        const emptyMidIdx = next.findIndex(
          (w, i) => i > 0 && i < next.length - 1 && w.place === null
        );
        if (emptyMidIdx !== -1) {
          next[emptyMidIdx] = { ...next[emptyMidIdx], place };
        } else if (next.length < 10) {
          next.splice(next.length - 1, 0, {
            uid: makeUid(),
            place,
            dwellMinutes: 15,
          });
        }
      }
      return {
        waypoints: next,
        mapClickPin: null,
        selectedStation: null,
        selectedTransitAlternatives: {},
        highlighted: null,
      };
    });

    if (get().waypoints.filter((w) => w.place !== null).length >= 2) {
      void get().calculateRoute({});
    } else {
      get().flyTo(place.lat, place.lon, 14.5);
    }
  },

  loadDemoTrip: () => {
    const marienplatz = MUNICH_QUICK_PLACES[0];
    const olympiapark = MUNICH_QUICK_PLACES[2];
    const englGarten = MUNICH_QUICK_PLACES[3];
    set({
      mode: 'transit',
      waypoints: [
        { uid: makeUid(), place: marienplatz, dwellMinutes: 0 },
        { uid: makeUid(), place: olympiapark, dwellMinutes: 20 },
        { uid: makeUid(), place: englGarten, dwellMinutes: 0 },
      ],
      selectedTransitAlternatives: {},
      highlighted: null,
      routeError: null,
      mobileStopsEditing: false,
      mobileSheetSnap: 'half',
    });
    void get().calculateRoute({});
  },

  setDepartMode: (departMode) => {
    set({
      departMode,
      departAtLocal: departMode === 'now' ? toLocalDateTimeInputValue() : get().departAtLocal,
      selectedTransitAlternatives: {},
    });
    if (get().mode === 'transit' && get().waypoints.filter((w) => w.place).length >= 2) {
      void get().calculateRoute({});
    }
  },

  setDepartAtLocal: (departAtLocal) => {
    set({ departAtLocal, departMode: 'departAt', selectedTransitAlternatives: {} });
    if (get().mode === 'transit' && get().waypoints.filter((w) => w.place).length >= 2) {
      void get().calculateRoute({});
    }
  },

  toggleTransitFilter: (key) => {
    set((s) => {
      const exists = s.transitFilters.includes(key);
      if (exists && s.transitFilters.length <= 1) return s;
      const next = exists
        ? s.transitFilters.filter((k) => k !== key)
        : [...s.transitFilters, key];
      return { transitFilters: next, selectedTransitAlternatives: {} };
    });
    if (get().mode === 'transit' && get().waypoints.filter((w) => w.place).length >= 2) {
      void get().calculateRoute({});
    }
  },

  toggleWalkOption: (key) => {
    set((s) => ({
      walkOptions: {
        ...s.walkOptions,
        [key]: !s.walkOptions[key],
      },
      highlighted: null,
    }));
    if (get().mode === 'foot' && get().waypoints.filter((w) => w.place).length >= 2) {
      void get().calculateRoute();
    }
  },

  setWalkIntensity: (intensity) => {
    if (get().walkOptions.intensity === intensity) return;
    set((s) => ({
      walkOptions: {
        ...s.walkOptions,
        intensity,
      },
      highlighted: null,
    }));
    if (get().mode === 'foot' && get().waypoints.filter((w) => w.place).length >= 2) {
      void get().calculateRoute();
    }
  },

  selectTransitAlternative: (legIndex, altIndex) => {
    const prev = get().selectedTransitAlternatives;
    const next: Record<number, number> = {};
    for (const [kStr, v] of Object.entries(prev)) {
      const k = Number(kStr);
      if (k < legIndex) next[k] = v;
    }
    next[legIndex] = altIndex;
    set({ selectedTransitAlternatives: next, highlighted: null });
    void get().calculateRoute(next);
  },

  calculateRoute: async (overrideAlts) => {
    const state = get();
    const filled = state.waypoints.filter((w) => w.place !== null);
    if (filled.length < 2) {
      set({ roadRoute: null, transitPlan: null, isRouting: false, routeError: null });
      return;
    }

    if (activeRouteAbort) {
      activeRouteAbort.abort();
    }
    const controller = new AbortController();
    activeRouteAbort = controller;

    set({ isRouting: true, routeError: null });

    try {
      if (state.mode === 'transit') {
        const departureTime =
          state.departMode === 'departAt'
            ? berlinLocalToIso(state.departAtLocal)
            : new Date().toISOString();

        const res = await fetch('/api/transit/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            stops: filled.map((w, idx) => ({
              name: w.place!.name,
              lat: w.place!.lat,
              lon: w.place!.lon,
              stopId: w.place!.stopId,
              dwellMinutes: idx === 0 || idx === filled.length - 1 ? 0 : w.dwellMinutes,
            })),
            departureTime,
            transitFilters: state.transitFilters,
            selectedAlternatives: overrideAlts ?? state.selectedTransitAlternatives,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Transit routing failed');
        }

        if (controller.signal.aborted) return;
        set((s) => ({
          transitPlan: data as TransitPlanResult,
          roadRoute: null,
          isRouting: false,
          routeError: null,
          mobileStopsEditing: false,
          mobileSheetSnap: s.mobileSheetSnap === 'peek' ? 'half' : s.mobileSheetSnap,
          fitBoundsVersion: s.fitBoundsVersion + 1,
        }));
      } else {
        const res = await fetch('/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            mode: state.mode,
            waypoints: filled.map((w) => ({ lat: w.place!.lat, lon: w.place!.lon })),
            lang: state.lang,
            walkOptions: state.mode === 'foot' ? state.walkOptions : undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Route calculation failed');
        }

        if (controller.signal.aborted) return;
        set((s) => ({
          roadRoute: data as RoadRouteResult,
          transitPlan: null,
          isRouting: false,
          routeError: null,
          mobileStopsEditing: false,
          mobileSheetSnap: s.mobileSheetSnap === 'peek' ? 'half' : s.mobileSheetSnap,
          fitBoundsVersion: s.fitBoundsVersion + 1,
        }));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      set({
        isRouting: false,
        routeError: err instanceof Error ? err.message : 'Route calculation failed',
      });
    }
  },

  optimizeStopOrder: async () => {
    const state = get();
    if (state.mode === 'transit') return;
    const filled = state.waypoints.filter((w) => w.place !== null);
    if (filled.length < 4) return;

    set({ isOptimizing: true, routeError: null });
    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: state.mode,
          waypoints: filled.map((w) => ({ lat: w.place!.lat, lon: w.place!.lon })),
        }),
      });
      const data = (await res.json()) as { orderedIndices?: number[]; error?: string };
      if (!res.ok || !Array.isArray(data.orderedIndices)) {
        throw new Error(data.error || 'Optimization failed');
      }

      const reordered: Waypoint[] = data.orderedIndices.map((origIdx, newIdx, arr) => {
        const wp = filled[origIdx];
        const isEdge = newIdx === 0 || newIdx === arr.length - 1;
        return {
          ...wp,
          dwellMinutes: isEdge ? 0 : wp.dwellMinutes,
        };
      });

      set({ waypoints: reordered, isOptimizing: false, highlighted: null });
      await get().calculateRoute();
    } catch (err) {
      set({
        isOptimizing: false,
        routeError: err instanceof Error ? err.message : 'Could not optimize stops',
      });
    }
  },

  setHighlighted: (highlighted) => set({ highlighted }),

  setSelectedStation: (selectedStation) =>
    set((s) => ({
      selectedStation,
      mapClickPin: selectedStation ? null : s.mapClickPin,
      mobileSheetSnap:
        selectedStation && s.mobileSheetSnap === 'peek' ? 'half' : s.mobileSheetSnap,
    })),

  openMapClickPin: async (lat, lon) => {
    set((s) => ({
      selectedStation: null,
      mapClickPin: { lat, lon, place: null, loading: true },
      mobileSheetSnap: s.mobileSheetSnap === 'peek' ? 'half' : s.mobileSheetSnap,
    }));
    try {
      const lang = get().lang;
      const res = await fetch(
        `/api/geocode?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&lang=${lang}`
      );
      const data = (await res.json()) as { place?: PlaceResult };
      const current = get().mapClickPin;
      if (current && current.lat === lat && current.lon === lon) {
        set({
          mapClickPin: {
            lat,
            lon,
            loading: false,
            place: data.place ?? {
              id: `pin-${lat.toFixed(5)}-${lon.toFixed(5)}`,
              name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
              subtitle: 'München',
              lat,
              lon,
              category: 'pin',
            },
          },
        });
      }
    } catch {
      const current = get().mapClickPin;
      if (current && current.lat === lat && current.lon === lon) {
        set({
          mapClickPin: {
            lat,
            lon,
            loading: false,
            place: {
              id: `pin-${lat.toFixed(5)}-${lon.toFixed(5)}`,
              name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
              subtitle: 'München',
              lat,
              lon,
              category: 'pin',
            },
          },
        });
      }
    }
  },

  closeMapClickPin: () => set({ mapClickPin: null }),

  toggleFavorite: (place) => {
    set((s) => {
      const exists = s.favorites.some(
        (f) =>
          f.id === place.id ||
          (Math.abs(f.lat - place.lat) < 0.0002 && Math.abs(f.lon - place.lon) < 0.0002)
      );
      const next: SavedPlace[] = exists
        ? s.favorites.filter(
            (f) =>
              f.id !== place.id &&
              !(Math.abs(f.lat - place.lat) < 0.0002 && Math.abs(f.lon - place.lon) < 0.0002)
          )
        : [{ ...place, savedAt: Date.now() }, ...s.favorites];
      saveFavorites(next);
      return { favorites: next };
    });
  },

  addRecent: (place) => {
    if (place.category === 'gps') return;
    set((s) => {
      const filtered = s.recents.filter(
        (r) =>
          r.id !== place.id &&
          !(Math.abs(r.lat - place.lat) < 0.00015 && Math.abs(r.lon - place.lon) < 0.00015)
      );
      const next = [place, ...filtered].slice(0, 10);
      saveRecents(next);
      return { recents: next };
    });
  },

  setLiveFollowActive: (liveFollowActive) =>
    set((s) => ({
      liveFollowActive,
      gpsError: liveFollowActive ? null : s.gpsError,
      mobileSheetSnap: liveFollowActive ? 'peek' : s.mobileSheetSnap,
    })),
  setUserLocation: (userLocation) => set({ userLocation }),
  setGpsError: (gpsError) => set({ gpsError }),
  triggerFitBounds: () => set((s) => ({ fitBoundsVersion: s.fitBoundsVersion + 1 })),
  flyTo: (lat, lon, zoom = 15) =>
    set((s) => ({
      flyToTarget: { lat, lon, zoom, seq: (s.flyToTarget?.seq ?? 0) + 1 },
    })),
}));
