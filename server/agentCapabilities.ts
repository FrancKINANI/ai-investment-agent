/**
 * Agent Capabilities Resolver
 *
 * Bridges the Capability Registry with the agent fabric.
 * When an agent is delegated, this module:
 * 1. Looks up the agent's capabilities from the Registry
 * 2. Fetches data from the appropriate sources (market, chain, portfolio)
 * 3. Returns a bounded evidence packet for the agent's prompt
 *
 * This is the mechanism that makes agents actually useful:
 * instead of rephrasing owner messages, they receive real data to analyze.
 */

import { validateCapabilityAccess } from "@shared/capabilityRegistry";
import { getEthereumTokenMetrics } from "./onchain";
import { readBinanceTicker } from "./liveData";
import { getAuthorityState } from "./db";

export type EvidencePacket = {
  agentId: string;
  agentRole: string;
  capabilities: string[];
  market?: {
    symbol: string;
    price: number;
    change24h: number;
    volume24h: number;
    source: string;
  };
  chain?: {
    address: string;
    holders?: number;
    totalSupply?: string;
    source: string;
  };
  portfolio?: {
    summary: string;
  };
  errors: string[];
};

/**
 * Resolve capabilities for an agent and fetch data from bound sources.
 * Returns an evidence packet that can be included in the agent's prompt.
 */
export async function resolveAgentEvidence(
  userId: number,
  agentRole: string,
  agentName: string,
  tokenAddress?: string,
): Promise<EvidencePacket> {
  const packet: EvidencePacket = {
    agentId: agentRole,
    agentRole,
    capabilities: [],
    errors: [],
  };

  // Verify the agent has capabilities via the Registry
  let capabilities: string[] = [];
  try {
    capabilities = validateCapabilityAccess(agentRole, ["market-evidence.read"]);
  } catch {
    // Agent doesn't have market-evidence.read — skip market data
  }

  // Try to also get chain capabilities
  try {
    const chainCaps = validateCapabilityAccess(agentRole, ["chain-evidence.read"]);
    capabilities = [...capabilities, ...chainCaps];
  } catch {
    // Agent doesn't have chain-evidence.read
  }

  packet.capabilities = [...new Set(capabilities)];

  // Fetch market data if the agent has market-evidence.read
  if (capabilities.includes("market-evidence.read")) {
    try {
      const authorityState = await getAuthorityState(userId);
      const ticker = await readBinanceTicker({ symbol: "ETHUSDT", authorityState });
      if (ticker.ok) {
        const price = Number(ticker.data.price);
        const change24h = Number(ticker.data.change24h ?? 0);
        const volume24h = Number(ticker.data.volume ?? 0);
        if (!Number.isFinite(price) || !Number.isFinite(change24h) || !Number.isFinite(volume24h)) {
          throw new Error("Public market evidence returned non-numeric values.");
        }
        packet.market = {
          symbol: "ETHUSDT",
          price,
          change24h,
          volume24h,
          source: "Binance public ticker",
        };
      }
    } catch (error) {
      packet.errors.push(`Market data unavailable: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  // Fetch on-chain data if the agent has chain-evidence.read and a token address
  if (capabilities.includes("chain-evidence.read") && tokenAddress) {
    try {
      const metrics = await getEthereumTokenMetrics(tokenAddress);
      if (metrics) {
        packet.chain = {
          address: tokenAddress,
          holders: metrics.token.holders ?? undefined,
          // The selected public provider does not return a verifiable total
          // supply field; omit it rather than inventing an on-chain fact.
          totalSupply: undefined,
          source: "Blockscout public API",
        };
      }
    } catch (error) {
      packet.errors.push(`Chain data unavailable: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  return packet;
}

/**
 * Format an evidence packet as a bounded context string for agent prompts.
 * Caps the total length to avoid overwhelming the model.
 */
export function formatEvidenceForPrompt(packet: EvidencePacket): string {
  const sections: string[] = [];

  if (packet.market) {
    sections.push(
      `## Market Data (${packet.market.source})\n` +
      `- Symbol: ${packet.market.symbol}\n` +
      `- Price: $${packet.market.price}\n` +
      `- 24h change: ${packet.market.change24h > 0 ? "+" : ""}${packet.market.change24h.toFixed(2)}%\n` +
      `- 24h volume: $${packet.market.volume24h.toLocaleString()}`
    );
  }

  if (packet.chain) {
    sections.push(
      `## On-Chain Data (${packet.chain.source})\n` +
      `- Address: ${packet.chain.address}\n` +
      (packet.chain.holders ? `- Holders: ${packet.chain.holders.toLocaleString()}\n` : "") +
      (packet.chain.totalSupply ? `- Total supply: ${packet.chain.totalSupply}` : "")
    );
  }

  if (packet.errors.length > 0) {
    sections.push(`## Data Limitations\n${packet.errors.map((e) => `- ${e}`).join("\n")}`);
  }

  if (sections.length === 0) {
    return "No evidence data available for this agent's capabilities. Analyze based on owner-provided context only.";
  }

  return sections.join("\n\n");
}
