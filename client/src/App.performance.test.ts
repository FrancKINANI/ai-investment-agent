import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(fileURLToPath(new URL("./App.tsx", import.meta.url)), "utf8");

describe("initial client load", () => {
  it("keeps workspace pages behind route-level lazy imports", () => {
    [["Activity", "activity"], ["Chat", "chat"], ["Changelog", "changelog"], ["CommandCenter", "command"], ["Connections", "connections"], ["Settings", "settings"], ["Wallets", "wallets"], ["Welcome", "welcome"], ["DashboardLayout", "dashboardLayout"]].forEach(([moduleName, loaderName]) => {
      expect(appSource).toContain(`const ${moduleName} = lazy(pageLoaders.${loaderName});`);
    });
    expect(appSource).toContain("<Suspense fallback=");
  });
});
