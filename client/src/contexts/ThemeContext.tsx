import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

export function resolveThemePreference(defaultTheme: Theme, storedTheme: string | null, switchable: boolean): Theme {
  if (!switchable) return defaultTheme;
  return storedTheme === "light" || storedTheme === "dark" ? storedTheme : defaultTheme;
}

export function nextThemePreference(theme: Theme): Theme {
  return theme === "light" ? "dark" : "light";
}

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    return resolveThemePreference(defaultTheme, switchable ? localStorage.getItem("theme") : null, switchable);
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (switchable) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, switchable]);

  const toggleTheme = switchable
    ? () => {
        setTheme(nextThemePreference);
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
