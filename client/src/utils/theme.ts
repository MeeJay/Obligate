export type AppTheme = 'modern' | 'neon' | 'obli-operator';

const STORAGE_KEY = 'og-theme';
const VALID_THEMES: AppTheme[] = ['modern', 'neon', 'obli-operator'];
const DEFAULT_THEME: AppTheme = 'obli-operator';

function isValidTheme(value: string | null | undefined): value is AppTheme {
  return !!value && (VALID_THEMES as string[]).includes(value);
}

export function applyTheme(theme: string): void {
  const safe: AppTheme = isValidTheme(theme) ? theme : DEFAULT_THEME;
  document.documentElement.dataset.theme = safe;
  try { localStorage.setItem(STORAGE_KEY, safe); } catch { /* ignore */ }
}

export function loadSavedTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isValidTheme(saved)) return saved;
  } catch { /* ignore */ }
  return DEFAULT_THEME;
}

export function initTheme(): void {
  applyTheme(loadSavedTheme());
}
