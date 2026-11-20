'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Compass } from 'lucide-react';
import { useNavStore } from '@/store/useNavStore';
import { getTranslations } from '@/lib/i18n';
import { TopBarControls } from '@/components/ui/TopBarControls';
import { ModeSelector } from './ModeSelector';
import { StopList } from './StopList';
import { TransitOptionsBar } from './TransitOptionsBar';
import { RouteResults } from './RouteResults';
import { MobileBottomSheet } from './MobileBottomSheet';

export function PlannerPanel() {
  const mode = useNavStore((s) => s.mode);
  const lang = useNavStore((s) => s.lang);
  const t = getTranslations(lang);

  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  return (
    <>
      {/* Desktop Floating Sidebar (Unified Citymapper-style Munich Design) */}
      <aside
        className={`hidden md:flex flex-col fixed top-3 left-3 bottom-3 z-20 transition-all duration-300 ${
          desktopCollapsed ? 'w-12' : 'w-[424px] max-w-[calc(100vw-24px)]'
        }`}
      >
        {desktopCollapsed ? (
          <button
            type="button"
            onClick={() => setDesktopCollapsed(false)}
            className="h-12 w-12 rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border-2 border-slate-200/90 dark:border-slate-700/80 shadow-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
            title="Expand planner"
            aria-label="Expand planner"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <div className="flex flex-col h-full rounded-[24px] bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xl overflow-hidden">
            {/* Brand Header */}
            <header className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0065ae] to-[#00a984] flex items-center justify-center text-white shadow-sm shrink-0">
                  <Compass className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                    {t.appName}
                  </h1>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {t.appTagline}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <TopBarControls />
                <button
                  type="button"
                  onClick={() => setDesktopCollapsed(true)}
                  className="h-9 w-8 rounded-xl inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  title="Collapse panel"
                  aria-label="Collapse panel"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Planner Controls */}
            <div className="px-4 py-3 border-b border-slate-200/70 dark:border-slate-800 space-y-2.5 shrink-0">
              <ModeSelector />
              <StopList />
              {mode === 'transit' && <TransitOptionsBar />}
            </div>

            {/* Scrollable Route Results */}
            <div className="flex-1 overflow-y-auto px-4 py-3.5">
              <RouteResults />
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Touch-Draggable 3-Snap Bottom Sheet */}
      <MobileBottomSheet />
    </>
  );
}
