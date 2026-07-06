import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─── Tema de la aplicación (claro / oscuro / automático) ───────────────────
// La preferencia se guarda por dispositivo en localStorage ('app_theme').
// El tema resuelto se aplica como atributo data-theme en <html>, donde
// src/index.css define la paleta correspondiente. Los PDFs siempre se
// generan en claro (ver src/utils/downloadAsPDF.ts).

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'app_theme';

interface ThemeContextValue {
  /** Preferencia elegida por el usuario */
  theme: ThemePreference;
  /** Tema efectivo aplicado (resuelve 'system' según el dispositivo) */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

function readStoredTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // localStorage puede no estar disponible: usar claro
  }
  return 'light';
}

function getSystemTheme(): ResolvedTheme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  resolvedTheme: 'light',
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemePreference>(readStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const stored = readStoredTheme();
    return stored === 'system' ? getSystemTheme() : stored;
  });

  // Resolver el tema; en modo 'system' seguir los cambios del SO en vivo
  useEffect(() => {
    if (theme !== 'system') {
      setResolvedTheme(theme);
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setResolvedTheme(mq.matches ? 'dark' : 'light');
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [theme]);

  // Aplicar el tema resuelto al <html>
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sin persistencia disponible: el tema aplica solo a esta sesión
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
