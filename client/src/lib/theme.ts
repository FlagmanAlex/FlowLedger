import { useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'flowledger-theme';

/** Тема — предпочтение конкретного браузера/устройства, не поле профиля в
 *  Firestore: у разных людей с общим доступом к базе может быть свой выбор. */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  function setTheme(next: Theme) {
    applyTheme(next);
    setThemeState(next);
  }

  return { theme, setTheme };
}
