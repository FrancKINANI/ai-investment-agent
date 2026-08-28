// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createdAt = new Date("2026-08-24T13:00:00.000Z");
const historyQueryState = vi.hoisted(() => ({ data: [{ actionId: "a1", subject: "Saved IPS", detail: "Policy persisted", kind: "policy_saved", status: "success", createdAt: new Date("2026-08-24T13:00:00.000Z") }] as Array<{ actionId: string; subject: string; detail: string; kind: string; status: string; createdAt: Date }> | undefined, isLoading: false }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { openId: "owner-activity" }, isAuthenticated: true }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { history: { list: { useQuery: () => historyQueryState } } } }));

import Activity from "./Activity";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  historyQueryState.data = [{ actionId: "a1", subject: "Saved IPS", detail: "Policy persisted", kind: "policy_saved", status: "success", createdAt }];
  historyQueryState.isLoading = false;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("Activity", () => {
  it("marks recorded activity as read locally without altering the audit entry", async () => {
    await act(async () => root.render(<Activity />));
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((item) => item.textContent?.includes("Mark all as read"));
    expect(button?.disabled).toBe(false);
    await act(async () => button?.click());
    expect(localStorage.getItem("ledgerline.activity.last-seen.owner-activity")).toBe(String(createdAt.getTime()));
    expect(host.textContent).toContain("Saved IPS");
  });

  it("renders a pending skeleton instead of treating an in-flight activity request as an empty audit log", async () => {
    historyQueryState.data = undefined;
    historyQueryState.isLoading = true;
    await act(async () => root.render(<Activity />));
    expect(host.querySelector('[aria-label="Loading owner activity"]')).not.toBeNull();
    expect(host.textContent).not.toContain("No recorded activity.");
  });

  it("surfaces only recorded blocked or review safety controls as security signals", async () => {
    historyQueryState.data = [{ actionId: "blocked-real", subject: "Blocked real-mode request", detail: "A boundary denied the request.", kind: "scope_checked", status: "blocked", createdAt }];
    await act(async () => root.render(<Activity />));
    expect(host.textContent).toContain("Security signals");
    expect(host.textContent).toContain("Real-mode request blocked");
    expect(host.textContent).toContain("They do not monitor wallets, credentials, external platforms, or real transactions.");
  });
});
