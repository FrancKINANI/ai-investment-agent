export type ChatFilter = "all" | "bull" | "bear" | "supervisor";

export function getResearchNoteConfidenceBand(score: number) {
  if (score < 52) return { label: "Limited coverage", tone: "limited" } as const;
  if (score < 72) return { label: "Developing coverage", tone: "developing" } as const;
  return { label: "Strong coverage", tone: "strong" } as const;
}

export function getChatPresentation(actor: string, agentId: string | null | undefined, roleByAgentId: ReadonlyMap<string, string>) {
  const roleKey = agentId ? roleByAgentId.get(agentId) : undefined;
  const tone = roleKey === "bull" || roleKey === "bull_researcher" ? "bull" : roleKey === "bear" || roleKey === "bear_researcher" ? "bear" : "neutral";
  const label = tone === "bull" ? "BULL CASE · UPSIDE" : tone === "bear" ? "BEAR CASE · RISK" : roleKey === "fund_manager" ? "FUND MANAGER · REVIEW" : actor === "owner" ? "YOU" : actor === "supervisor" ? "SUPERVISOR" : "AGENT";
  const cue = tone === "bull" ? "Positive thesis" : tone === "bear" ? "Challenge thesis" : undefined;
  return { tone, label, cue, roleKey };
}

export function matchesChatFilter(filter: ChatFilter, actor: string, agentId: string | null | undefined, roleByAgentId: ReadonlyMap<string, string>) {
  if (filter === "all") return true;
  const presentation = getChatPresentation(actor, agentId, roleByAgentId);
  if (filter === "supervisor") return actor === "supervisor" || presentation.roleKey === "fund_manager";
  return presentation.tone === filter;
}
