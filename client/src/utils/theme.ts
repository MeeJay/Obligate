export type AppTheme = 'modern' | 'neon';

const STORAGE_KEY = 'og-theme';

export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
}

export function loadSavedTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'modern' || saved === 'neon') return saved;
  } catch { /* ignore */ }
  return 'modern';
}

export function initTheme(): void {
  applyTheme(loadSavedTheme());
}
