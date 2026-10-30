import React, { createContext, useContext, useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { haptic } from '../lib/haptics';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'safer-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    haptic.light();
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (t: Theme) => {
    haptic.light();
    setThemeState(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

/** Botón interruptor para alternar entre Tema Claro y Tema Oscuro */
export function ThemeToggle({
  className = '',
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={isDark ? 'Tema Claro' : 'Tema Oscuro'}
      className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-outline-variant/40 bg-surface-card hover:bg-surface-container-low text-on-surface active:scale-[0.96] transition-all shadow-xs ${className}`}
    >
      <Icon
        name={isDark ? 'light_mode' : 'dark_mode'}
        className={`text-[19px] ${isDark ? 'text-amber-300' : 'text-primary'}`}
      />
      {showLabel && (
        <span className="text-label-sm font-semibold select-none">
          {isDark ? 'Claro' : 'Oscuro'}
        </span>
      )}
    </button>
  );
}

