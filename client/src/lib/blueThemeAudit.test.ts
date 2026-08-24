import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

function ruleContaining(selector: string) {
  const start = stylesheet.indexOf(selector);
  if (start < 0) return "";
  const end = stylesheet.indexOf("}", start);
  return end < 0 ? "" : stylesheet.slice(start, end + 1);
}

describe("active blue theme audit", () => {
  it("sets blue semantic fallbacks for both light and dark modes", () => {
    expect(stylesheet).toContain("--primary:#2768f5");
    expect(stylesheet).toContain("--ring:#2768f5");
    expect(stylesheet).toContain(".dark { --background:#071225");
    expect(stylesheet).toContain("--primary:#67a4ff");
    expect(stylesheet).toContain(":root { --ll-success:var(--ll-cyan); }");
  });

  it("binds each audited active workspace to blue or cyan operating tokens", () => {
    const routeBindings = [
      ["Command", ".command-hero-next h1 em", "color:var(--ll-blue)"],
      ["Chat", ".solo-chat-heading h1 em", "color:var(--ll-blue)"],
      ["Wallets", ".wallet-role .wallet-glyph", "color:var(--ll-blue)"],
      ["Connections", ".connection-card .scope-chips span", "color:var(--ll-blue)"],
      ["Agent & Policy", ".settings-card header svg", "color:var(--ll-blue)"],
      ["Activity", ".workspace-page .activity-search", "color:var(--ll-blue)"],
      ["Connections active state", ".connections-page .connection-state.active", "color:var(--ll-blue)"],
      ["Connections idle state", ".connections-page .connection-state.idle", "color:var(--ll-muted)"],
      ["Wallets active state", ".workspace-page .mandate-state.active", "color:var(--ll-blue)"],
      ["Wallets idle state", ".workspace-page .mandate-state.idle", "color:var(--ll-muted)"],
    ] as const;

    routeBindings.forEach(([route, selector, tokenBinding]) => {
      const rule = ruleContaining(selector);
      expect(rule, `${route} selector must have a local rule`).toContain(selector);
      expect(rule, `${route} selector must bind to the blue operating token`).toContain(tokenBinding);
    });
  });
});
