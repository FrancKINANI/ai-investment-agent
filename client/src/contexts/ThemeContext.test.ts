import { describe, expect, it } from "vitest";
import { nextThemePreference, normalizeThemePreference, resolveThemePreference } from "./ThemeContext";

describe("theme preferences", () => {
  it("uses a valid persisted owner preference only when theme switching is enabled", () => {
    expect(resolveThemePreference("dark", "light", true)).toBe("light");
    expect(resolveThemePreference("light", "dark", true)).toBe("dark");
    expect(resolveThemePreference("dark", "light", false)).toBe("dark");
  });

  it("falls back safely and toggles between the two supported modes", () => {
    expect(resolveThemePreference("dark", "unexpected", true)).toBe("dark");
    expect(nextThemePreference("dark")).toBe("light");
    expect(nextThemePreference("light")).toBe("dark");
  });

  it("retains an explicit system preference while resolving it to the active operating-system theme", () => {
    expect(normalizeThemePreference("light", "system", true)).toBe("system");
    expect(resolveThemePreference("light", "system", true, "dark")).toBe("dark");
    expect(resolveThemePreference("dark", "system", false, "light")).toBe("dark");
  });
});
