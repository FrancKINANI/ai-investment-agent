import { invokeLLM } from "./_core/llm";
import { resolveAgentEvidence, formatEvidenceForPrompt, type EvidencePacket } from "./agentCapabilities";
import { findTeamRole, loadAgentTeam } from "@shared/agentTeam";

/**
 * Get the delegation list from team.yaml instead of hardcoding.
 * Falls back to the hardcoded list if config is unavailable.
 */
export function getDefaultDelegation(): string[] {
  try {
    const team = loadAgentTeam();
    return team.agents
      .filter((agent) => agent.enabled && agent.delegate)
      .map((agent) => agent.id);
  } catch {
    return ["fundamental", "sentiment", "technical", "news", "bull", "bear", "risk_guardians"];
  }
}

// Keep backward compatibility
export const defaultDelegation = getDefaultDelegation();

type ThreadMessage = { actor: string; content: string };
export type SpecialistReport = { role: string; name: string; output: string; confidence?: number; evidence?: EvidencePacket };

/**
 * Measures whether a bounded research note states its limits and provenance.
 * It is deliberately not a prediction, a probability of profit, or an assertion
 * about market data quality; the owner can inspect the original note and sources.
 */
export function calculateResearchNoteConfidence(output: string) {
  const normalized = output.toLowerCase();
  const hasRequiredStructure = ["observation", "constraint", "next research check"].filter((label) => normalized.includes(label)).length;
  const evidenceCues = ["source", "evidence", "data", "thread", "owner supplied", "provided"].filter((cue) => normalized.includes(cue)).length;
  const uncertaintyCues = ["unknown", "not supplied", "cannot verify", "insufficient"].filter((cue) => normalized.includes(cue)).length;
  return Math.max(35, Math.min(88, 42 + hasRequiredStructure * 12 + Math.min(evidenceCues, 3) * 4 - Math.max(0, uncertaintyCues - 1) * 3));
}

/** A deterministic review that explicitly preserves the Bull/Bear disagreement for owner review. */
export function composeFundManagerDisagreementSummary(reports: SpecialistReport[]) {
  const bull = reports.find((report) => report.role === "bull" || report.role === "bull_researcher");
  const bear = reports.find((report) => report.role === "bear" || report.role === "bear_researcher");
  if (!bull || !bear) return "### Fund Manager review\n**Status:** Debate incomplete. Both Bull and Bear notes are required before a disagreement can be reviewed.\n\n**Safe next step:** Keep the item in research or paper simulation; do not promote authority.";

  const difference = Math.abs((bull.confidence ?? 0) - (bear.confidence ?? 0));
  const posture = difference <= 12 ? "The research-note completeness signals are close, so the disagreement is material and unresolved." : "One note is more complete by the declared research-note heuristic; this does not establish market direction.";
  return `### Fund Manager review\n**Bull case:** ${bull.confidence ?? "—"}/100 research-note completeness.\n\n**Bear case:** ${bear.confidence ?? "—"}/100 research-note completeness.\n\n**Disagreement:** ${posture}\n\n**Safe next step:** Require traceable evidence, Risk review, IPS checks, and an owner-approved paper-simulation proposal before any promotion. This review is not an execution approval.`;
}

export async function composeSpecialistOutput(input: { model: string; role: string; name: string; message: string; history: ThreadMessage[]; userId?: number; tokenAddress?: string }) {
  // Fetch evidence data based on agent's Registry-bound capabilities
  let evidenceContext = "";
  let evidencePacket: EvidencePacket | undefined;
  if (input.userId) {
    try {
      evidencePacket = await resolveAgentEvidence(input.userId, input.role, input.name, input.tokenAddress);
      evidenceContext = formatEvidenceForPrompt(evidencePacket);
    } catch {
      evidenceContext = "Evidence data unavailable.";
    }
  }

  const response = await invokeLLM({
    model: input.model,
    messages: [
      {
        role: "system",
        content: `You are the ${input.name} (${input.role}) in Ledgerline's owner-governed research fabric. Produce a concise, bounded working note in Markdown with exactly three labels: Observation, Constraint, Next research check. Use the evidence data provided below as your primary data source. Supplement with owner-provided context from the thread. If evidence data is unavailable, explicitly say what is unknown. Never give personalised investment advice, promise returns, request credentials, or propose a real trade.`,
      },
      ...(evidenceContext ? [{ role: "user" as const, content: `Evidence data for your analysis:\n${evidenceContext}` }] : []),
      ...input.history.slice(-10).map((message) => ({ role: "user" as const, content: `${message.actor}: ${message.content}` })),
      { role: "user", content: `Current owner instruction: ${input.message}` },
    ],
    maxTokens: 420,
  });
  const content = response.choices[0]?.message?.content;
  return { output: typeof content === "string" && content.trim() ? content.trim() : `${input.name} could not produce a bounded working note.`, evidence: evidencePacket };
}

export async function composeSupervisorReply(input: { model: string; message: string; agentNames: string[]; history: ThreadMessage[]; specialistReports: SpecialistReport[] }) {
  const response = await invokeLLM({
    model: input.model,
    messages: [
      {
        role: "system",
        content: `You are Ledgerline's supervisor in a personal investment research system. You coordinate these protected roles: ${input.agentNames.join(", ")}. Reply in concise Markdown with exactly four labelled sections: Interpretation, Fabric synthesis, Constraints, Next safe step. You may use only the owner thread and supplied specialist notes. Do not claim you retrieved live data unless supplied in the thread. Never give personalised investment advice, promise returns, request private keys, or suggest an executable trade. Keep all action proposals research- or paper-only.`,
      },
      ...input.history.slice(-10).map((message) => ({ role: "user" as const, content: `${message.actor}: ${message.content}` })),
      { role: "user", content: `Current owner instruction: ${input.message}\n\nSpecialist notes:\n${input.specialistReports.map((report) => `- ${report.name}: ${report.output}`).join("\n")}` },
    ],
    maxTokens: 900,
  });
  const content = response.choices[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : "The supervisor could not produce a response. Please try again.";
}
