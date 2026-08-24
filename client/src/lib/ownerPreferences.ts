export type OwnerShortcuts = { navigation: "b" | "m"; chat: "c" | "j"; activity: "a" | "l" };
export type OwnerPreferences = { displayName: string; density: "comfortable" | "compact"; shortcuts: OwnerShortcuts; prefetchOnIntent: boolean };

export const defaultOwnerPreferences: OwnerPreferences = {
  displayName: "",
  density: "comfortable",
  shortcuts: { navigation: "b", chat: "c", activity: "a" },
  prefetchOnIntent: true,
};

type ConnectionAwareNavigator = Navigator & { connection?: { saveData?: boolean }; mozConnection?: { saveData?: boolean }; webkitConnection?: { saveData?: boolean } };

export function browserPrefersReducedData() {
  if (typeof navigator === "undefined") return false;
  const connection = navigator as ConnectionAwareNavigator;
  return Boolean(connection.connection?.saveData ?? connection.mozConnection?.saveData ?? connection.webkitConnection?.saveData);
}

export function initialOwnerPreferences(): OwnerPreferences {
  return { ...defaultOwnerPreferences, shortcuts: { ...defaultOwnerPreferences.shortcuts }, prefetchOnIntent: !browserPrefersReducedData() };
}

export const ownerPreferencesKey = (ownerId?: string) => `ledgerline.owner-preferences.${ownerId ?? "anonymous"}`;

export function readOwnerPreferences(ownerId?: string): OwnerPreferences {
  if (typeof window === "undefined") return initialOwnerPreferences();
  try {
    const raw = window.localStorage.getItem(ownerPreferencesKey(ownerId));
    if (!raw) return initialOwnerPreferences();
    const parsed = JSON.parse(raw) as Partial<OwnerPreferences>;
    return { ...initialOwnerPreferences(), ...parsed, shortcuts: { ...defaultOwnerPreferences.shortcuts, ...parsed.shortcuts } };
  } catch {
    return initialOwnerPreferences();
  }
}

export function saveOwnerPreferences(ownerId: string | undefined, preferences: OwnerPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ownerPreferencesKey(ownerId), JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent("ledgerline:preferences", { detail: { ownerId } }));
}

export const primaryShortcutLabel = (key: string) => `⌘/Ctrl+${key.toUpperCase()}`;
