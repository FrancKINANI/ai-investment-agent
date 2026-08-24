export type OwnerShortcuts = { navigation: "b" | "m"; chat: "c" | "j"; activity: "a" | "l" };
export type OwnerPreferences = { displayName: string; density: "comfortable" | "compact"; shortcuts: OwnerShortcuts };

export const defaultOwnerPreferences: OwnerPreferences = {
  displayName: "",
  density: "comfortable",
  shortcuts: { navigation: "b", chat: "c", activity: "a" },
};

export const ownerPreferencesKey = (ownerId?: string) => `ledgerline.owner-preferences.${ownerId ?? "anonymous"}`;

export function readOwnerPreferences(ownerId?: string): OwnerPreferences {
  if (typeof window === "undefined") return defaultOwnerPreferences;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ownerPreferencesKey(ownerId)) ?? "{}") as Partial<OwnerPreferences>;
    return { ...defaultOwnerPreferences, ...parsed, shortcuts: { ...defaultOwnerPreferences.shortcuts, ...parsed.shortcuts } };
  } catch {
    return defaultOwnerPreferences;
  }
}

export function saveOwnerPreferences(ownerId: string | undefined, preferences: OwnerPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ownerPreferencesKey(ownerId), JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent("ledgerline:preferences", { detail: { ownerId } }));
}

export const primaryShortcutLabel = (key: string) => `⌘/Ctrl+${key.toUpperCase()}`;
