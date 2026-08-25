import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf8");

describe("collapsed sidebar layout contract", () => {
  it("releases the desktop sidebar gap and expands the shared workspace inset", () => {
    expect(stylesheet).toContain('[data-slot="sidebar"][data-collapsible="offcanvas"] [data-slot="sidebar-gap"] { width:0!important; min-width:0!important; }');
    expect(stylesheet).toContain('[data-slot="sidebar-wrapper"] .os-layout>.os-mobile-workspace { width:100%!important; max-width:none!important; min-width:0!important; flex:1 1 0!important; }');
    expect(stylesheet).toContain('[data-slot="sidebar-wrapper"] .os-layout:has([data-slot="sidebar"][data-collapsible="offcanvas"])>.os-mobile-workspace { width:100%!important; max-width:none!important; flex-basis:0!important; }');
  });
});
