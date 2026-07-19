import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { colorScheme as nativeWindColorScheme } from 'nativewind';

type ThemeContextValue = {
  theme: 'dark';
  isDark: true;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    nativeWindColorScheme.set('dark');
  }, []);

  const value = useMemo(
    () => ({
      theme: 'dark' as const,
      isDark: true as const,
      toggleTheme: () => {},
    }),
    []
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
