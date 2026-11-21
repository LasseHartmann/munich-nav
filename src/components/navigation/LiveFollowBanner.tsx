'use client';

import { useEffect, useMemo, useState } from 'react';
import { Navigation, Sun, X } from 'lucide-react';
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

  const [wakeLocked, setWakeLocked] = useState(false);

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

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const acquire = () => {
      if (released || document.visibilityState !== 'visible') return;
      navigator.wakeLock
        .request('screen')
        .then((lock) => {
          if (released) {
            void lock.release();
            return;
          }
          sentinel = lock;
          setWakeLocked(true);
          lock.addEventListener('release', () => {
            setWakeLocked(false);
          });
        })
        .catch(() => {
          setWakeLocked(false);
        });
    };

    acquire();

    const onVisChange = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisChange);
      if (sentinel) {
        void sentinel.release();
        sentinel = null;
      }
      setWakeLocked(false);
    };
  }, [active]);

  const progress = useMemo(() => {
    if (!userLocation) return null;

    if (roadRoute && roadRoute.coordinates.length > 1) {
      const { index } = findNearestCoordinateIndex(
        userLocation.lat,
        userLocation.lon,
        roadRoute.coordinates
      );
      const remainingMeters = computeRemainingDistanceMeters(index, roadRoute.coordinates);

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
        const { index } = findNearestCoordinateIndex(
          userLocation.lat,
          userLocation.lon,
          allCoords
        );
        const remainingMeters = computeRemainingDistanceMeters(index, allCoords);

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
    <div className="fixed pt-safe inset-x-3 top-0 md:inset-x-auto md:top-3 md:left-[calc(50%+195px)] md:-translate-x-1/2 z-30 md:w-[min(460px,calc(100vw-460px))] pointer-events-none">
      <div className="pointer-events-auto rounded-lg bg-[#181818] text-white border border-[#333333] shadow-xl px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Navigation className="w-4 h-4 text-[#eb0000] shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#b7b7b7]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#eb0000] animate-pulse" />
                  {t.liveFollowActive}
                </span>
                {wakeLocked && (
                  <span className="inline-flex items-center gap-1 text-[#d4d4d4]">
                    <Sun className="w-3 h-3" />
                    <span className="hidden sm:inline">{t.screenAwake}</span>
                  </span>
                )}
              </div>
              {gpsError ? (
                <div className="text-xs text-[#f87171] font-medium mt-0.5">{gpsError}</div>
              ) : progress ? (
                <>
                  <div className="text-sm font-semibold leading-snug mt-0.5 truncate">
                    {progress.headline}
                  </div>
                  <div className="text-xs text-[#b7b7b7] tabular-nums mt-0.5">
                    {progress.detail}
                  </div>
                </>
              ) : (
                <div className="text-xs text-[#b7b7b7] mt-0.5">{t.liveFollowWaiting}</div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLiveFollowActive(false)}
            className="h-9 px-3 rounded-md inline-flex items-center justify-center gap-1 text-xs font-semibold bg-[#eb0000] hover:bg-[#c60018] text-white shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>{t.liveFollowStop}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
