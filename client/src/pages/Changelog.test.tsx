// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Changelog from "./Changelog";

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

describe("Changelog", () => {
  it("communicates latest improvements and preserves the simulation-first boundary", async () => {
    await act(async () => root.render(<Changelog />));
    expect(host.textContent).toContain("Performance and public experience");
    expect(host.textContent).toContain("No wallet keys, venue credentials, signing, custody, live orders, or real execution capability were added.");
    expect(host.querySelector<HTMLAnchorElement>('a[href="/"]')?.textContent).toContain("Open Command");
    expect(host.querySelectorAll('a[aria-label*="Share"][aria-label*="on X"]').length).toBe(3);
    expect(host.querySelectorAll('a[aria-label*="Share"][aria-label*="LinkedIn"]').length).toBe(3);
  });
});
