// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LoadingSkeleton } from "./LoadingSkeleton";

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

describe("LoadingSkeleton", () => {
  it("announces pending work and renders the requested number of visual lines", async () => {
    await act(async () => root.render(<LoadingSkeleton label="Loading private activity" lines={4} />));
    const skeleton = host.querySelector<HTMLElement>(".loading-skeleton");
    expect(skeleton?.getAttribute("role")).toBe("status");
    expect(skeleton?.getAttribute("aria-label")).toBe("Loading private activity");
    expect(host.querySelectorAll(".loading-skeleton-line")).toHaveLength(4);
  });
});
