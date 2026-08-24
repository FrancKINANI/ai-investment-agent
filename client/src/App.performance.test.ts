import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(fileURLToPath(new URL("./App.tsx", import.meta.url)), "utf8");

describe("initial client load", () => {
  it("keeps workspace pages behind route-level lazy imports", () => {
    ["Activity", "Chat", "CommandCenter", "Connections", "Settings", "Wallets", "Welcome", "DashboardLayout"].forEach((moduleName) => {
      expect(appSource).toContain(`const ${moduleName} = lazy(() => import(`);
    });
    expect(appSource).toContain("<Suspense fallback=");
  });
});
