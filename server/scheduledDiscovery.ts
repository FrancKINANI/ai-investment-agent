import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { getEthereumTokenMetrics } from "./onchain";
import { sdk } from "./_core/sdk";
import { createDiscoveryFinding, createEvolutionEvent, ensureProtectedAgentNodes, getDiscoveryFindingById, getDiscoveryScheduleByTaskUid, listWatchlistItems, markDiscoveryScheduleRun } from "./agentFabricDb";
import { createOperatorAction, getInvestmentPolicy } from "./db";

function runBucket(cadence: "daily" | "six_hour") {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  return cadence === "daily" ? day : `${day}-${String(Math.floor(now.getUTCHours() / 6) * 6).padStart(2, "0")}`;
}

export async function scheduledDiscoveryHandler(req: Request, res: Response) {
  try {
    const caller = await sdk.authenticateRequest(req);
    if (!caller.isCron || !caller.taskUid) return res.status(403).json({ error: "cron-only" });
    const schedule = await getDiscoveryScheduleByTaskUid(caller.taskUid);
    if (!schedule || !schedule.enabled) return res.json({ ok: true, skipped: "orphan-or-paused" });
    const [items, policy, nodes] = await Promise.all([listWatchlistItems(schedule.userId), getInvestmentPolicy(schedule.userId), ensureProtectedAgentNodes(schedule.userId)]);
    const allowed = new Set((policy?.allowedAssets ?? []).map((asset) => asset.toLowerCase()));
    const discoveryAgent = nodes.find((node) => node.roleKey === "fundamental") ?? nodes.find((node) => node.roleKey === "supervisor");
    const bucket = runBucket(schedule.cadence);
    const findings = [];
    for (const item of items) {
      const findingId = `${schedule.scheduleId}-${item.itemId}-${bucket}`;
      if (await getDiscoveryFindingById(findingId)) continue;
      let status: "candidate" | "review" | "blocked" = !policy || !item.address ? "review" : allowed.has(item.address.toLowerCase()) ? "candidate" : "blocked";
      let score = status === "candidate" ? 70 : status === "review" ? 45 : 0;
      let confidence: "low" | "medium" | "high" = item.address ? "medium" : "low";
      const evidence = ["schedule:simulation-only", `cadence:${schedule.cadence}`, `watchlist-item:${item.itemId}`];
      let summary = item.address ? `Policy state is ${status}. Public-token evidence has not been retrieved yet.` : "No EVM contract address is configured, so this item remains under review.";
      if (item.address) {
        try {
          const metrics = await getEthereumTokenMetrics(item.address);
          evidence.push(`source:${metrics.sources.explorer}`, `source:${metrics.sources.market}`, `freshness:${metrics.freshness}`, `token:${metrics.token.address}`);
          const liquidity = metrics.market?.liquidityUsd ?? null;
          score = status === "candidate" ? Math.min(100, 65 + (liquidity && liquidity > 0 ? 15 : 0) + (metrics.token.holders && metrics.token.holders > 0 ? 10 : 0)) : score;
          confidence = metrics.market?.sourceUrl ? "high" : "medium";
          summary = `Public evidence collected for ${metrics.token.symbol}: ${metrics.token.holders ?? "unavailable"} holders, ${liquidity ?? "unavailable"} USD reported liquidity. Policy state is ${status}; this is not a trade signal.`;
        } catch (error) {
          evidence.push("public-token-data-unavailable");
          confidence = "low";
          summary = `Public token evidence could not be retrieved for this scheduled run. Policy state remains ${status}; no value was fabricated.`;
        }
      }
      const finding = await createDiscoveryFinding(schedule.userId, { findingId, scheduleId: schedule.scheduleId, watchlistItemId: item.itemId, score, confidence, status, summary, evidence });
      findings.push(finding);
      await createEvolutionEvent(schedule.userId, { eventId: nanoid(), agentId: discoveryAgent?.agentId, state: "completed", summary: `Scheduled ${schedule.cadence} discovery recorded ${item.label} as ${status}.`, evidence });
    }
    await markDiscoveryScheduleRun(schedule.scheduleId);
    await createOperatorAction(schedule.userId, { actionId: nanoid(), kind: "discovery_completed", status: "success", subject: `${schedule.cadence} watchlist discovery`, detail: `Scheduled discovery created ${findings.length} source-bound simulation-only finding(s).`, payload: { scheduleId: schedule.scheduleId, findingCount: findings.length, execution: "simulation-only" } });
    return res.json({ ok: true, scheduleId: schedule.scheduleId, findings: findings.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
  }
}
