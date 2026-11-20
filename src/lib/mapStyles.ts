import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';
import type { MapStyleMode, ThemeMode } from './types';

const OPENFREEMAP_LIGHT_URL = 'https://tiles.openfreemap.org/styles/liberty';
const OPENFREEMAP_DARK_URL = 'https://tiles.openfreemap.org/styles/dark';

const ESRI_WORLD_IMAGERY_TILES = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
];

let cachedHybridStyle: StyleSpecification | null = null;
let maptilerBlockedOnOrigin = false;

/**
 * Returns a MapLibre style URL or StyleSpecification.
 * Uses MapTiler (Streets Light/Dark + Hybrid) if NEXT_PUBLIC_MAPTILER_KEY is configured AND accepted
 * by MapTiler for the current origin, and falls back seamlessly to OpenFreeMap + Esri World Imagery
 * Hybrid (e.g., if no key is set, if MapTiler origin restrictions reject localhost, or if quota is exceeded).
 */
export async function resolveMapStyle(
  mapStyle: MapStyleMode,
  theme: ThemeMode
): Promise<string | StyleSpecification> {
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();

  if (maptilerKey && !maptilerBlockedOnOrigin) {
    const styleId =
      mapStyle === 'hybrid'
        ? 'hybrid'
        : theme === 'dark'
          ? 'streets-v2-dark'
          : 'streets-v2';
    const maptilerUrl = `https://api.maptiler.com/maps/${styleId}/style.json?key=${encodeURIComponent(maptilerKey)}`;
    try {
      const probe = await fetch(maptilerUrl);
      if (probe.ok) {
        return (await probe.json()) as StyleSpecification;
      }
      if (probe.status === 401 || probe.status === 403 || probe.status === 429) {
        maptilerBlockedOnOrigin = true;
      }
    } catch {
      // Network failure — gracefully fall back to open tiles below
    }
  }

  // Zero-key automatic fallback
  if (mapStyle === 'standard') {
    return theme === 'dark' ? OPENFREEMAP_DARK_URL : OPENFREEMAP_LIGHT_URL;
  }

  // Build Hybrid style: Esri Satellite Imagery + OpenFreeMap vector roads & labels overlay
  if (cachedHybridStyle) return cachedHybridStyle;

  try {
    const res = await fetch(OPENFREEMAP_DARK_URL);
    if (!res.ok) throw new Error('Failed to load OpenFreeMap base style');
    const baseStyle = (await res.json()) as StyleSpecification;

    // Keep vector roads, bridges, tunnels, boundaries, symbols & labels while stripping opaque surface fills
    const overlayLayers: LayerSpecification[] = baseStyle.layers
      .filter((layer) => {
        if (layer.type === 'background' || layer.type === 'raster') return false;
        if (layer.type === 'fill' || layer.type === 'fill-extrusion') {
          // Drop land/water/park/building solid fills so satellite imagery shines through clearly
          return false;
        }
        // Keep road lines, rail lines, borders, and all text/icon symbol layers
        return true;
      })
      .map((layer) => {
        if (layer.type === 'symbol') {
          return {
            ...layer,
            paint: {
              ...(layer.paint || {}),
              'text-color': '#ffffff',
              'text-halo-color': 'rgba(10, 15, 25, 0.88)',
              'text-halo-width': 1.6,
            },
          } as LayerSpecification;
        }
        if (layer.type === 'line') {
          const idLower = layer.id.toLowerCase();
          const isRoad =
            idLower.includes('road') ||
            idLower.includes('highway') ||
            idLower.includes('motorway') ||
            idLower.includes('trunk') ||
            idLower.includes('street') ||
            idLower.includes('bridge') ||
            idLower.includes('path');
          if (isRoad) {
            return {
              ...layer,
              paint: {
                ...(layer.paint || {}),
                'line-opacity': 0.72,
              },
            } as LayerSpecification;
          }
        }
        return layer;
      });

    const hybridStyle: StyleSpecification = {
      ...baseStyle,
      name: 'MucNav Hybrid (Esri Imagery + OpenFreeMap Labels)',
      sources: {
        ...baseStyle.sources,
        'esri-world-imagery': {
          type: 'raster',
          tiles: ESRI_WORLD_IMAGERY_TILES,
          tileSize: 256,
          maxzoom: 19,
          attribution: 'Imagery © Esri',
        },
      },
      layers: [
        {
          id: 'esri-satellite-base',
          type: 'raster',
          source: 'esri-world-imagery',
          minzoom: 0,
          maxzoom: 22,
          paint: {
            'raster-saturation': 0.05,
            'raster-contrast': 0.05,
          },
        },
        ...overlayLayers,
      ],
    };

    cachedHybridStyle = hybridStyle;
    return hybridStyle;
  } catch {
    // Ultra-safe pure raster fallback if OpenFreeMap fetch fails
    return {
      version: 8,
      name: 'Esri Satellite Fallback',
      sources: {
        'esri-world-imagery': {
          type: 'raster',
          tiles: ESRI_WORLD_IMAGERY_TILES,
          tileSize: 256,
          maxzoom: 19,
          attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
        },
        'esri-labels': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          maxzoom: 19,
        },
        'esri-places': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          maxzoom: 19,
        },
      },
      layers: [
        { id: 'esri-sat', type: 'raster', source: 'esri-world-imagery' },
        { id: 'esri-roads', type: 'raster', source: 'esri-labels' },
        { id: 'esri-places-lbl', type: 'raster', source: 'esri-places' },
      ],
    };
  }
}

export function isUsingMapTiler(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim());
}
