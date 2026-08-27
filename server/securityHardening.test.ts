import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const project = new URL("../", import.meta.url);
const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")) as { dependencies: Record<string, string> };
const onchain = readFileSync(fileURLToPath(new URL("./onchain.ts", import.meta.url)), "utf8");
const scheduler = readFileSync(fileURLToPath(new URL("./scheduledDiscovery.ts", import.meta.url)), "utf8");

describe("security hardening baseline", () => {
  it("keeps audited runtime dependencies patched and removes the unused renderer tree", () => {
    expect(packageJson.dependencies.axios).toBe("^1.19.0");
    expect(packageJson.dependencies["drizzle-orm"]).toBe("^0.45.2");
    expect(packageJson.dependencies.express).toBe("^5.2.1");
    expect(packageJson.dependencies.cookie).toBe("^2.0.1");
    expect(packageJson.dependencies.streamdown).toBeUndefined();
    expect(existsSync(fileURLToPath(new URL("../client/src/pages/ComponentShowcase.tsx", import.meta.url)))).toBe(false);
    expect(existsSync(fileURLToPath(new URL("../client/src/components/AIChatBox.tsx", import.meta.url)))).toBe(false);
  });

  it("bounds public upstream requests and avoids echoing callback failures", () => {
    expect(onchain).toContain("AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)");
    expect(onchain).toContain("MAX_DEX_PAIRS");
    expect(onchain).not.toContain("sourceUrl");
    expect(scheduler).toContain('error: "scheduled-discovery-unavailable"');
    expect(scheduler).not.toContain("context: { url: req.originalUrl }");
  });
});
