export const memoryScopes = ["shared", "private"] as const;
export const memoryKinds = ["owner_instruction", "constraint", "verified_fact", "research_note", "question", "decision", "source_reference"] as const;
export const memoryStatuses = ["active", "pending_promotion", "superseded", "expired", "redacted"] as const;

export type AgentMemoryScope = (typeof memoryScopes)[number];
export type AgentMemoryKind = (typeof memoryKinds)[number];
export type AgentMemoryStatus = (typeof memoryStatuses)[number];

export type MemoryContextEntry = {
  memoryId: string;
  scope: AgentMemoryScope;
  agentId: string | null;
  kind: AgentMemoryKind;
  content: string;
  status: AgentMemoryStatus;
  pinned: boolean;
  expiresAt: Date | string | null;
  createdAt: Date | string;
};

const prohibitedPatterns: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/i, description: "a private-key block" },
  { pattern: /\b(?:seed\s+phrase|recovery\s+phrase|mnemonic\s+phrase)\b/i, description: "seed or recovery phrase material" },
  { pattern: /\b(?:api[_ -]?key|secret[_ -]?key|access[_ -]?token|session(?:[_ -]?token)?|bearer)\s*[:=]\s*[^\s]{12,}/i, description: "an authentication secret" },
  { pattern: /\b(?:cookie|set-cookie)\s*[:=]\s*[^\s]{12,}/i, description: "a session cookie" },
  { pattern: /\b0x[a-f0-9]{64}\b/i, description: "a private-key-shaped value" },
  { pattern: /\b(?:xox[baprs]-|gh[pousr]_|sk-[a-z0-9_-]{16,})/i, description: "a credential-shaped token" },
];

export function assertMemoryContentIsSafe(content: string) {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (normalized.length < 2) throw new Error("Memory must contain at least two characters.");
  if (normalized.length > 3_000) throw new Error("Memory is limited to 3,000 characters.");
  const prohibited = prohibitedPatterns.find(({ pattern }) => pattern.test(normalized));
  if (prohibited) throw new Error(`Memory cannot contain ${prohibited.description}.`);
  return normalized;
}

function time(value: Date | string | null | undefined) {
  return value ? new Date(value).getTime() : Number.NaN;
}

export function isMemoryActive(entry: MemoryContextEntry, now = Date.now()) {
  const expiry = time(entry.expiresAt);
  return entry.status === "active" && (Number.isNaN(expiry) || expiry > now);
}

export function selectMemoryContext(entries: MemoryContextEntry[], agentId: string, now = Date.now()) {
  const active = entries.filter((entry) => isMemoryActive(entry, now));
  const shared = active.filter((entry) => entry.scope === "shared");
  const privateEntries = active.filter((entry) => entry.scope === "private" && entry.agentId === agentId);
  const newestFirst = (left: MemoryContextEntry, right: MemoryContextEntry) => time(right.createdAt) - time(left.createdAt);
  const pinnedShared = shared.filter((entry) => entry.pinned).sort(newestFirst).slice(0, 8);
  const recentShared = shared.filter((entry) => !entry.pinned).sort(newestFirst).slice(0, 12);
  const recentPrivate = privateEntries.sort(newestFirst).slice(0, 8);
  return [...pinnedShared, ...recentShared, ...recentPrivate];
}

export function formatMemoryContext(entries: MemoryContextEntry[]) {
  if (!entries.length) return "No active owner memory was supplied.";
  return entries.map((entry, index) => {
    const scope = entry.scope === "shared" ? "TEAM-SHARED" : "PRIVATE TO SELECTED AGENT";
    return `[Memory ${index + 1} · ${scope} · ${entry.kind}]\n${entry.content}`;
  }).join("\n\n");
}

export function canPromoteMemory(entry: Pick<MemoryContextEntry, "scope" | "status">) {
  return entry.scope === "private" && entry.status === "active";
}
