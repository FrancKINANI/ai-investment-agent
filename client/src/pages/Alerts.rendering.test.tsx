// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type AlertFixture = {
  alertId: string;
  level: "critical" | "warning" | "info";
  category: string;
  title: string;
  detail: string;
  acknowledged: boolean;
  createdAt: Date;
  updatedAt: Date;
  actionRef?: string | null;
};

const alertQuery = vi.hoisted(() => ({
  data: [] as AlertFixture[],
  refetch: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    security: {
      alerts: {
        list: { useQuery: () => alertQuery },
        acknowledge: { useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }) },
      },
    },
  },
}));

import Alerts from "./Alerts";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  alertQuery.data = [];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("Alerts securityAlerts rendering", () => {
  it("renders the persisted API empty state without inventing an alert", async () => {
    await act(async () => root.render(<Alerts />));

    expect(host.textContent).toContain("No resolved alerts yet.");
    expect(host.textContent).toContain("Critical0");
    expect(host.textContent).toContain("Warning0");
    expect(host.textContent).toContain("Info0");
    expect(host.querySelector("article")).toBeNull();
  });

  it("renders a non-persistent API response with an acknowledgement control", async () => {
    alertQuery.data = [{
      alertId: "alert-rendering-contract",
      level: "warning",
      category: "migration-check",
      title: "In-memory rendering check",
      detail: "This alert exists only in the automated rendering contract.",
      acknowledged: false,
      createdAt: new Date("2026-08-28T00:00:00.000Z"),
      updatedAt: new Date("2026-08-28T00:00:00.000Z"),
    }];

    await act(async () => root.render(<Alerts />));

    expect(host.textContent).toContain("In-memory rendering check");
    expect(host.textContent).toContain("migration-check");
    expect(host.textContent).toContain("Warning1");
    expect(host.textContent).toContain("Acknowledge");
    expect(host.textContent).toContain("(1 new)");
  });
});
