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

function latestRuleContaining(selector: string) {
  const start = stylesheet.lastIndexOf(selector);
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
    expect(stylesheet).toContain("--ll-success:#0aa8e8");
    expect(stylesheet).toContain("--ll-success:#5ce2ff");
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

  it("uses cyan for active readiness and success treatments while keeping Command mandates responsive", () => {
    expect(latestRuleContaining(".os-topbar-status i")).toContain("background:var(--ll-cyan)");
    expect(latestRuleContaining(".status-success")).toContain("background:var(--ll-cyan)");
    expect(stylesheet).toContain(".command-page-next .mandate-strip { display:grid!important; grid-template-columns:minmax(0,1.35fr)");
  });

  it("keeps the final dark theme readable and guards motion for reduced-motion users", () => {
    expect(stylesheet).toContain(".dark { --ll-canvas:#061426");
    expect(stylesheet).toContain("--ll-ink:#f4f8ff");
    expect(stylesheet).toContain("--ll-muted:#bfd1e8");
    expect(stylesheet).toContain("@media (prefers-reduced-motion:no-preference)");
    expect(stylesheet).toContain("@media (prefers-reduced-motion:reduce)");
    expect(stylesheet).toContain(".os-main { padding-bottom:30px!important; }");
  });
});
