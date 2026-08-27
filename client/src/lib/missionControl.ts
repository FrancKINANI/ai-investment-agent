export type MissionEventState = "delegated" | "working" | "completed" | "blocked" | "created" | "retired";

export type MissionEvent = {
  agentId?: string | null;
  createdAt: Date | string;
  state: MissionEventState;
  summary: string;
};

export type AgentMissionState = {
  label: "working" | "queued" | "blocked" | "ready";
  summary: string;
};

export const agentRoleDescriptions: Record<string, string> = {
  supervisor: "Coordinates the research mission and reports the next safe step.",
  fundamental: "Tests fundamentals, adoption evidence, and structural assumptions.",
  technical: "Checks market structure and technical context.",
  news: "Tracks material events and source freshness.",
  sentiment: "Surfaces attention and sentiment signals with uncertainty.",
  bull: "Builds the strongest evidence-backed upside case.",
  bear: "Builds the strongest evidence-backed downside case.",
  risk_guardians: "Tests the thesis against policy and risk constraints.",
  fund_manager: "Turns the debate into an owner-facing decision brief.",
};

const activeStates = new Set<MissionEventState>(["working", "delegated", "blocked"]);

function eventTime(event: MissionEvent) {
  return new Date(event.createdAt).getTime();
}

export function latestAgentEvent(agentId: string, events: MissionEvent[]) {
  return events
    .filter((event) => event.agentId === agentId && activeStates.has(event.state))
    .sort((left, right) => eventTime(right) - eventTime(left))[0];
}

export function getAgentMissionState(agentId: string, events: MissionEvent[]): AgentMissionState {
  const event = latestAgentEvent(agentId, events);
  if (!event) return { label: "ready", summary: "Ready for a bounded research assignment." };
  if (event.state === "blocked") return { label: "blocked", summary: event.summary };
  if (event.state === "working") return { label: "working", summary: event.summary };
  return { label: "queued", summary: event.summary };
}

export function taskBucket(state: MissionEventState) {
  if (state === "working" || state === "delegated") return "now" as const;
  if (state === "blocked") return "blocked" as const;
  return "completed" as const;
}

export function readableRole(roleKey: string) {
  return roleKey.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
