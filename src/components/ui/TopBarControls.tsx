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
  const walkOptions = useNavStore((s) => s.walkOptions);

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
      walkOptions,
    });
    const url = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ''}`;

    // Use native Web Share API on mobile when available, else clipboard
    if (typeof navigator !== 'undefined' && navigator.share && window.innerWidth < 768) {
      try {
        await navigator.share({ title: 'MucNav Munich Route', url });
        return;
      } catch {
        // User cancelled or unsupported — fall through to clipboard
      }
    }

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
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleShare}
        title={t.shareLink}
        aria-label={t.shareLink}
        className="inline-flex items-center justify-center gap-1 h-9 min-w-[36px] px-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 active:scale-95 transition-all cursor-pointer"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-emerald-600 dark:text-emerald-400">{t.linkCopied}</span>
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
        className="h-9 min-w-[36px] px-2 rounded-xl text-xs font-extrabold uppercase tracking-wide bg-slate-100 hover:bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 active:scale-95 transition-all cursor-pointer"
        title="Switch language (EN / DE)"
      >
        {lang === 'en' ? 'DE' : 'EN'}
      </button>

      <button
        type="button"
        onClick={toggleTheme}
        className="h-9 w-9 rounded-xl inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 active:scale-95 transition-all cursor-pointer"
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        aria-label="Toggle color theme"
      >
        {theme === 'dark' ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-slate-700" />
        )}
      </button>
    </div>
  );
}
