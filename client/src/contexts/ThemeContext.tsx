import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

function systemTheme(fallback: Theme): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return fallback;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function normalizeThemePreference(defaultTheme: Theme, storedTheme: string | null, switchable: boolean): ThemePreference {
  if (!switchable) return defaultTheme;
  return storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : defaultTheme;
}

export function resolveThemePreference(defaultTheme: Theme, storedTheme: string | null, switchable: boolean, systemPreference = systemTheme(defaultTheme)): Theme {
  const preference = normalizeThemePreference(defaultTheme, storedTheme, switchable);
  return preference === "system" ? systemPreference : preference;
}

export function nextThemePreference(theme: Theme): Theme {
  return theme === "light" ? "dark" : "light";
}

interface ThemeContextType {
  theme: Theme;
  themePreference: ThemePreference;
  toggleTheme?: () => void;
  setThemePreference?: (preference: ThemePreference) => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({ children, defaultTheme = "light", switchable = false }: ThemeProviderProps) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => normalizeThemePreference(defaultTheme, switchable ? localStorage.getItem("theme") : null, switchable));
  const [currentSystemTheme, setCurrentSystemTheme] = useState<Theme>(() => systemTheme(defaultTheme));
  const theme = themePreference === "system" ? currentSystemTheme : themePreference;

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = (event: MediaQueryListEvent | MediaQueryList) => setCurrentSystemTheme(event.matches ? "dark" : "light");
    updateSystemTheme(media);
    media.addEventListener?.("change", updateSystemTheme);
    return () => media.removeEventListener?.("change", updateSystemTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    if (switchable) localStorage.setItem("theme", themePreference);
  }, [theme, themePreference, switchable]);

  const setThemePreference = switchable ? (preference: ThemePreference) => setThemePreferenceState(preference) : undefined;
  const toggleTheme = switchable ? () => setThemePreferenceState((preference) => nextThemePreference(preference === "system" ? theme : preference)) : undefined;
  const value = useMemo(() => ({ theme, themePreference, toggleTheme, setThemePreference, switchable }), [theme, themePreference, switchable]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
