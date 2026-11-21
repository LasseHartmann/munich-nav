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

    if (typeof navigator !== 'undefined' && navigator.share && window.innerWidth < 768) {
      try {
        await navigator.share({ title: 'MucNav Munich Route', url });
        return;
      } catch {
        // Fall through to clipboard
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
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={handleShare}
        title={t.shareLink}
        aria-label={t.shareLink}
        className="inline-flex items-center justify-center gap-1 h-8 min-w-[32px] px-2 rounded-md text-xs font-medium text-[#444444] hover:text-[#111111] hover:bg-black/5 dark:text-[#b7b7b7] dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-[#007a3e] dark:text-[#34d399]" />
            <span className="text-[#007a3e] dark:text-[#34d399]">{t.linkCopied}</span>
          </>
        ) : (
          <Share2 className="w-4 h-4" />
        )}
      </button>

      <button
        type="button"
        onClick={() => setLang(lang === 'en' ? 'de' : 'en')}
        className="h-8 min-w-[32px] px-1.5 rounded-md text-xs font-semibold uppercase tracking-wide text-[#444444] hover:text-[#111111] hover:bg-black/5 dark:text-[#b7b7b7] dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer"
        title="Switch language (EN / DE)"
      >
        {lang === 'en' ? 'DE' : 'EN'}
      </button>

      <button
        type="button"
        onClick={toggleTheme}
        className="h-8 w-8 rounded-md inline-flex items-center justify-center text-[#444444] hover:text-[#111111] hover:bg-black/5 dark:text-[#b7b7b7] dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer"
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        aria-label="Toggle color theme"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    </div>
  );
}
