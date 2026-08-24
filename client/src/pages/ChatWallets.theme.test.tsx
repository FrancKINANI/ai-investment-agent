// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "Owner" }, isAuthenticated: true, loading: false, logout: vi.fn() }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/chat", vi.fn()] }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    agentFabric: {
      nodes: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
      conversations: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
      messages: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
      evolution: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
      sendSupervisorMessage: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
    policy: { current: { useQuery: () => ({ data: null, refetch: vi.fn() }) } },
    autonomy: {
      mandates: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
      createSimulationMandate: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      setMandateMode: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
    history: { list: { useQuery: () => ({ data: [], refetch: vi.fn() }) } },
  },
}));

import DashboardLayout from "@/components/DashboardLayout";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Chat from "./Chat";
import Wallets from "./Wallets";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  document.documentElement.className = "";
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
});

describe("Chat and Wallets theme rendering", () => {
  it.each([["Chat", <Chat />, ".solo-chat-page"], ["Wallets", <Wallets />, ".mode-control"]] as const)("keeps %s mounted while switching from dark to light", async (_name, workspace, selector) => {
    await act(async () => root.render(<ThemeProvider defaultTheme="dark" switchable><DashboardLayout>{workspace}</DashboardLayout></ThemeProvider>));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(host.querySelector(selector)).not.toBeNull();
    if (_name === "Chat") {
      expect(host.querySelector('form[aria-label="Supervisor message composer"] .chatgpt-input-shell')).not.toBeNull();
      expect(host.querySelector('button[aria-label="Send research brief"]')).not.toBeNull();
    }

    const profileButton = host.querySelector<HTMLButtonElement>('button[aria-label="Open owner profile menu"]');
    await act(async () => profileButton?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    const toggle = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((item) => item.textContent?.includes("Use light mode"));
    await act(async () => toggle?.click());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(host.querySelector(selector)).not.toBeNull();
  });
});
