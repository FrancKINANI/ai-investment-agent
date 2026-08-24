// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setLocation = vi.hoisted(() => vi.fn());

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "Owner" }, isAuthenticated: true, loading: false, logout: vi.fn() }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/", setLocation] }));

import DashboardLayout from "./DashboardLayout";
import { ThemeProvider } from "@/contexts/ThemeContext";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
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
  it("collapses the navigation rail from the visible topbar trigger", async () => {
    await act(async () => root.render(<ThemeProvider defaultTheme="dark" switchable><DashboardLayout><div>workspace</div></DashboardLayout></ThemeProvider>));
    const sidebar = host.querySelector<HTMLElement>('[data-slot="sidebar"]');
    const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Toggle workspace navigation"]');
    expect(sidebar?.dataset.state).toBe("expanded");
    await act(async () => trigger?.click());
    expect(sidebar?.dataset.state).toBe("collapsed");
  });

  it("routes both profile affordances to the Agent & Policy workspace", async () => {
    await act(async () => root.render(<ThemeProvider defaultTheme="dark" switchable><DashboardLayout><div>workspace</div></DashboardLayout></ThemeProvider>));
    const profileButtons = host.querySelectorAll<HTMLButtonElement>('[aria-label="Open profile and agent settings"]');
    expect(profileButtons).toHaveLength(2);
    await act(async () => profileButtons[0]?.click());
    await act(async () => profileButtons[1]?.click());
    expect(setLocation).toHaveBeenNthCalledWith(1, "/settings");
    expect(setLocation).toHaveBeenNthCalledWith(2, "/settings");
  });
});
