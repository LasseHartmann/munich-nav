'use client';

import { useState } from 'react';
import {
  Crosshair,
  Loader2,
  Map as MapIcon,
  Maximize2,
  Satellite,
  TrainFront,
} from 'lucide-react';
import { useNavStore } from '@/store/useNavStore';
import { getTranslations } from '@/lib/i18n';

export function MapControls() {
  const mapStyle = useNavStore((s) => s.mapStyle);
  const setMapStyle = useNavStore((s) => s.setMapStyle);
  const showStations = useNavStore((s) => s.showStations);
  const toggleShowStations = useNavStore((s) => s.toggleShowStations);
  const mobileSheetSnap = useNavStore((s) => s.mobileSheetSnap);
  const liveFollowActive = useNavStore((s) => s.liveFollowActive);
  const mode = useNavStore((s) => s.mode);
  const lang = useNavStore((s) => s.lang);
  const roadRoute = useNavStore((s) => s.roadRoute);
  const transitPlan = useNavStore((s) => s.transitPlan);
  const triggerFitBounds = useNavStore((s) => s.triggerFitBounds);
  const setUserLocation = useNavStore((s) => s.setUserLocation);
  const flyTo = useNavStore((s) => s.flyTo);

  const t = getTranslations(lang);
  const [locating, setLocating] = useState(false);

  const hasRoute = Boolean(roadRoute || transitPlan);
  const isHybrid = mapStyle === 'hybrid';

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy, heading } = pos.coords;
        setUserLocation({ lat, lon, accuracy, heading });
        flyTo(lat, lon, 15.2);
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  };

  const mobilePositionStyle: React.CSSProperties = liveFollowActive
    ? {
        top:
          mode === 'transit'
            ? 'calc(max(0.75rem, env(safe-area-inset-top)) + 56px)'
            : 'calc(max(0.75rem, env(safe-area-inset-top)) + 124px)',
      }
    : mobileSheetSnap === 'peek'
      ? { bottom: 'calc(max(158px, 18dvh + env(safe-area-inset-bottom)) + 12px)' }
      : { bottom: 'calc(50dvh + 10px)' };

  return (
    <>
      {/* Desktop Top-Right SBB Monochrome Controls */}
      <div className="hidden md:flex fixed top-3 right-3 z-20 flex-col items-end gap-2 pointer-events-none">
        <div className="pointer-events-auto inline-flex items-center p-0.5 rounded-lg bg-white dark:bg-[#212121] border border-[#d4d4d4] dark:border-[#383838] shadow-md">
          <button
            type="button"
            onClick={() => setMapStyle('standard')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              !isHybrid
                ? 'bg-[#212121] text-white dark:bg-white dark:text-[#111111] font-semibold'
                : 'text-[#686868] dark:text-[#999999] hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>{t.mapStandard}</span>
          </button>
          <button
            type="button"
            onClick={() => setMapStyle('hybrid')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              isHybrid
                ? 'bg-[#212121] text-white dark:bg-white dark:text-[#111111] font-semibold'
                : 'text-[#686868] dark:text-[#999999] hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>{t.mapHybrid}</span>
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleShowStations}
            title={t.mvvStations}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border shadow-md transition-colors cursor-pointer ${
              showStations
                ? 'bg-[#212121] border-[#212121] text-white dark:bg-white dark:border-white dark:text-[#111111] font-semibold'
                : 'bg-white dark:bg-[#212121] border-[#d4d4d4] dark:border-[#383838] text-[#444444] dark:text-[#cccccc] hover:text-[#111111]'
            }`}
          >
            <TrainFront className="w-3.5 h-3.5" />
            <span>{t.mvvStations}</span>
          </button>

          {hasRoute && (
            <button
              type="button"
              onClick={triggerFitBounds}
              title="Fit route to view"
              aria-label="Fit route to view"
              className="w-9 h-9 rounded-lg inline-flex items-center justify-center bg-white dark:bg-[#212121] border border-[#d4d4d4] dark:border-[#383838] shadow-md text-[#212121] dark:text-[#e5e5e5] hover:bg-[#f6f6f6] dark:hover:bg-[#2c2c2c] cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            title={t.myLocation}
            aria-label={t.myLocation}
            className="w-9 h-9 rounded-lg inline-flex items-center justify-center bg-white dark:bg-[#212121] border border-[#d4d4d4] dark:border-[#383838] shadow-md text-[#212121] dark:text-[#e5e5e5] hover:bg-[#f6f6f6] dark:hover:bg-[#2c2c2c] cursor-pointer disabled:opacity-60"
          >
            {locating ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#eb0000]" />
            ) : (
              <Crosshair className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Right-Side Thumb-Zone SBB Action Stack */}
      <div
        style={mobilePositionStyle}
        className={`md:hidden fixed right-3 z-20 flex flex-col items-end gap-1.5 transition-all duration-200 ${
          !liveFollowActive && mobileSheetSnap === 'full'
            ? 'opacity-0 pointer-events-none translate-y-3'
            : 'opacity-100 pointer-events-auto translate-y-0'
        }`}
      >
        <button
          type="button"
          onClick={() => setMapStyle(isHybrid ? 'standard' : 'hybrid')}
          aria-label={isHybrid ? t.mapStandard : t.mapHybrid}
          className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center border shadow-md transition-colors cursor-pointer ${
            isHybrid
              ? 'bg-[#212121] border-[#212121] text-white dark:bg-white dark:border-white dark:text-[#111111]'
              : 'bg-white dark:bg-[#212121] border-[#d4d4d4] dark:border-[#383838] text-[#212121] dark:text-[#e5e5e5]'
          }`}
        >
          {isHybrid ? <MapIcon className="w-4 h-4" /> : <Satellite className="w-4 h-4" />}
          <span className="text-[8px] font-semibold uppercase leading-none mt-0.5">
            {isHybrid ? 'MAP' : 'SAT'}
          </span>
        </button>

        <button
          type="button"
          onClick={toggleShowStations}
          aria-label={t.mvvStations}
          className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center border shadow-md transition-colors cursor-pointer ${
            showStations
              ? 'bg-[#212121] border-[#212121] text-white dark:bg-white dark:border-white dark:text-[#111111]'
              : 'bg-white dark:bg-[#212121] border-[#d4d4d4] dark:border-[#383838] text-[#444444] dark:text-[#cccccc]'
          }`}
        >
          <TrainFront className="w-4 h-4" />
          <span className="text-[8px] font-semibold uppercase leading-none mt-0.5">MVV</span>
        </button>

        {hasRoute && (
          <button
            type="button"
            onClick={triggerFitBounds}
            aria-label="Fit route to view"
            className="w-10 h-10 rounded-lg flex items-center justify-center bg-white dark:bg-[#212121] border border-[#d4d4d4] dark:border-[#383838] shadow-md text-[#212121] dark:text-[#e5e5e5] cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          aria-label={t.myLocation}
          className="w-10 h-10 rounded-lg flex items-center justify-center bg-white dark:bg-[#212121] border border-[#d4d4d4] dark:border-[#383838] shadow-md text-[#111111] dark:text-white cursor-pointer disabled:opacity-60"
        >
          {locating ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#eb0000]" />
          ) : (
            <Crosshair className="w-4 h-4" />
          )}
        </button>
      </div>
    </>
  );
}
