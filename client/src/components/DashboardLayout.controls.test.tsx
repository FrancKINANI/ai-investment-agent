// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setLocation = vi.hoisted(() => vi.fn());
const historyEntries = vi.hoisted(() => ({ entries: [] as Array<{ actionId: string; subject: string; detail: string; kind: string; status: string; createdAt: Date }> }));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "Owner", openId: "owner-test" }, isAuthenticated: true, loading: false, logout: vi.fn() }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/", setLocation] }));
vi.mock("@/lib/trpc", () => ({ trpc: { history: { list: { useQuery: () => ({ data: historyEntries.entries, refetch: vi.fn() }) } } } }));

import DashboardLayout from "./DashboardLayout";
import { ThemeProvider } from "@/contexts/ThemeContext";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  historyEntries.entries = [];
  document.documentElement.className = "";
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  setLocation.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("DashboardLayout operating controls", () => {
  it("hides the navigation rail completely from the visible topbar trigger", async () => {
    await act(async () => root.render(<ThemeProvider defaultTheme="dark" switchable><DashboardLayout><div>workspace</div></DashboardLayout></ThemeProvider>));
    const sidebar = host.querySelector<HTMLElement>('[data-slot="sidebar"]');
    const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Hide navigation"]');
    expect(sidebar?.dataset.state).toBe("expanded");
    await act(async () => trigger?.click());
    expect(sidebar?.dataset.state).toBe("collapsed");
    expect(sidebar?.dataset.collapsible).toBe("offcanvas");
  });

  it("opens the editable bottom-left profile settings panel and saves an owner display preference", async () => {
    await act(async () => root.render(<ThemeProvider defaultTheme="dark" switchable><DashboardLayout><div>workspace</div></DashboardLayout></ThemeProvider>));
    const profileButton = host.querySelector<HTMLButtonElement>('[aria-label="Open owner profile menu"]');
    expect(profileButton).not.toBeNull();
    await act(async () => profileButton?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    const profileItem = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((item) => item.textContent?.includes("Profile details"));
    expect(profileItem).toBeDefined();
    await act(async () => profileItem?.click());
    const profilePanel = host.querySelector<HTMLElement>('[role="dialog"][aria-label="Owner profile settings"]');
    expect(profilePanel).not.toBeNull();
    const displayName = profilePanel?.querySelector<HTMLInputElement>('input[aria-label="Profile display name"]');
    expect(displayName).not.toBeNull();
    await act(async () => { if (displayName) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(displayName, "Ledger Operator"); displayName.dispatchEvent(new Event("input", { bubbles: true })); } });
    const saveButton = Array.from(profilePanel?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent?.includes("Save changes"));
    expect(saveButton).toBeDefined();
    await act(async () => saveButton?.click());
    expect(JSON.parse(localStorage.getItem("ledgerline.owner-preferences.owner-test") ?? "{}").displayName).toBe("Ledger Operator");
  });

  it("shows an unread activity badge only for persisted events newer than the owner’s last visit", async () => {
    const createdAt = new Date("2026-08-24T12:00:00.000Z");
    historyEntries.entries = [{ actionId: "audit-1", subject: "Saved IPS", detail: "Policy revision persisted", kind: "policy_saved", status: "success", createdAt }];
    localStorage.setItem("ledgerline.activity.last-seen.owner-test", String(createdAt.getTime() - 1));
    await act(async () => root.render(<ThemeProvider defaultTheme="dark" switchable><DashboardLayout><div>workspace</div></DashboardLayout></ThemeProvider>));
    const badge = host.querySelector<HTMLElement>(".os-unread-badge");
    expect(badge?.textContent).toBe("1");
    expect(badge?.getAttribute("aria-label")).toBe("1 unread activity updates");
    await act(async () => window.dispatchEvent(new CustomEvent("ledgerline:activity-read", { detail: { ownerId: "owner-test", seenAt: createdAt.getTime() } })));
    expect(host.querySelector(".os-unread-badge")).toBeNull();
  });
});
