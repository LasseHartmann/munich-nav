'use client';

import { useEffect, useMemo, useState } from 'react';
import { Navigation, Radio, Sun, X } from 'lucide-react';
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

  // Live GPS watchPosition
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

  // Screen Wake Lock while actively following a route on phone (keeps display from dimming!)
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
    <div className="fixed pt-safe inset-x-3 top-0 md:inset-x-auto md:top-3 md:left-[calc(50%+195px)] md:-translate-x-1/2 z-30 md:w-[min(480px,calc(100vw-480px))] pointer-events-none">
      <div className="pointer-events-auto rounded-2xl bg-[#0b1120]/96 text-white border-2 border-[#0065ae] shadow-2xl px-3.5 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0065ae] to-[#00a984] flex items-center justify-center shrink-0 shadow-md">
              <Navigation className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                <span className="inline-flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse" />
                  {t.liveFollowActive}
                </span>
                {wakeLocked && (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <Sun className="w-3 h-3" />
                    <span className="hidden sm:inline">{t.screenAwake}</span>
                  </span>
                )}
              </div>
              {gpsError ? (
                <div className="text-xs text-amber-300 font-bold mt-0.5">{gpsError}</div>
              ) : progress ? (
                <>
                  <div className="text-[15px] font-extrabold leading-tight mt-0.5 truncate">
                    {progress.headline}
                  </div>
                  <div className="text-xs font-bold text-sky-300 tabular-nums mt-0.5">
                    {progress.detail}
                  </div>
                </>
              ) : (
                <div className="text-xs font-semibold text-slate-300 mt-0.5">
                  {t.liveFollowWaiting}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLiveFollowActive(false)}
            className="h-10 px-3 rounded-xl inline-flex items-center justify-center gap-1 text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white active:scale-95 shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>{t.liveFollowStop}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
