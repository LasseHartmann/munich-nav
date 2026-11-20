'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getBoundsFromCoordinates, MUNICH_CENTER } from '@/lib/geo';
import { resolveMapStyle } from '@/lib/mapStyles';
import {
  getLineVisualStyle,
  getModeColor,
  getStationPrimaryMode,
} from '@/lib/mvvColors';
import { useNavStore } from '@/store/useNavStore';
import type { MapStation } from '@/lib/types';

const SRC_ROUTE_SOLID = 'mucnav-route-solid';
const SRC_ROUTE_WALK = 'mucnav-route-walk';
const SRC_HIGHLIGHT = 'mucnav-highlight';
const SRC_STATIONS = 'mucnav-stations';

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

function stationDotColor(primary: ReturnType<typeof getStationPrimaryMode>): string {
  switch (primary) {
    case 'ubahn':
      return '#0065ae';
    case 'sbahn':
      return '#008e4e';
    case 'tram':
      return '#e30613';
    case 'regional':
      return '#1e3a8a';
    case 'bus':
      return '#00586a';
  }
}

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const styleReadyRef = useRef(false);
  const appliedStyleKeyRef = useRef<string | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const gpsMarkerRef = useRef<maplibregl.Marker | null>(null);
  const clickMarkerRef = useRef<maplibregl.Marker | null>(null);
  const stationsRef = useRef<MapStation[]>([]);
  const stationFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [styleLoadSeq, setStyleLoadSeq] = useState(0);

  const initialized = useNavStore((s) => s.initialized);
  const mapStyle = useNavStore((s) => s.mapStyle);
  const theme = useNavStore((s) => s.theme);
  const showStations = useNavStore((s) => s.showStations);
  const mode = useNavStore((s) => s.mode);
  const waypoints = useNavStore((s) => s.waypoints);
  const roadRoute = useNavStore((s) => s.roadRoute);
  const transitPlan = useNavStore((s) => s.transitPlan);
  const highlighted = useNavStore((s) => s.highlighted);
  const userLocation = useNavStore((s) => s.userLocation);
  const mapClickPin = useNavStore((s) => s.mapClickPin);
  const fitBoundsVersion = useNavStore((s) => s.fitBoundsVersion);
  const flyToTarget = useNavStore((s) => s.flyToTarget);

  const buildRouteGeoJSON = useCallback(() => {
    const state = useNavStore.getState();
    const solidFeatures: GeoJSON.Feature[] = [];
    const walkFeatures: GeoJSON.Feature[] = [];

    if (state.mode === 'transit' && state.transitPlan) {
      for (const leg of state.transitPlan.legs) {
        const chosen = leg.alternatives[leg.selectedIndex];
        if (!chosen) continue;
        for (const seg of chosen.segments) {
          if (seg.coordinates.length < 2) continue;
          const style = getLineVisualStyle(
            seg.mode,
            seg.routeShortName,
            seg.routeColor,
            seg.routeTextColor
          );
          const feature: GeoJSON.Feature = {
            type: 'Feature',
            properties: {
              color: style.bg,
              label: seg.routeShortName || seg.mode,
            },
            geometry: {
              type: 'LineString',
              coordinates: seg.coordinates,
            },
          };
          if (seg.mode === 'WALK') {
            walkFeatures.push(feature);
          } else {
            solidFeatures.push(feature);
          }
        }
      }
    } else if (
      state.mode !== 'transit' &&
      state.roadRoute &&
      state.roadRoute.coordinates.length >= 2
    ) {
      solidFeatures.push({
        type: 'Feature',
        properties: {
          color: getModeColor(state.mode),
        },
        geometry: {
          type: 'LineString',
          coordinates: state.roadRoute.coordinates,
        },
      });
    }

    const highlightFeatures: GeoJSON.Feature[] = [];
    if (state.highlighted && state.highlighted.coordinates.length >= 2) {
      highlightFeatures.push({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: state.highlighted.coordinates,
        },
      });
    }

    return {
      solid: { type: 'FeatureCollection', features: solidFeatures } as GeoJSON.FeatureCollection,
      walk: { type: 'FeatureCollection', features: walkFeatures } as GeoJSON.FeatureCollection,
      highlight: {
        type: 'FeatureCollection',
        features: highlightFeatures,
      } as GeoJSON.FeatureCollection,
    };
  }, []);

  const buildStationsGeoJSON = useCallback((): GeoJSON.FeatureCollection => {
    const show = useNavStore.getState().showStations;
    if (!show) return EMPTY_FC;
    return {
      type: 'FeatureCollection',
      features: stationsRef.current.map((st) => {
        const primary = getStationPrimaryMode(st.modes);
        return {
          type: 'Feature',
          properties: {
            stopId: st.stopId,
            name: st.name,
            primary,
            color: stationDotColor(primary),
            radius: primary === 'ubahn' || primary === 'sbahn' ? 6.5 : 5,
            modesJson: JSON.stringify(st.modes),
            importance: st.importance,
          },
          geometry: {
            type: 'Point',
            coordinates: [st.lon, st.lat],
          },
        };
      }),
    };
  }, []);

  const ensureOverlayLayers = useCallback(
    (map: maplibregl.Map) => {
      const routeData = buildRouteGeoJSON();
      const stationsData = buildStationsGeoJSON();

      // 1. MVV Stations Source & Layers
      if (!map.getSource(SRC_STATIONS)) {
        map.addSource(SRC_STATIONS, { type: 'geojson', data: stationsData });
        map.addLayer({
          id: 'mucnav-stations-circle',
          type: 'circle',
          source: SRC_STATIONS,
          paint: {
            'circle-radius': ['get', 'radius'],
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
            'circle-opacity': 0.94,
          },
        });
        map.addLayer({
          id: 'mucnav-stations-label',
          type: 'symbol',
          source: SRC_STATIONS,
          minzoom: 13.6,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 11,
            'text-offset': [0, 1.25],
            'text-anchor': 'top',
            'text-max-width': 10,
            'text-optional': true,
          },
          paint: {
            'text-color':
              useNavStore.getState().mapStyle === 'hybrid' ||
              useNavStore.getState().theme === 'dark'
                ? '#f8fafc'
                : '#0f172a',
            'text-halo-color':
              useNavStore.getState().mapStyle === 'hybrid' ||
              useNavStore.getState().theme === 'dark'
                ? 'rgba(15,23,42,0.92)'
                : 'rgba(255,255,255,0.94)',
            'text-halo-width': 1.6,
          },
        });
      }

      // 2. Walk / Dashed Transit Segments
      if (!map.getSource(SRC_ROUTE_WALK)) {
        map.addSource(SRC_ROUTE_WALK, { type: 'geojson', data: routeData.walk });
        map.addLayer({
          id: 'mucnav-route-walk-casing',
          type: 'line',
          source: SRC_ROUTE_WALK,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#ffffff',
            'line-width': 7,
            'line-opacity': 0.88,
          },
        });
        map.addLayer({
          id: 'mucnav-route-walk-line',
          type: 'line',
          source: SRC_ROUTE_WALK,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#475569',
            'line-width': 4,
            'line-dasharray': [1.2, 1.8],
          },
        });
      }

      // 3. Solid Route Lines (MVV line colors or road mode colors)
      if (!map.getSource(SRC_ROUTE_SOLID)) {
        map.addSource(SRC_ROUTE_SOLID, { type: 'geojson', data: routeData.solid });
        map.addLayer({
          id: 'mucnav-route-solid-casing',
          type: 'line',
          source: SRC_ROUTE_SOLID,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#ffffff',
            'line-width': 9,
            'line-opacity': 0.92,
          },
        });
        map.addLayer({
          id: 'mucnav-route-solid-line',
          type: 'line',
          source: SRC_ROUTE_SOLID,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['coalesce', ['get', 'color'], '#0065ae'],
            'line-width': 5.5,
            'line-opacity': 0.96,
          },
        });
      }

      // 4. Active Highlight Segment
      if (!map.getSource(SRC_HIGHLIGHT)) {
        map.addSource(SRC_HIGHLIGHT, { type: 'geojson', data: routeData.highlight });
        map.addLayer({
          id: 'mucnav-highlight-glow',
          type: 'line',
          source: SRC_HIGHLIGHT,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#facc15',
            'line-width': 13,
            'line-opacity': 0.55,
          },
        });
        map.addLayer({
          id: 'mucnav-highlight-core',
          type: 'line',
          source: SRC_HIGHLIGHT,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#0ea5e9',
            'line-width': 6.5,
          },
        });
      }
    },
    [buildRouteGeoJSON, buildStationsGeoJSON]
  );

  const loadViewportStations = useCallback(
    async (map: maplibregl.Map) => {
      const state = useNavStore.getState();
      if (!state.showStations || map.getZoom() < 12.2) {
        stationsRef.current = [];
        const src = map.getSource(SRC_STATIONS) as maplibregl.GeoJSONSource | undefined;
        if (src) src.setData(EMPTY_FC);
        return;
      }

      const bounds = map.getBounds();
      try {
        const url = `/api/transit/stops?minLat=${bounds.getSouth()}&minLon=${bounds.getWest()}&maxLat=${bounds.getNorth()}&maxLon=${bounds.getEast()}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = (await res.json()) as { stations?: MapStation[] };
        stationsRef.current = data.stations || [];
        const src = map.getSource(SRC_STATIONS) as maplibregl.GeoJSONSource | undefined;
        if (src) src.setData(buildStationsGeoJSON());
      } catch {
        // Ignore transient network errors during panning
      }
    },
    [buildStationsGeoJSON]
  );

  // Initialize MapLibre once after client store hydration (so URL mapStyle/theme apply immediately!)
  useEffect(() => {
    if (!initialized || !containerRef.current || mapRef.current) return;

    let disposed = false;

    const init = async () => {
      // Point MapLibre GL JS v6 worker explicitly to our static public worker bundle (fixes Next.js Turbopack worker URL)
      maplibregl.setWorkerUrl('/maplibre-gl-worker.js');

      const initialState = useNavStore.getState();
      const initialStyleKey = `${initialState.mapStyle}:${initialState.theme}`;
      const initialStyle = await resolveMapStyle(initialState.mapStyle, initialState.theme);
      if (disposed || !containerRef.current) return;

      appliedStyleKeyRef.current = initialStyleKey;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: initialStyle,
        center: [MUNICH_CENTER.lon, MUNICH_CENTER.lat],
        zoom: MUNICH_CENTER.zoom,
        attributionControl: false,
      });

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

      map.on('style.load', () => {
        styleReadyRef.current = true;
        ensureOverlayLayers(map);
        setStyleLoadSeq((n) => n + 1);
      });

      map.on('load', () => {
        void loadViewportStations(map);
      });

      map.on('moveend', () => {
        if (stationFetchTimerRef.current) clearTimeout(stationFetchTimerRef.current);
        stationFetchTimerRef.current = setTimeout(() => {
          void loadViewportStations(map);
        }, 320);
      });

      map.on('mouseenter', 'mucnav-stations-circle', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'mucnav-stations-circle', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('click', (e: maplibregl.MapMouseEvent) => {
        if (map.getLayer('mucnav-stations-circle')) {
          const hits = map.queryRenderedFeatures(e.point, {
            layers: ['mucnav-stations-circle'],
          });
          if (hits.length > 0) {
            const props = hits[0].properties || {};
            const geom = hits[0].geometry;
            const coords = geom.type === 'Point' ? geom.coordinates : [e.lngLat.lng, e.lngLat.lat];
            let modes: string[] = [];
            try {
              modes = JSON.parse(String(props.modesJson || '[]')) as string[];
            } catch {}
            useNavStore.getState().setSelectedStation({
              stopId: String(props.stopId || ''),
              name: String(props.name || 'MVV Station'),
              lat: Number(coords[1]),
              lon: Number(coords[0]),
              modes,
              importance: Number(props.importance || 0),
            });
            return;
          }
        }

        void useNavStore.getState().openMapClickPin(e.lngLat.lat, e.lngLat.lng);
      });

      mapRef.current = map;
      setMapReady(true);
    };

    void init();

    return () => {
      disposed = true;
      if (stationFetchTimerRef.current) clearTimeout(stationFetchTimerRef.current);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      gpsMarkerRef.current?.remove();
      clickMarkerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
      appliedStyleKeyRef.current = null;
      setMapReady(false);
    };
  }, [initialized, ensureOverlayLayers, loadViewportStations]);

  // Switch Standard (Light/Dark) <-> Hybrid styles smoothly
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const key = `${mapStyle}:${theme}`;
    if (appliedStyleKeyRef.current === key) return;
    appliedStyleKeyRef.current = key;

    let cancelled = false;
    (async () => {
      const nextStyle = await resolveMapStyle(mapStyle, theme);
      if (cancelled || !mapRef.current) return;
      styleReadyRef.current = false;
      mapRef.current.setStyle(nextStyle);
    })();

    return () => {
      cancelled = true;
    };
  }, [mapStyle, theme, mapReady]);

  // Sync stations visibility toggle & reload after style switch
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !styleReadyRef.current) return;
    void loadViewportStations(map);
  }, [showStations, mapReady, styleLoadSeq, loadViewportStations]);

  // Update route & highlight GeoJSON whenever route state or style finishes loading
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !styleReadyRef.current) return;
    const data = buildRouteGeoJSON();

    const solidSrc = map.getSource(SRC_ROUTE_SOLID) as maplibregl.GeoJSONSource | undefined;
    const walkSrc = map.getSource(SRC_ROUTE_WALK) as maplibregl.GeoJSONSource | undefined;
    const hiSrc = map.getSource(SRC_HIGHLIGHT) as maplibregl.GeoJSONSource | undefined;

    if (solidSrc) solidSrc.setData(data.solid);
    if (walkSrc) walkSrc.setData(data.walk);
    if (hiSrc) hiSrc.setData(data.highlight);

    if (highlighted && highlighted.coordinates.length >= 2) {
      const bounds = getBoundsFromCoordinates(highlighted.coordinates);
      if (bounds) {
        const isDesktop = window.innerWidth >= 768;
        map.fitBounds(bounds, {
          padding: {
            top: 96,
            bottom: isDesktop ? 90 : 280,
            left: isDesktop ? 480 : 50,
            right: 80,
          },
          maxZoom: 16,
          duration: 650,
        });
      }
    }
  }, [mode, roadRoute, transitPlan, highlighted, mapReady, styleLoadSeq, buildRouteGeoJSON]);

  // Render Waypoint Markers (A, 1, 2..., B + dwell badges)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const filled = waypoints
      .map((w, origIdx) => ({ w, origIdx }))
      .filter((x) => x.w.place !== null);

    filled.forEach(({ w, origIdx }) => {
      const place = w.place!;
      const isStart = origIdx === 0;
      const isEnd = origIdx === waypoints.length - 1;
      const label = isStart ? 'A' : isEnd ? 'B' : String(origIdx);
      const bg = isStart ? '#10b981' : isEnd ? '#f43f5e' : '#f59e0b';

      const el = document.createElement('div');
      el.className = 'flex flex-col items-center pointer-events-auto select-none';
      el.innerHTML = `
        <div style="background:${bg};color:#fff;border:2.5px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,0.32);"
             class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold">
          ${label}
        </div>
        ${
          !isStart && !isEnd && mode === 'transit' && w.dwellMinutes > 0
            ? `<div style="background:#0f172a;color:#fcd34d;border:1px solid rgba(255,255,255,0.25);"
                    class="mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow">
                 +${w.dwellMinutes}m
               </div>`
            : ''
        }
      `;
      el.title = place.name;

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([place.lon, place.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [waypoints, mode, mapReady]);

  // Render Live GPS User Location Dot
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!userLocation) {
      gpsMarkerRef.current?.remove();
      gpsMarkerRef.current = null;
      return;
    }

    if (!gpsMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'relative flex items-center justify-center';
      el.innerHTML = `
        <span class="absolute w-7 h-7 rounded-full bg-sky-500/35 animate-ping"></span>
        <span class="relative w-4 h-4 rounded-full bg-sky-500 border-2 border-white shadow-lg"></span>
      `;
      gpsMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([userLocation.lon, userLocation.lat])
        .addTo(map);
    } else {
      gpsMarkerRef.current.setLngLat([userLocation.lon, userLocation.lat]);
    }
  }, [userLocation, mapReady]);

  // Render temporary clicked pin marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!mapClickPin) {
      clickMarkerRef.current?.remove();
      clickMarkerRef.current = null;
      return;
    }

    if (!clickMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `<div style="background:#0065ae;border:2.5px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.35);" class="w-4 h-4 rounded-full"></div>`;
      clickMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([mapClickPin.lon, mapClickPin.lat])
        .addTo(map);
    } else {
      clickMarkerRef.current.setLngLat([mapClickPin.lon, mapClickPin.lat]);
    }
  }, [mapClickPin, mapReady]);

  // Fit bounds when a new route calculates or user clicks "Fit route"
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || fitBoundsVersion === 0) return;

    const coords: [number, number][] = [];
    const state = useNavStore.getState();

    if (state.mode === 'transit' && state.transitPlan) {
      for (const leg of state.transitPlan.legs) {
        coords.push(leg.fromCoord, leg.toCoord);
        const itin = leg.alternatives[leg.selectedIndex];
        if (itin) {
          for (const seg of itin.segments) {
            coords.push(...seg.coordinates);
          }
        }
      }
    } else if (state.roadRoute) {
      coords.push(...state.roadRoute.coordinates);
    } else {
      for (const w of state.waypoints) {
        if (w.place) coords.push([w.place.lon, w.place.lat]);
      }
    }

    const bounds = getBoundsFromCoordinates(coords);
    if (!bounds) return;

    const isDesktop = window.innerWidth >= 768;
    map.fitBounds(bounds, {
      padding: {
        top: 96,
        bottom: isDesktop ? 90 : 280,
        left: isDesktop ? 480 : 48,
        right: 80,
      },
      maxZoom: 15.5,
      duration: 750,
    });
  }, [fitBoundsVersion, mapReady]);

  // Smooth flyTo handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !flyToTarget) return;
    map.flyTo({
      center: [flyToTarget.lon, flyToTarget.lat],
      zoom: flyToTarget.zoom ?? 15,
      duration: 700,
    });
  }, [flyToTarget, mapReady]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full bg-slate-200 dark:bg-slate-950"
      aria-label="Interactive Munich navigation map"
    />
  );
}
