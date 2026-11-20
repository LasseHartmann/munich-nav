'use client';

import { useEffect } from 'react';
import { encodeRouteToQuery } from '@/lib/urlState';
import { useNavStore } from '@/store/useNavStore';
import { MapCanvas } from '@/components/map/MapCanvas';
import { MapControls } from '@/components/map/MapControls';
import { StationPopup } from '@/components/map/StationPopup';
import { MapClickCard } from '@/components/map/MapClickCard';
import { PlannerPanel } from '@/components/planner/PlannerPanel';
import { LiveFollowBanner } from '@/components/navigation/LiveFollowBanner';

export function MucNavApp() {
  const initialized = useNavStore((s) => s.initialized);
  const hydrateClient = useNavStore((s) => s.hydrateClient);
  const theme = useNavStore((s) => s.theme);
  const lang = useNavStore((s) => s.lang);
  const mode = useNavStore((s) => s.mode);
  const mapStyle = useNavStore((s) => s.mapStyle);
  const waypoints = useNavStore((s) => s.waypoints);
  const departMode = useNavStore((s) => s.departMode);
  const departAtLocal = useNavStore((s) => s.departAtLocal);
  const transitFilters = useNavStore((s) => s.transitFilters);

  useEffect(() => {
    hydrateClient();
  }, [hydrateClient]);

  // Sync Tailwind dark class & document lang attribute
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.lang = lang;
  }, [theme, lang]);

  // Keep browser address bar synced for easy sharing
  useEffect(() => {
    if (!initialized || typeof window === 'undefined') return;
    const filled = waypoints.filter((w) => w.place !== null);
    if (filled.length === 0 && mapStyle === 'standard' && mode === 'transit') {
      if (window.location.search) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      return;
    }
    const qs = encodeRouteToQuery({
      mode,
      mapStyle,
      waypoints,
      departMode,
      departAtLocal,
      transitFilters,
    });
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (window.location.pathname + window.location.search !== nextUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [initialized, mode, mapStyle, waypoints, departMode, departAtLocal, transitFilters]);

  return (
    <main className="relative w-full h-dvh overflow-hidden select-none">
      <MapCanvas />
      <PlannerPanel />
      <MapControls />
      <LiveFollowBanner />
      <StationPopup />
      <MapClickCard />
    </main>
  );
}
