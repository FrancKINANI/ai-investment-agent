// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import RouteLoadingBar from "./RouteLoadingBar";

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

describe("RouteLoadingBar", () => {
  it("provides a polite loading status for a pending lazy route", async () => {
    await act(async () => root.render(<RouteLoadingBar />));
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Loading selected workspace");
  });
});
