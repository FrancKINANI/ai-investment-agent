import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertMemoryContentIsSafe, canPromoteMemory, formatMemoryContext, selectMemoryContext } from "./agentMemory";

const now = new Date("2026-08-27T22:00:00.000Z");
const base = {
  kind: "research_note" as const,
  content: "Owner-supplied research note with stated uncertainty.",
  status: "active" as const,
  pinned: false,
  expiresAt: null,
  createdAt: now,
};

describe("agent memory boundaries", () => {
  it("returns only active shared context and the private context of the selected agent", () => {
    const context = selectMemoryContext([
      { ...base, memoryId: "shared", scope: "shared" as const, agentId: null },
      { ...base, memoryId: "private-a", scope: "private" as const, agentId: "agent-a" },
      { ...base, memoryId: "private-b", scope: "private" as const, agentId: "agent-b" },
      { ...base, memoryId: "expired", scope: "shared" as const, expiresAt: new Date("2026-08-26T22:00:00.000Z") },
      { ...base, memoryId: "pending", scope: "shared" as const, status: "pending_promotion" as const },
    ], "agent-a", now.getTime());
    expect(context.map((entry) => entry.memoryId)).toEqual(["shared", "private-a"]);
    expect(formatMemoryContext(context)).toContain("PRIVATE TO SELECTED AGENT");
    expect(formatMemoryContext(context)).not.toContain("private-b");
  });

  it("rejects credential and private-key shaped material before persistence", () => {
    expect(() => assertMemoryContentIsSafe("api_key=sk-this-must-never-enter-owner-memory")).toThrow("authentication secret");
    expect(() => assertMemoryContentIsSafe("-----BEGIN PRIVATE KEY-----\nmaterial\n-----END PRIVATE KEY-----")).toThrow("private-key block");
    expect(() => assertMemoryContentIsSafe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toThrow("private-key-shaped value");
    expect(assertMemoryContentIsSafe("Keep risk review evidence separate from a market thesis.")).toContain("risk review");
  });

  it("allows a promotion request only for currently active private memory", () => {
    expect(canPromoteMemory({ scope: "private", status: "active" })).toBe(true);
    expect(canPromoteMemory({ scope: "shared", status: "active" })).toBe(false);
    expect(canPromoteMemory({ scope: "private", status: "pending_promotion" })).toBe(false);
  });

  it("keeps the memory router independent from live execution, venue clients, and KMS decryption", () => {
    const source = readFileSync(new URL("../server/agentMemoryRouter.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/executeLiveOrder|liveAdapter|assertLiveVenueMutationAllowed|decrypt(?:Secret|Platform)/);
    expect(source).not.toMatch(/from\s+["']\.\/binance["']/);
    expect(source).toContain("execution role cannot receive direct conversations or memory context");
    const fabricSource = readFileSync(new URL("../server/agentFabric.ts", import.meta.url), "utf8");
    expect(fabricSource).toContain("Untrusted owner memory reference");
  });
});
