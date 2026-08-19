import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { Uniwind } from 'uniwind';
import {
  themeColor,
  type ColorSchemeName,
} from '@shared/design-tokens/generated/tokens';
import {
  APPEARANCE_OPTIONS,
  getInitialAppearancePreference,
  saveAppearancePreference,
  type AppearancePreference,
} from '../logic/appearancePreference';

type ResolvedScheme = ColorSchemeName;

type ThemeContextValue = {
  /** User preference: follow system, or force light/dark. */
  preference: AppearancePreference;
  setPreference: (value: AppearancePreference) => void;
  /** Resolved scheme after applying preference + system. */
  scheme: ResolvedScheme;
  /** @deprecated Use `scheme`. Kept for existing call sites. */
  theme: ResolvedScheme;
  isDark: boolean;
  colors: (typeof themeColor)[ResolvedScheme];
  options: typeof APPEARANCE_OPTIONS;
  /** No-op legacy API — prefer setPreference. */
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(
  preference: AppearancePreference,
  system: 'light' | 'dark' | null | undefined
): ResolvedScheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'light' ? 'light' : 'dark';
}

function applyUniwindTheme(scheme: ResolvedScheme) {
  try {
    Uniwind.setTheme(scheme);
  } catch (error) {
    console.warn('Uniwind.setTheme failed', scheme, error);
  }
}

function colorsForScheme(scheme: ResolvedScheme) {
  const palette = themeColor?.[scheme] ?? themeColor?.dark;
  if (!palette) {
    throw new Error('design-tokens themeColor failed to load');
  }
  return palette;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<AppearancePreference>(() =>
    getInitialAppearancePreference()
  );

  const scheme = useMemo(
    () => resolveScheme(preference, systemScheme ?? Appearance.getColorScheme()),
    [preference, systemScheme]
  );

  const setPreference = useCallback((value: AppearancePreference) => {
    setPreferenceState(value);
    saveAppearancePreference(value);
  }, []);

  useEffect(() => {
    applyUniwindTheme(scheme);
    // Re-assert after Appearance can race Uniwind on cold start / toggle.
    const t = setTimeout(() => applyUniwindTheme(scheme), 0);
    return () => clearTimeout(t);
  }, [scheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      setPreference,
      scheme,
      theme: scheme,
      isDark: scheme === 'dark',
      colors: colorsForScheme(scheme),
      options: APPEARANCE_OPTIONS,
      toggleTheme: () => {
        setPreference(scheme === 'dark' ? 'light' : 'dark');
      },
    }),
    [preference, scheme, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

/** Semantic colors for the resolved scheme. */
export function useThemeColors() {
  return useTheme().colors;
}
