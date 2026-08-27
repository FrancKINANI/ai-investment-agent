import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const fabric = vi.hoisted(() => ({
  ensureProtectedAgentNodes: vi.fn(),
  createAgentMessage: vi.fn(),
  createEvolutionEvent: vi.fn(),
  listAgentMessages: vi.fn(),
}));
const memory = vi.hoisted(() => ({
  createAgentMemoryAction: vi.fn(),
  createAgentMemoryEntry: vi.fn(),
  createIndividualAgentConversation: vi.fn(),
  getIndividualAgentConversation: vi.fn(),
  getMemoryEntry: vi.fn(),
  listIndividualAgentConversations: vi.fn(),
  listMemoryWorkspace: vi.fn(),
  touchIndividualAgentConversation: vi.fn(),
  updateMemoryEntry: vi.fn(),
}));
const db = vi.hoisted(() => ({ createOperatorAction: vi.fn() }));
const llm = vi.hoisted(() => ({ composeSpecialistOutput: vi.fn() }));

vi.mock("./agentFabricDb", () => fabric);
vi.mock("./agentMemoryDb", () => memory);
vi.mock("./db", () => db);
vi.mock("./agentFabric", () => llm);

import { agentMemoryRouter } from "./agentMemoryRouter";

const researchAgent = { agentId: "agent-research", roleKey: "bull", name: "Bull researcher", model: "gpt-5-mini", state: "active" as const };
const executionAgent = { agentId: "agent-execution", roleKey: "execution", name: "Execution", model: "gpt-5-mini", state: "active" as const };

function context(role: "user" | "admin" = "user"): TrpcContext {
  return { user: { id: 17, openId: "owner", name: "Owner", email: null, loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {} } as TrpcContext["req"], res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"] };
}

beforeEach(() => {
  vi.clearAllMocks();
  fabric.ensureProtectedAgentNodes.mockResolvedValue([researchAgent, executionAgent]);
  fabric.listAgentMessages.mockResolvedValue([{ actor: "owner", content: "Review the evidence boundary." }]);
  fabric.createAgentMessage.mockResolvedValue({});
  fabric.createEvolutionEvent.mockResolvedValue({});
  memory.listMemoryWorkspace.mockResolvedValue({ entries: [], actions: [] });
  memory.createIndividualAgentConversation.mockResolvedValue({});
  memory.touchIndividualAgentConversation.mockResolvedValue({});
  db.createOperatorAction.mockResolvedValue({});
  llm.composeSpecialistOutput.mockResolvedValue({ output: "Observation: bounded\nConstraint: sealed\nNext research check: verify sources" });
});

describe("agentMemoryRouter", () => {
  it("refuses the execution role before reading memory or invoking a model", async () => {
    const caller = agentMemoryRouter.createCaller(context());
    await expect(caller.workspace({ agentId: executionAgent.agentId })).rejects.toThrow("execution role cannot receive direct conversations or memory context");
    expect(memory.listMemoryWorkspace).not.toHaveBeenCalled();
    expect(llm.composeSpecialistOutput).not.toHaveBeenCalled();
  });

  it("refuses an individual thread belonging to another agent before writing or invoking a model", async () => {
    memory.getIndividualAgentConversation.mockResolvedValue({ threadId: "foreign-thread", targetAgentId: "another-agent" });
    const caller = agentMemoryRouter.createCaller(context());
    await expect(caller.sendIndividualMessage({ targetAgentId: researchAgent.agentId, threadId: "foreign-thread", message: "Review this evidence." })).rejects.toThrow("does not belong to the selected agent");
    expect(fabric.createAgentMessage).not.toHaveBeenCalled();
    expect(llm.composeSpecialistOutput).not.toHaveBeenCalled();
  });

  it("derives a focused conversation from the selected agent and passes only selected context to the model", async () => {
    memory.getIndividualAgentConversation.mockResolvedValue(null);
    memory.listMemoryWorkspace.mockResolvedValue({ entries: [{ memoryId: "shared-1", scope: "shared", agentId: null, kind: "constraint", content: "Do not exceed the research scope.", status: "active", pinned: true, expiresAt: null, createdAt: new Date() }, { memoryId: "private-1", scope: "private", agentId: researchAgent.agentId, kind: "research_note", content: "Check counterarguments first.", status: "active", pinned: false, expiresAt: null, createdAt: new Date() }, { memoryId: "private-other", scope: "private", agentId: "another-agent", kind: "research_note", content: "This context is not for Bull.", status: "active", pinned: false, expiresAt: null, createdAt: new Date() }], actions: [] });
    const caller = agentMemoryRouter.createCaller(context());
    const result = await caller.sendIndividualMessage({ targetAgentId: researchAgent.agentId, message: "Review the thesis boundary." });
    expect(result.targetAgentId).toBe(researchAgent.agentId);
    expect(result.memoryContext).toEqual([{ memoryId: "shared-1", scope: "shared", kind: "constraint" }, { memoryId: "private-1", scope: "private", kind: "research_note" }]);
    expect(llm.composeSpecialistOutput).toHaveBeenCalledWith(expect.objectContaining({ role: "bull", memoryContext: expect.stringContaining("Check counterarguments first") }));
    expect(llm.composeSpecialistOutput).toHaveBeenCalledWith(expect.objectContaining({ memoryContext: expect.not.stringContaining("This context is not for Bull") }));
    expect(db.createOperatorAction).toHaveBeenCalledWith(17, expect.objectContaining({ kind: "chat_message", payload: expect.objectContaining({ executionBoundary: "sealed" }) }));
  });
});
