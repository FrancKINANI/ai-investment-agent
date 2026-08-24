import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const db = vi.hoisted(() => ({
  createOperatorAction: vi.fn(),
  getInvestmentPolicy: vi.fn(),
  listAgentProfiles: vi.fn(), listAgentRuns: vi.fn(), listAgentProposals: vi.fn(), listAwarenessRecords: vi.fn(), listOperatorActions: vi.fn(), listOutcomeRecords: vi.fn(), listStrategyEvaluations: vi.fn(), listStrategyLineages: vi.fn(), listVenueConnections: vi.fn(), listWalletMandates: vi.fn(),
  createAgentRun: vi.fn(), createAgentProposal: vi.fn(), createAwarenessRecord: vi.fn(), createOutcomeRecord: vi.fn(), createStrategyEvaluation: vi.fn(), createStrategyLineage: vi.fn(), createVenueConnection: vi.fn(), createWalletMandate: vi.fn(), getAgentProposal: vi.fn(), saveInvestmentPolicy: vi.fn(), updateAgentProposalStatus: vi.fn(), updateWalletMandateMode: vi.fn(),
}));
const fabric = vi.hoisted(() => ({
  ensureProtectedAgentNodes: vi.fn(), updateAgentModel: vi.fn(), createOptionalSubagent: vi.fn(), retireOptionalSubagent: vi.fn(), createConversation: vi.fn(), listConversations: vi.fn(), createAgentMessage: vi.fn(), listAgentMessages: vi.fn(), createEvolutionEvent: vi.fn(), listEvolutionEvents: vi.fn(), createWatchlist: vi.fn(), listWatchlists: vi.fn(), createWatchlistItem: vi.fn(), listWatchlistItems: vi.fn(), deleteWatchlistItem: vi.fn(), updateWatchlistCriteria: vi.fn(), updateWatchlistItemStatus: vi.fn(), createDiscoverySchedule: vi.fn(), getDiscoverySchedule: vi.fn(), pauseDiscoverySchedule: vi.fn(), listDiscoverySchedules: vi.fn(), listDiscoveryFindings: vi.fn(),
}));
const llm = vi.hoisted(() => ({ composeSpecialistOutput: vi.fn(), composeSupervisorReply: vi.fn(), calculateResearchNoteConfidence: vi.fn(), composeFundManagerDisagreementSummary: vi.fn() }));

vi.mock("./db", () => db);
vi.mock("./agentFabricDb", () => fabric);
vi.mock("./agentFabric", () => ({ ...llm, defaultDelegation: ["fundamental", "sentiment", "technical", "news", "bull", "bear", "risk_guardians"] }));
vi.mock("./research", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./research")>();
  return { ...actual, runTokenResearch: vi.fn() };
});
vi.mock("./_core/llm", () => ({ listLLMModels: vi.fn().mockResolvedValue({ data: [] }) }));

import { appRouter } from "./routers";

const nodes = [
  "supervisor", "fundamental", "sentiment", "technical", "news", "bull", "bear", "trader", "risk_guardians", "fund_manager",
].map((roleKey) => ({ agentId: `core-${roleKey}`, roleKey, name: roleKey.replaceAll("_", " "), protectedRole: true, provider: "openai", model: "gpt-5-mini", state: "active", toolScopes: ["market.read"] }));

