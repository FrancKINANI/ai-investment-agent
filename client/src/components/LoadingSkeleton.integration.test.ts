import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "client/src/pages");

describe("loading skeleton integration", () => {
  it("uses the shared pending-state component in each data-heavy workspace", () => {
    ["CommandCenter.tsx", "Chat.tsx", "Settings.tsx", "Activity.tsx"].forEach((file) => {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source).toContain('from "@/components/LoadingSkeleton"');
      expect(source).toContain("<LoadingSkeleton");
    });
  });
});
