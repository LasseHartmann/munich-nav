'use client';

import { useEffect } from 'react';
import { MapPinned, X } from 'lucide-react';
import { getTranslations } from '@/lib/i18n';
import { encodeRouteToQuery } from '@/lib/urlState';
import { useNavStore } from '@/store/useNavStore';
import { MapCanvas } from '@/components/map/MapCanvas';
import { MapControls } from '@/components/map/MapControls';
import { StationPopup } from '@/components/map/StationPopup';
import { MapClickCard } from '@/components/map/MapClickCard';
import { PlannerPanel } from '@/components/planner/PlannerPanel';
import { MobileSearchModal } from '@/components/planner/MobileSearchModal';
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
  const mapPickTargetUid = useNavStore((s) => s.mapPickTargetUid);
  const cancelMapPick = useNavStore((s) => s.cancelMapPick);

  const t = getTranslations(lang);

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

      {/* Desktop floating cards (mobile swaps them seamlessly inside MobileBottomSheet!) */}
      <StationPopup variant="floating" />
      <MapClickCard variant="floating" />

      {/* Mobile full-screen stop search modal */}
      <MobileSearchModal />

      {/* Mobile "Pick on Map" guidance pill */}
      {mapPickTargetUid && (
        <div className="fixed pt-safe inset-x-3 top-0 z-40 flex justify-center pointer-events-none">
          <div className="pointer-events-auto inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#0065ae] text-white shadow-2xl border border-white/25">
            <MapPinned className="w-4.5 h-4.5 shrink-0" />
            <span className="text-xs font-extrabold">{t.pickOnMapBanner}</span>
            <button
              type="button"
              onClick={cancelMapPick}
              className="ml-1 w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 inline-flex items-center justify-center active:scale-90 cursor-pointer"
              aria-label={t.cancel}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
