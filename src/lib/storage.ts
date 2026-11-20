import type { Language, PlaceResult, SavedPlace, ThemeMode } from './types';

const KEYS = {
  favorites: 'mucnav_favorites_v1',
  recents: 'mucnav_recents_v1',
  theme: 'mucnav_theme_v1',
  lang: 'mucnav_lang_v1',
};

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadFavorites(): SavedPlace[] {
  return safeGet<SavedPlace[]>(KEYS.favorites, []);
}

export function saveFavorites(places: SavedPlace[]): void {
  safeSet(KEYS.favorites, places.slice(0, 25));
}

export function loadRecents(): PlaceResult[] {
  return safeGet<PlaceResult[]>(KEYS.recents, []);
}

export function saveRecents(places: PlaceResult[]): void {
  safeSet(KEYS.recents, places.slice(0, 12));
}

export function loadSavedTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  const val = window.localStorage.getItem(KEYS.theme);
  return val === 'dark' || val === 'light' ? val : null;
}

export function persistTheme(theme: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEYS.theme, theme);
  } catch {}
}

export function loadSavedLang(): Language | null {
  if (typeof window === 'undefined') return null;
  const val = window.localStorage.getItem(KEYS.lang);
  return val === 'en' || val === 'de' ? val : null;
}

export function persistLang(lang: Language): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEYS.lang, lang);
  } catch {}
}
