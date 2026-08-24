// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Welcome from "./Welcome";

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

describe("Welcome", () => {
  it("explains the simulation boundary and provides documentation and future GitHub community links", async () => {
    await act(async () => root.render(<ThemeProvider defaultTheme="light" switchable><Welcome /></ThemeProvider>));
    expect(host.textContent).toContain("No wallet keys, venue credentials, signing, custody, or live order routing.");
    expect(host.textContent).toContain("DOCUMENTATION LIBRARY");
    const githubLinks = Array.from(host.querySelectorAll<HTMLAnchorElement>('a[href="https://github.com/FrancKINANI/ai-investment-agent-mvp"]'));
    expect(githubLinks.length).toBeGreaterThan(0);
    expect(githubLinks.every((link) => link.target === "_blank" && link.rel === "noreferrer")).toBe(true);
  });

  it("lets a visitor preview dark mode or follow the operating-system preference before sign-in", async () => {
    await act(async () => root.render(<ThemeProvider defaultTheme="light" switchable><Welcome /></ThemeProvider>));
    const darkButton = host.querySelector<HTMLButtonElement>('[aria-label="Use dark theme"]');
    const systemButton = host.querySelector<HTMLButtonElement>('[aria-label="Follow system theme"]');
    await act(async () => darkButton?.click());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
    await act(async () => systemButton?.click());
    expect(localStorage.getItem("theme")).toBe("system");
    expect(systemButton?.getAttribute("aria-pressed")).toBe("true");
  });
});
