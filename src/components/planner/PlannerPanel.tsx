'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavStore } from '@/store/useNavStore';
import { getTranslations } from '@/lib/i18n';
import { TopBarControls } from '@/components/ui/TopBarControls';
import { ModeSelector } from './ModeSelector';
import { StopList } from './StopList';
import { TransitOptionsBar } from './TransitOptionsBar';
import { WalkOptionsBar } from './WalkOptionsBar';
import { RouteResults } from './RouteResults';
import { MobileBottomSheet } from './MobileBottomSheet';

export function PlannerPanel() {
  const mode = useNavStore((s) => s.mode);
  const lang = useNavStore((s) => s.lang);
  const liveFollowActive = useNavStore((s) => s.liveFollowActive);
  const t = getTranslations(lang);

  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  // Hide planner chrome completely during Active Travel Mode so travel view owns the screen
  if (liveFollowActive) return null;

  return (
    <>
      {/* Desktop Floating Sidebar (SBB Mobile Swiss Aesthetic) */}
      <aside
        className={`hidden md:flex flex-col fixed top-3 left-3 bottom-3 z-20 transition-all duration-200 ${
          desktopCollapsed ? 'w-11' : 'w-[412px] max-w-[calc(100vw-24px)]'
        }`}
      >
        {desktopCollapsed ? (
          <button
            type="button"
            onClick={() => setDesktopCollapsed(false)}
            className="h-11 w-11 rounded-lg bg-white dark:bg-[#212121] border border-[#d4d4d4] dark:border-[#383838] shadow-md flex items-center justify-center text-[#111111] dark:text-white hover:bg-[#f6f6f6] dark:hover:bg-[#2c2c2c] cursor-pointer"
            title="Expand planner"
            aria-label="Expand planner"
          >
            <ChevronRight className="w-4.5 h-4.5" />
          </button>
        ) : (
          <div className="flex flex-col h-full rounded-xl bg-[#f6f6f6] dark:bg-[#151515] border border-[#d4d4d4] dark:border-[#333333] shadow-xl overflow-hidden">
            {/* Crisp White Top Header & Controls */}
            <div className="bg-white dark:bg-[#1e1e1e] border-b border-[#e5e5e5] dark:border-[#303030] shrink-0">
              <header className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    aria-hidden="true"
                    className="w-[3px] h-4.5 bg-[#eb0000] rounded-xs shrink-0"
                  />
                  <h1 className="text-[15px] font-bold tracking-tight text-[#111111] dark:text-white leading-none">
                    {t.appName}
                  </h1>
                  <span className="text-xs text-[#767676] dark:text-[#888888] truncate">
                    München
                  </span>
                </div>

                <div className="flex items-center gap-0.5">
                  <TopBarControls />
                  <button
                    type="button"
                    onClick={() => setDesktopCollapsed(true)}
                    className="h-8 w-7 rounded-md inline-flex items-center justify-center text-[#686868] hover:text-[#111111] hover:bg-black/5 dark:text-[#999999] dark:hover:text-white dark:hover:bg-white/10 cursor-pointer"
                    title="Collapse panel"
                    aria-label="Collapse panel"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </header>

              <ModeSelector />

              <div className="px-4 py-3 space-y-2.5">
                <StopList />
                {mode === 'transit' && <TransitOptionsBar />}
                {mode === 'foot' && <WalkOptionsBar />}
              </div>
            </div>

            {/* Scrollable SBB Milk Body */}
            <div className="flex-1 overflow-y-auto px-3.5 py-3">
              <RouteResults />
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Pure Drag-Only Bottom Sheet */}
      <MobileBottomSheet />
    </>
  );
}
