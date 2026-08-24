/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";

let host: HTMLDivElement;
let root: Root;

function ThemeToggleHarness() {
  const { theme, toggleTheme } = useTheme();
  return <button type="button" onClick={toggleTheme}>{theme}</button>;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  document.documentElement.className = "";
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("rendered theme toggle", () => {
  it("applies and persists the owner-selected dark/light mode through the real toggle", async () => {
    await act(async () => root.render(<ThemeProvider defaultTheme="dark" switchable><ThemeToggleHarness /></ThemeProvider>));
    const button = host.querySelector("button");
    expect(button?.textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    await act(async () => button?.click());
    expect(button?.textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });
});
