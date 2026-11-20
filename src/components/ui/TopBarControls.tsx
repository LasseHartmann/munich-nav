'use client';

import { useState } from 'react';
import { Check, Moon, Share2, Sun } from 'lucide-react';
import { useNavStore } from '@/store/useNavStore';
import { getTranslations } from '@/lib/i18n';
import { encodeRouteToQuery } from '@/lib/urlState';

export function TopBarControls() {
  const theme = useNavStore((s) => s.theme);
  const toggleTheme = useNavStore((s) => s.toggleTheme);
  const lang = useNavStore((s) => s.lang);
  const setLang = useNavStore((s) => s.setLang);
  const mode = useNavStore((s) => s.mode);
  const mapStyle = useNavStore((s) => s.mapStyle);
  const waypoints = useNavStore((s) => s.waypoints);
  const departMode = useNavStore((s) => s.departMode);
  const departAtLocal = useNavStore((s) => s.departAtLocal);
  const transitFilters = useNavStore((s) => s.transitFilters);

  const t = getTranslations(lang);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const qs = encodeRouteToQuery({
      mode,
      mapStyle,
      waypoints,
      departMode,
      departAtLocal,
      transitFilters,
    });
    const url = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.history.replaceState(null, '', url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleShare}
        title={t.shareLink}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-emerald-600 dark:text-emerald-400 hidden sm:inline">
              {t.linkCopied}
            </span>
          </>
        ) : (
          <>
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.shareLink}</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => setLang(lang === 'en' ? 'de' : 'en')}
        className="rounded-lg px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        title="Switch language (EN / DE)"
      >
        {lang === 'en' ? 'DE' : 'EN'}
      </button>

      <button
        type="button"
        onClick={toggleTheme}
        className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        aria-label="Toggle color theme"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
      </button>
    </div>
  );
}
