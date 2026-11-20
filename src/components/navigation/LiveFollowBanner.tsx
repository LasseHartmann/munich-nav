'use client';

import { useEffect, useMemo } from 'react';
import { Navigation, Radio, X } from 'lucide-react';
import {
  computeRemainingDistanceMeters,
  findNearestCoordinateIndex,
  formatDistance,
  formatMunichTime,
} from '@/lib/geo';
import { getTranslations } from '@/lib/i18n';
import { useNavStore } from '@/store/useNavStore';

export function LiveFollowBanner() {
  const active = useNavStore((s) => s.liveFollowActive);
  const setLiveFollowActive = useNavStore((s) => s.setLiveFollowActive);
  const userLocation = useNavStore((s) => s.userLocation);
  const setUserLocation = useNavStore((s) => s.setUserLocation);
  const gpsError = useNavStore((s) => s.gpsError);
  const setGpsError = useNavStore((s) => s.setGpsError);
  const roadRoute = useNavStore((s) => s.roadRoute);
  const transitPlan = useNavStore((s) => s.transitPlan);
  const flyTo = useNavStore((s) => s.flyTo);
  const lang = useNavStore((s) => s.lang);
  const t = getTranslations(lang);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError(t.liveFollowError);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy, heading } = pos.coords;
        setGpsError(null);
        setUserLocation({ lat, lon, accuracy, heading });
        flyTo(lat, lon, 16);
      },
      () => {
        setGpsError(t.liveFollowError);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [active, setUserLocation, setGpsError, flyTo, t.liveFollowError]);

  const progress = useMemo(() => {
    if (!userLocation) return null;

    if (roadRoute && roadRoute.coordinates.length > 1) {
      const { index } = findNearestCoordinateIndex(
        userLocation.lat,
        userLocation.lon,
        roadRoute.coordinates
      );
      const remainingMeters = computeRemainingDistanceMeters(index, roadRoute.coordinates);

      // Find next maneuver across legs
      let offset = 0;
      let nextInstruction = '';
      for (const leg of roadRoute.legs) {
        for (const m of leg.maneuvers) {
          const mStart = offset + (m.beginShapeIndex ?? 0);
          if (mStart >= index && m.instruction) {
            nextInstruction = m.instruction;
            break;
          }
        }
        if (nextInstruction) break;
        offset += Math.max(0, leg.coordinates.length - 1);
      }
      if (!nextInstruction) {
        const lastLeg = roadRoute.legs[roadRoute.legs.length - 1];
        nextInstruction =
          lastLeg?.maneuvers[lastLeg.maneuvers.length - 1]?.instruction || t.arrivingAt;
      }

      return {
        headline: nextInstruction,
        detail: `${formatDistance(remainingMeters, lang)} ${t.remaining}`,
      };
    }

    if (transitPlan && transitPlan.legs.length > 0) {
      const allSegs = transitPlan.legs.flatMap((leg) => {
        const itin = leg.alternatives[leg.selectedIndex];
        return itin ? itin.segments : [];
      });
      const allCoords = allSegs.flatMap((s) => s.coordinates);
      if (allCoords.length > 1) {
        const { index } = findNearestCoordinateIndex(userLocation.lat, userLocation.lon, allCoords);
        const remainingMeters = computeRemainingDistanceMeters(index, allCoords);

        // Find current or next segment
        let cursor = 0;
        let currentSeg = allSegs[0];
        for (const seg of allSegs) {
          const endCursor = cursor + seg.coordinates.length;
          if (index <= endCursor) {
            currentSeg = seg;
            break;
          }
          cursor = endCursor;
        }

        const headline =
          currentSeg.mode === 'WALK'
            ? `${t.walkSegment} → ${currentSeg.toName}`
            : `${currentSeg.routeShortName || currentSeg.mode} → ${currentSeg.headsign || currentSeg.toName} (${formatMunichTime(currentSeg.startTime, lang)})`;

        return {
          headline,
          detail: `${formatDistance(remainingMeters, lang)} ${t.remaining}`,
        };
      }
    }

    return null;
  }, [userLocation, roadRoute, transitPlan, lang, t]);

  if (!active) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-30 w-[min(480px,calc(100vw-24px))] md:left-[calc(50%+180px)] rounded-2xl bg-slate-900/95 text-white border border-sky-500/40 shadow-2xl px-4 py-3 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#0065ae] flex items-center justify-center shrink-0 mt-0.5">
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-400">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>{t.liveFollowActive}</span>
            </div>
            {gpsError ? (
              <div className="text-xs text-amber-300 font-medium mt-0.5">{gpsError}</div>
            ) : progress ? (
              <>
                <div className="text-sm font-bold leading-snug mt-0.5 truncate">
                  {progress.headline}
                </div>
                <div className="text-xs text-slate-300 mt-0.5">{progress.detail}</div>
              </>
            ) : (
              <div className="text-xs text-slate-300 mt-0.5">{t.liveFollowWaiting}</div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLiveFollowActive(false)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shrink-0 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.liveFollowStop}</span>
        </button>
      </div>
    </div>
  );
}
