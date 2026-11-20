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
  const lang = useNavStore((s) => s.lang);
  const roadRoute = useNavStore((s) => s.roadRoute);
  const transitPlan = useNavStore((s) => s.transitPlan);
  const triggerFitBounds = useNavStore((s) => s.triggerFitBounds);
  const setUserLocation = useNavStore((s) => s.setUserLocation);
  const flyTo = useNavStore((s) => s.flyTo);

  const t = getTranslations(lang);
  const [locating, setLocating] = useState(false);

  const hasRoute = Boolean(roadRoute || transitPlan);

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

  return (
    <div className="fixed top-3 right-3 z-20 flex flex-col items-end gap-2 pointer-events-none">
      {/* Standard vs Hybrid Map Switcher */}
      <div className="pointer-events-auto inline-flex items-center p-1 rounded-xl bg-white/94 dark:bg-slate-900/94 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 shadow-lg">
        <button
          type="button"
          onClick={() => setMapStyle('standard')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            mapStyle === 'standard'
              ? 'bg-[#0065ae] text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>{t.mapStandard}</span>
        </button>
        <button
          type="button"
          onClick={() => setMapStyle('hybrid')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            mapStyle === 'hybrid'
              ? 'bg-[#0065ae] text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Satellite className="w-3.5 h-3.5" />
          <span>{t.mapHybrid}</span>
        </button>
      </div>

      {/* Layer & Map Utility Buttons */}
      <div className="pointer-events-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleShowStations}
          title={t.mvvStations}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border shadow-md transition-all cursor-pointer ${
            showStations
              ? 'bg-[#0065ae]/95 border-[#0065ae] text-white'
              : 'bg-white/94 dark:bg-slate-900/94 border-slate-200/90 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <TrainFront className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.mvvStations}</span>
        </button>

        {hasRoute && (
          <button
            type="button"
            onClick={triggerFitBounds}
            title="Fit route to view"
            aria-label="Fit route to view"
            className="p-2 rounded-xl bg-white/94 dark:bg-slate-900/94 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 shadow-md text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
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
          className="p-2 rounded-xl bg-white/94 dark:bg-slate-900/94 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 shadow-md text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 cursor-pointer disabled:opacity-60"
        >
          {locating ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#0065ae]" />
          ) : (
            <Crosshair className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
