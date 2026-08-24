// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultOwnerPreferences, ownerPreferencesKey, readOwnerPreferences, saveOwnerPreferences } from "./ownerPreferences";

describe("owner preferences", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("persists display, density, and configured shortcuts under the owner-scoped key", () => {
    const preferences = { displayName: "Ledger Operator", density: "compact" as const, shortcuts: { navigation: "m" as const, chat: "j" as const, activity: "l" as const }, prefetchOnIntent: false };
    saveOwnerPreferences("owner-1", preferences);
    expect(readOwnerPreferences("owner-1")).toEqual(preferences);
    expect(localStorage.getItem(ownerPreferencesKey("owner-1"))).toContain("Ledger Operator");
    expect(readOwnerPreferences("owner-1").prefetchOnIntent).toBe(false);
  });

  it("returns safe defaults when no preference record exists", () => {
    expect(readOwnerPreferences("new-owner")).toEqual(defaultOwnerPreferences);
  });

  it("uses the browser save-data hint for an owner’s initial prefetch state without overriding a saved choice", () => {
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } });
    expect(readOwnerPreferences("metered-owner").prefetchOnIntent).toBe(false);
    saveOwnerPreferences("metered-owner", { ...defaultOwnerPreferences, prefetchOnIntent: true });
    expect(readOwnerPreferences("metered-owner").prefetchOnIntent).toBe(true);
    Object.defineProperty(navigator, "connection", { configurable: true, value: undefined });
  });
});
