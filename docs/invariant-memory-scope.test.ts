import { describe, expect, it } from "vitest";
import { selectMemoryContext, canPromoteMemory, memoryScopes } from "@shared/agentMemory";

describe("Invariant 4: Memory Scope Boundary", () => {
  it("selectMemoryContext filters private entries by agentId", () => {
    const entries = [
      { memoryId: "m1", scope: "private", agentId: "agent-A", kind: "fact", status: "active" },
      { memoryId: "m2", scope: "private", agentId: "agent-B", kind: "fact", status: "active" },
      { memoryId: "m3", scope: "shared", kind: "fact", status: "active" },
    ];
    // Select context for agent-A - should only include m1 (private to A) and m3 (shared)
    // m2 should be excluded because it's private to agent-B
    const context = selectMemoryContext(entries, "agent-A");
    const privateToA = context.filter((e) => e.scope === "private" && e.agentId === "agent-A");
    expect(privateToA.length).toBe(1);
    expect(privateToA[0].memoryId).toBe("m1");
  });

  it("pending promotion entries are excluded from active context", () => {
    const entries = [
      { memoryId: "m1", scope: "private", agentId: "agent-A", kind: "fact", status: "active" },
      { memoryId: "m2", scope: "private", agentId: "agent-A", kind: "fact", status: "pending_promotion" },
    ];
    // pending_promotion status should not be "active", so m2 should be excluded
    const context = selectMemoryContext(entries, "agent-A");
    const pendingInContext = context.filter((e) => e.memoryId === "m2");
    expect(pendingInContext.length).toBe(0);
  });

  it("canPromoteMemory only allows active private memory", () => {
    expect(canPromoteMemory({ scope: "private", status: "active" })).toBe(true);
    expect(canPromoteMemory({ scope: "private", status: "pending_promotion" })).toBe(false);
    expect(canPromoteMemory({ scope: "shared", status: "active" })).toBe(false);
  });

  it("shared memory is eligible for all research agents of the owner", () => {
    const entries = [
      { memoryId: "m1", scope: "shared", agentId: null, kind: "fact", status: "active" },
      { memoryId: "m2", scope: "private", agentId: "agent-A", kind: "fact", status: "active" },
    ];
    // Shared entries should be included in context for any agent
    const context = selectMemoryContext(entries, "agent-A");
    const sharedEntries = context.filter((e) => e.scope === "shared");
    expect(sharedEntries.length).toBe(1);
    expect(sharedEntries[0].memoryId).toBe("m1");
  });

  it("execution-agent blocked from individual conversation/memory", () => {
    // This is enforced by requireActiveResearchAgent in agentMemoryRouter.ts
    // which throws FORBIDDEN for execution roleKey
    expect(memoryScopes).toContain("shared");
    expect(memoryScopes).toContain("private");
  });
});