// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createdAt = new Date("2026-08-24T13:00:00.000Z");
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { openId: "owner-activity" }, isAuthenticated: true }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { history: { list: { useQuery: () => ({ data: [{ actionId: "a1", subject: "Saved IPS", detail: "Policy persisted", kind: "policy_saved", status: "success", createdAt }], isLoading: false }) } } } }));

import Activity from "./Activity";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
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
});