function context(): TrpcContext {
  return { user: { id: 7, openId: "owner", name: "Owner", email: null, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {} } as TrpcContext["req"], res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"] };
}

beforeEach(() => {
  vi.clearAllMocks();
  fabric.ensureProtectedAgentNodes.mockResolvedValue(nodes);
  fabric.listAgentMessages.mockResolvedValue([{ actor: "owner", content: "Inspect this asset" }]);
  fabric.createAgentMessage.mockResolvedValue({}); fabric.createEvolutionEvent.mockResolvedValue({}); fabric.createConversation.mockResolvedValue({});
  fabric.listWatchlistItems.mockResolvedValue([{ itemId: "item-1", address: "0x0000000000000000000000000000000000000001", label: "TEST" }, { itemId: "item-2", address: null, label: "No address" }]);
  fabric.updateWatchlistItemStatus.mockResolvedValue({}); fabric.createDiscoverySchedule.mockResolvedValue({ scheduleId: "schedule-1", cadence: "daily", enabled: false });
  fabric.getDiscoverySchedule.mockResolvedValue({ scheduleId: "schedule-1", cadence: "daily", enabled: false, scheduleCronTaskUid: null }); fabric.pauseDiscoverySchedule.mockResolvedValue({ scheduleId: "schedule-1", enabled: false });
  db.createOperatorAction.mockResolvedValue({}); db.getInvestmentPolicy.mockResolvedValue({ version: 1, allowedAssets: ["0x0000000000000000000000000000000000000001"] });
  llm.composeSpecialistOutput.mockResolvedValue("Observation: unknown\nConstraint: no live data\nNext research check: verify sources");
  llm.composeSupervisorReply.mockResolvedValue("Interpretation: bounded\nFabric synthesis: complete\nConstraints: simulation-only\nNext safe step: inspect sources");
  llm.calculateResearchNoteConfidence.mockReturnValue(68);
  llm.composeFundManagerDisagreementSummary.mockReturnValue("Fund Manager review: disagreement preserved; execution remains sealed.");
});

describe("TradingAgents operating contracts", () => {
  it("preserves protected roles while allowing provider and model routing changes", async () => {
    const caller = appRouter.createCaller(context());
    fabric.updateAgentModel.mockResolvedValue({ ...nodes[0], provider: "anthropic", model: "claude-haiku-4-5" });
    await caller.agentFabric.updateModel({ agentId: "core-supervisor", provider: "anthropic", model: "claude-haiku-4-5" });
    fabric.updateAgentModel.mockResolvedValue({ agentId: "optional-security", protectedRole: false, provider: "google", model: "gemini-2.5-flash" });
    await caller.agentFabric.updateModel({ agentId: "optional-security", provider: "google", model: "gemini-2.5-flash" });
    await expect(caller.agentFabric.retireOptionalSubagent({ agentId: "core-supervisor" })).rejects.toThrow("Protected roles cannot be deleted");
    expect(fabric.updateAgentModel).toHaveBeenCalledWith(7, "core-supervisor", "anthropic", "claude-haiku-4-5");
    expect(fabric.updateAgentModel).toHaveBeenCalledWith(7, "optional-security", "google", "gemini-2.5-flash");
  });

  it("persists owner chat, per-role outputs, and a supervisor synthesis using thread context", async () => {
    const caller = appRouter.createCaller(context());
    const result = await caller.agentFabric.sendSupervisorMessage({ message: "Inspect this asset" });
    expect(result.reply).toContain("Interpretation");
    expect(fabric.createConversation).toHaveBeenCalled();
    expect(fabric.listAgentMessages).toHaveBeenCalledWith(7, result.threadId);
    expect(llm.composeSpecialistOutput).toHaveBeenCalledTimes(7);
    expect(llm.composeSupervisorReply).toHaveBeenCalledWith(expect.objectContaining({ history: expect.any(Array), specialistReports: expect.any(Array) }));
    expect(fabric.createEvolutionEvent).toHaveBeenCalledWith(7, expect.objectContaining({ state: "completed" }));
  });

  it("evaluates watchlist candidates against the IPS approved universe and leaves incomplete items under review", async () => {
    const caller = appRouter.createCaller(context());
    const result = await caller.watchlists.evaluatePolicy();
    expect(result.policyPresent).toBe(true);
    expect(fabric.updateWatchlistItemStatus).toHaveBeenCalledWith(7, "item-1", "candidate");
    expect(fabric.updateWatchlistItemStatus).toHaveBeenCalledWith(7, "item-2", "review");
  });

  it("stores discovery schedules inactive and refuses activation before deployment", async () => {
    const caller = appRouter.createCaller(context());
    const schedule = await caller.discovery.configureInactive({ cadence: "daily" });
    expect(schedule.enabled).toBe(false);
    expect(fabric.createDiscoverySchedule).toHaveBeenCalledWith(7, expect.objectContaining({ cadence: "daily" }));
    await expect(caller.discovery.activate({ scheduleId: "schedule-1" })).rejects.toThrow("Deploy the site before activating");
  });

  it("allows the owner to pause a configured schedule without creating a live-execution pathway", async () => {
    const caller = appRouter.createCaller(context());
    await caller.discovery.pause({ scheduleId: "schedule-1" });
    expect(fabric.pauseDiscoverySchedule).toHaveBeenCalledWith(7, "schedule-1");
    expect(db.createOperatorAction).toHaveBeenCalledWith(7, expect.objectContaining({ kind: "discovery_schedule_configured", status: "review" }));
  });
});
