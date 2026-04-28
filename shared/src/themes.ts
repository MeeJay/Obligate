// ── Theme catalog ────────────────────────────────────────────────────────────
// Source of truth for themes Obligate offers in the theme selector.
// Apps consume `preferredTheme` (the id) from the SSO assertion and apply
// the matching local theme. The `tokens` / `perApp` / `fonts` blocks here
// are forwarded as-is so apps that don't ship their own implementation
// can render the theme from these values.

export type ThemeAppKey = 'obliview' | 'obliguard' | 'oblimap' | 'obliance' | 'oblihub';

export interface ThemeAppAccent {
  accent: string;
  hover:  string;
  dark:   string;
}

export interface ThemeFonts {
  sans: string[];
  mono: string[];
}

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  layoutVersion: string | null;
  tokens: Record<string, string>;
  perApp: Record<ThemeAppKey, ThemeAppAccent> | null;
  fonts: ThemeFonts | null;
}

// Default theme — Obli Operator (see D:\Obliance\docs\obli-design-system.md §10).
export const OBLI_OPERATOR_THEME: ThemeDefinition = {
  id: 'obli-operator',
  name: 'Obli Operator',
  description: 'Default dark theme for the Obli suite — Rajdhani display + JetBrains Mono numerics, brighter type scale, depth via shadow (no borders), per-app accent.',
  isDefault: true,
  layoutVersion: 'v1',

  tokens: {
    '--c-bg-primary':       '11 13 26',
    '--c-bg-secondary':     '19 23 40',
    '--c-bg-tertiary':      '24 28 48',
    '--c-bg-hover':         '255 255 255 / 0.04',
    '--c-bg-active':        '255 255 255 / 0.06',
    '--c-border':           '255 255 255 / 0.05',
    '--c-border-light':     '255 255 255 / 0.08',
    '--c-text-primary':     '232 236 245',
    '--c-text-secondary':   '140 147 182',
    '--c-text-muted':       '75 82 115',

    '--c-status-up':        '30 221 138',
    '--c-status-down':      '107 115 153',
    '--c-status-pending':   '79 123 255',
    '--c-status-warning':   '245 166 35',
    '--c-status-critical':  '224 58 58',

    '--c-accent':           '224 58 58',
    '--c-accent-hover':     '255 104 104',
    '--c-accent-dark':      '180 30 30',
    '--c-primary':          '224 58 58',
  },

  perApp: {
    obliview:  { accent: '43 196 189',  hover: '95 217 211',  dark: '24 142 138' },
    obliguard: { accent: '245 166 35',  hover: '255 184 74',  dark: '184 124 24' },
    oblimap:   { accent: '30 221 138',  hover: '92 240 168',  dark: '20 165 105' },
    obliance:  { accent: '224 58 58',   hover: '255 104 104', dark: '180 30 30'  },
    oblihub:   { accent: '45 78 201',   hover: '90 120 232',  dark: '30 56 158'  },
  },

  fonts: {
    sans: ['Rajdhani', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
  },
};

// Legacy themes kept for users who chose them before obli-operator existed.
// CSS implementation lives in client/src/index.css (`[data-theme="modern"]` and
// `[data-theme="neon"]`); the catalog entries here are descriptors only.
export const OBLI_CLASSIC_THEME: ThemeDefinition = {
  id: 'modern',
  name: 'Modern UI',
  description: 'Original GitHub-inspired dark theme with gold accent.',
  isDefault: false,
  layoutVersion: null,
  tokens: {},
  perApp: null,
  fonts: null,
};

export const OBLI_NEON_THEME: ThemeDefinition = {
  id: 'neon',
  name: 'Neon UI',
  description: 'High-contrast neon variant with light gold accent.',
  isDefault: false,
  layoutVersion: null,
  tokens: {},
  perApp: null,
  fonts: null,
};

export const THEME_CATALOG: ThemeDefinition[] = [
  OBLI_OPERATOR_THEME,
  OBLI_CLASSIC_THEME,
  OBLI_NEON_THEME,
];

export const DEFAULT_THEME_ID = OBLI_OPERATOR_THEME.id;

export function getThemeById(id: string): ThemeDefinition | undefined {
  return THEME_CATALOG.find(t => t.id === id);
}

export function getPerAppAccent(themeId: string, app: ThemeAppKey): ThemeAppAccent | null {
  const theme = getThemeById(themeId);
  return theme?.perApp?.[app] ?? null;
}
