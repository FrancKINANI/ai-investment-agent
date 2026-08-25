/**
 * Wallet connection service (Stage 4 — view-first, non-custodial).
 *
 * Security design:
 * - The server NEVER generates addresses or transaction hashes. Addresses come
 *   from the owner's own wallet client (injected provider / WalletConnect) and
 *   are validated for shape before a session is stored.
 * - Only non-secret session metadata is persisted (address, chainId, provider).
 * - Sessions carry capabilities: ["view"] only. Signing is NOT implemented in
 *   Stage 4; any signing request is hard-rejected until separately approved.
 * - Every session is owner-scoped and revocable in one call.
 */

import { nanoid } from "nanoid";
import { createOperatorAction, createSecurityAlert, getDb } from "./db";
import { walletSessions } from "../drizzle/schema";
import { and, desc, eq } from "drizzle-orm";

export type WalletProvider = "walletconnect" | "injected" | "coinbase";

/** Capabilities granted to wallet sessions. View-only until owner approves more. */
export const SESSION_CAPABILITIES = ["view"] as const;

export const SUPPORTED_CHAINS = {
  1: { name: "Ethereum Mainnet", currency: "ETH", explorer: "https://etherscan.io" },
  137: { name: "Polygon PoS", currency: "POL", explorer: "https://polygonscan.com" },
  42161: { name: "Arbitrum One", currency: "ETH", explorer: "https://arbiscan.io" },
  10: { name: "Optimism", currency: "ETH", explorer: "https://optimistic.etherscan.io" },
  8453: { name: "Base", currency: "ETH", explorer: "https://basescan.org" },
} as const;

export function isSupportedChain(chainId: number): boolean {
  return chainId in SUPPORTED_CHAINS;
}

/** Array projection consumed by client chain pickers. */
export function getSupportedChains() {
  return Object.entries(SUPPORTED_CHAINS).map(([id, info]) => ({ chainId: Number(id), ...info }));
}

/**
 * Register a view-only wallet session. The address MUST have been verified by
 * the owner's wallet client (e.g. eth_requestAccounts); the server validates
 * shape only and never invents one.
 */
export async function connectWallet(
  userId: number,
  input: { address: string; chainId: number; provider: WalletProvider },
): Promise<{ sessionId: string; address: string; chainId: number; provider: WalletProvider; capabilities: readonly string[] }> {
  const address = input.address.trim();
  // Shape check only (0x + 40 hex chars). The server never derives addresses.
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("Invalid wallet address. Connect via your wallet client; Ledgerline does not accept generated addresses.");
  }
  if (!isSupportedChain(input.chainId)) {
    throw new Error(`Chain ${input.chainId} is not supported.`);
  }

  const db = await getDb();
  if (!db) throw new Error("Database unavailable; refusing to create wallet session (fail closed).");

  // One active session per (owner, provider) — reconnecting replaces it.
  await db.update(walletSessions)
    .set({ state: "revoked", revokedAt: new Date() })
    .where(and(eq(walletSessions.userId, userId), eq(walletSessions.provider, input.provider), eq(walletSessions.state, "active")));

  const sessionId = nanoid();
  await db.insert(walletSessions).values({
    userId,
    sessionId,
    address: address.toLowerCase(),
    chainId: input.chainId,
    provider: input.provider,
    state: "active",
    capabilities: [...SESSION_CAPABILITIES],
  });

  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "wallet_connected",
    status: "success",
    subject: `Wallet connected (view-only): ${address.slice(0, 6)}…${address.slice(-4)}`,
    detail: `Owner connected a ${input.provider} wallet on chain ${input.chainId}. View-only session; no signing authority granted.`,
    payload: { sessionId, address: address.toLowerCase(), chainId: input.chainId, provider: input.provider, capabilities: SESSION_CAPABILITIES },
  });

  return { sessionId, address: address.toLowerCase(), chainId: input.chainId, provider: input.provider, capabilities: SESSION_CAPABILITIES };
}

/** Revoke a session. Owner-scoped; returns false when the session doesn't belong to the caller. */
export async function disconnectWallet(userId: number, sessionId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(walletSessions)
    .where(and(eq(walletSessions.userId, userId), eq(walletSessions.sessionId, sessionId), eq(walletSessions.state, "active")))
    .limit(1);
  const session = rows[0];
  if (!session) return false;

  await db.update(walletSessions)
    .set({ state: "revoked", revokedAt: new Date() })
    .where(eq(walletSessions.id, session.id));

  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "wallet_disconnected",
    status: "success",
    subject: `Wallet disconnected: ${session.address.slice(0, 6)}…${session.address.slice(-4)}`,
    detail: `Owner revoked the ${session.provider} wallet session on chain ${session.chainId}.`,
    payload: { sessionId, address: session.address, chainId: session.chainId },
  });
  return true;
}

/** Owner's own sessions only — never crosses owners. */
export async function listWalletSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(walletSessions)
    .where(eq(walletSessions.userId, userId))
    .orderBy(desc(walletSessions.connectedAt))
    .limit(50);
}

/**
 * Hard rejection for signing requests. Stage 4 is view-first; signing requires
 * a separate owner-approved stage and its own capability grant.
 */
export class WalletSigningNotPermittedError extends Error {
  constructor() {
    super("Wallet signing is not permitted. Stage 4 sessions are view-only; signing authority is a separately approved later stage.");
    this.name = "WalletSigningNotPermittedError";
  }
}

export async function requestTransaction(userId: number): Promise<never> {
  await createSecurityAlert(userId, {
    alertId: nanoid(),
    level: "warning",
    category: "signing-attempt",
    title: "Wallet signing attempted",
    detail: "A transaction-signing path was invoked during the view-first stage. No signature was produced and no hash was generated.",
  }).catch(() => undefined);
  throw new WalletSigningNotPermittedError();
}
