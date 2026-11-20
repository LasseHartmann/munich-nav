'use client';

import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Compass } from 'lucide-react';
import { useNavStore } from '@/store/useNavStore';
import { getTranslations } from '@/lib/i18n';
import { TopBarControls } from '@/components/ui/TopBarControls';
import { ModeSelector } from './ModeSelector';
import { StopList } from './StopList';
import { TransitOptionsBar } from './TransitOptionsBar';
import { RouteResults } from './RouteResults';

export function PlannerPanel() {
  const mode = useNavStore((s) => s.mode);
  const lang = useNavStore((s) => s.lang);
  const t = getTranslations(lang);

  // Desktop collapse state & Mobile sheet height state
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(true);

  return (
    <>
      {/* Desktop Floating Sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed top-3 left-3 bottom-3 z-20 transition-all duration-300 ${
          desktopCollapsed ? 'w-12' : 'w-[410px] max-w-[calc(100vw-24px)]'
        }`}
      >
        {desktopCollapsed ? (
          <button
            type="button"
            onClick={() => setDesktopCollapsed(false)}
            className="h-12 w-12 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 shadow-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
            title="Expand planner"
            aria-label="Expand planner"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <div className="flex flex-col h-full rounded-2xl bg-white/94 dark:bg-slate-900/94 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/80 shadow-2xl overflow-hidden">
            {/* Brand Header */}
            <header className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0065ae] to-[#00a984] flex items-center justify-center text-white shadow-sm shrink-0">
                  <Compass className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                    {t.appName}
                  </h1>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {t.appTagline}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-0.5">
                <TopBarControls />
                <button
                  type="button"
                  onClick={() => setDesktopCollapsed(true)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
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
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <RouteResults />
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Collapsible Bottom Sheet */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-20 pointer-events-none">
        <div
          className={`pointer-events-auto flex flex-col rounded-t-3xl bg-white/96 dark:bg-slate-900/96 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-700/80 shadow-[0_-8px_30px_rgba(0,0,0,0.16)] transition-all duration-300 ${
            mobileExpanded ? 'max-h-[76dvh]' : 'max-h-[126px]'
          }`}
        >
          {/* Sheet handle + header */}
          <div className="px-4 pt-2 pb-2 shrink-0">
            <button
              type="button"
              onClick={() => setMobileExpanded((v) => !v)}
              className="w-full flex flex-col items-center pb-1.5 cursor-pointer"
              aria-label={mobileExpanded ? 'Collapse sheet' : 'Expand sheet'}
            >
              <span className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mb-1" />
            </button>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMobileExpanded((v) => !v)}
                className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0065ae] to-[#00a984] flex items-center justify-center text-white shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {t.appName}
                </span>
                {mobileExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                )}
              </button>
              <TopBarControls />
            </div>

            <div className="mt-2">
              <ModeSelector />
            </div>
          </div>

          {mobileExpanded && (
            <div className="flex-1 overflow-y-auto px-4 pb-5 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">
              <StopList />
              {mode === 'transit' && <TransitOptionsBar />}
              <RouteResults />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
