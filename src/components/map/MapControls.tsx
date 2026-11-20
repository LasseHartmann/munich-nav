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

  // Dynamic thumb-zone bottom offset right above the mobile bottom sheet
  const mobileBottomStyle: React.CSSProperties =
    mobileSheetSnap === 'peek'
      ? { bottom: 'calc(max(162px, 18dvh + env(safe-area-inset-bottom)) + 14px)' }
      : { bottom: 'calc(50dvh + 12px)' };

  return (
    <>
      {/* Desktop Top-Right Floating Controls */}
      <div className="hidden md:flex fixed top-3 right-3 z-20 flex-col items-end gap-2 pointer-events-none">
        <div className="pointer-events-auto inline-flex items-center p-1 rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 shadow-xl">
          <button
            type="button"
            onClick={() => setMapStyle('standard')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all active:scale-95 cursor-pointer ${
              !isHybrid
                ? 'bg-[#0065ae] text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>{t.mapStandard}</span>
          </button>
          <button
            type="button"
            onClick={() => setMapStyle('hybrid')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all active:scale-95 cursor-pointer ${
              isHybrid
                ? 'bg-[#0065ae] text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
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
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-extrabold backdrop-blur-xl border shadow-lg active:scale-95 transition-all cursor-pointer ${
              showStations
                ? 'bg-[#0065ae] border-[#0065ae] text-white'
                : 'bg-white/95 dark:bg-[#0f172a]/95 border-slate-200/90 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
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
              className="w-9 h-9 rounded-xl inline-flex items-center justify-center bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 shadow-lg text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 active:scale-95 cursor-pointer"
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
            className="w-9 h-9 rounded-xl inline-flex items-center justify-center bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 shadow-lg text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 active:scale-95 cursor-pointer disabled:opacity-60"
          >
            {locating ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#0065ae]" />
            ) : (
              <Crosshair className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Right-Side Thumb-Zone Floating Action Stack (dynamically floats above the bottom sheet!) */}
      <div
        style={mobileBottomStyle}
        className={`md:hidden fixed right-3 z-20 flex flex-col items-end gap-2 transition-all duration-300 ${
          mobileSheetSnap === 'full'
            ? 'opacity-0 pointer-events-none translate-y-4'
            : 'opacity-100 pointer-events-auto translate-y-0'
        }`}
      >
        {/* Standard <-> Hybrid one-tap toggle pill */}
        <button
          type="button"
          onClick={() => setMapStyle(isHybrid ? 'standard' : 'hybrid')}
          aria-label={isHybrid ? t.mapStandard : t.mapHybrid}
          className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center border-2 shadow-xl backdrop-blur-xl active:scale-90 transition-all cursor-pointer ${
            isHybrid
              ? 'bg-[#0065ae] border-white/80 text-white'
              : 'bg-white/95 dark:bg-[#0f172a]/95 border-slate-200/90 dark:border-slate-700 text-slate-800 dark:text-slate-100'
          }`}
        >
          {isHybrid ? <MapIcon className="w-4.5 h-4.5" /> : <Satellite className="w-4.5 h-4.5" />}
          <span className="text-[8px] font-extrabold uppercase leading-none mt-0.5">
            {isHybrid ? 'MAP' : 'SAT'}
          </span>
        </button>

        {/* MVV Stops toggle */}
        <button
          type="button"
          onClick={toggleShowStations}
          aria-label={t.mvvStations}
          className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center border-2 shadow-xl backdrop-blur-xl active:scale-90 transition-all cursor-pointer ${
            showStations
              ? 'bg-[#0065ae] border-white/80 text-white'
              : 'bg-white/95 dark:bg-[#0f172a]/95 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200'
          }`}
        >
          <TrainFront className="w-4.5 h-4.5" />
          <span className="text-[8px] font-extrabold uppercase leading-none mt-0.5">MVV</span>
        </button>

        {/* Fit route button */}
        {hasRoute && (
          <button
            type="button"
            onClick={triggerFitBounds}
            aria-label="Fit route to view"
            className="w-11 h-11 rounded-2xl flex items-center justify-center bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border-2 border-slate-200/90 dark:border-slate-700 shadow-xl text-slate-800 dark:text-slate-100 active:scale-90 transition-all cursor-pointer"
          >
            <Maximize2 className="w-4.5 h-4.5" />
          </button>
        )}

        {/* Locate Me GPS button */}
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          aria-label={t.myLocation}
          className="w-11 h-11 rounded-2xl flex items-center justify-center bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border-2 border-slate-200/90 dark:border-slate-700 shadow-xl text-[#0065ae] dark:text-sky-400 active:scale-90 transition-all cursor-pointer disabled:opacity-60"
        >
          {locating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Crosshair className="w-5 h-5" />
          )}
        </button>
      </div>
    </>
  );
}
