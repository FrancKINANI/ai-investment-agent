// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: null, isAuthenticated: false, loading: false, logout: vi.fn() }) }));
vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    agentFabric: {
      nodes: { useQuery: () => ({ data: [], isLoading: false }) },
      conversations: { useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }) },
      messages: { useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }) },
      evolution: { useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }) },
      sendSupervisorMessage: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
    agentMemory: {
      conversations: { useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }) },
      workspace: { useQuery: () => ({ data: { entries: [] }, isLoading: false, isError: false, refetch: vi.fn() }) },
      sendIndividualMessage: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      create: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      requestPromotion: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      reviewPromotion: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
    useUtils: () => ({ agentFabric: { evolution: { invalidate: vi.fn() } } }),
  },
}));

import Chat from "./Chat";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("Agent Console", () => {
  it("shows the roster, focused conversation, and memory inspector structure without exposing invented owner data", async () => {
    await act(async () => root.render(<Chat />));
    const preview = host.querySelector(".agent-console-locked-preview");
    expect(preview).not.toBeNull();
    expect(preview?.textContent).toContain("AGENT ROSTER");
    expect(preview?.textContent).toContain("FOCUSED CONVERSATION");
    expect(preview?.textContent).toContain("MEMORY INSPECTOR");
    expect(preview?.textContent).toContain("Roster is owner-scoped");
    expect(preview?.textContent).toContain("Research context only");
    expect(preview?.textContent).toContain("Explicit scope and review");
    expect(preview?.textContent).not.toContain("Connected wallet balance");
  });
});
