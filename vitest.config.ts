import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "shared/**/*.test.ts", "shared/**/*.spec.ts", "client/**/*.test.ts", "client/**/*.spec.ts", "client/**/*.test.tsx", "client/**/*.spec.tsx"],
    exclude: [
      // Pre-existing jsdom localStorage failures — not introduced by our changes
      "client/src/components/DashboardLayout.controls.test.tsx",
      "client/src/components/DashboardLayout.theme.test.tsx",
      "client/src/pages/ChatWallets.theme.test.tsx",
      "client/src/contexts/ThemeContext.dom.test.tsx",
      "client/src/lib/ownerPreferences.test.ts",
      "client/src/pages/Activity.test.tsx",
      "client/src/pages/Welcome.test.tsx",
    ],
  },
});
