/**
 * WalletConnect v2 service for on-chain wallet connection.
 *
 * Security design:
 * - WalletConnect handles the signing flow — the agent never sees private keys
 * - Session state is stored server-side with the mandate
 * - Only approved namespaces/chains are allowed
 * - Transaction requests go through the mandate limit checks before signing
 *
 * ponytail: This module provides the interface and types. Full WalletConnect v2
 * integration requires @walletconnect/modal and @walletconnect/sign-client packages.
 * The current implementation uses a simulated session for UI development.
 */

import { nanoid } from "nanoid";
import { createOperatorAction, createSecurityAlert } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────

export type WalletProvider = "walletconnect" | "injected" | "coinbase";

export type WalletSession = {
  sessionId: string;
  address: string;
  chainId: number;
  provider: WalletProvider;
  connectedAt: Date;
  metadata?: {
    name: string;
    icon?: string;
  };
};

export type TransactionRequest = {
  to: string;
  value?: string;
  data?: string;
  chainId: number;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
};

export type TransactionResult = {
  hash: string;
  from: string;
  to: string;
  chainId: number;
  status: "pending" | "confirmed" | "failed";
};

// ─── Supported Chains ─────────────────────────────────────────────────────

export const SUPPORTED_CHAINS = {
  1: { name: "Ethereum Mainnet", currency: "ETH", explorer: "https://etherscan.io" },
  137: { name: "Polygon", currency: "MATIC", explorer: "https://polygonscan.com" },
  42161: { name: "Arbitrum One", currency: "ETH", explorer: "https://arbiscan.io" },
  10: { name: "Optimism", currency: "ETH", explorer: "https://optimistic.etherscan.io" },
  8453: { name: "Base", currency: "ETH", explorer: "https://basescan.org" },
} as const;

// ─── Session Store ────────────────────────────────────────────────────────

// ponytail: In production, sessions should be stored in the database
// associated with the wallet mandate. This in-memory store is for development.
const sessions = new Map<string, WalletSession>();

// ─── Connection ───────────────────────────────────────────────────────────

/**
 * Initiate a WalletConnect v2 session.
 *
 * In production, this would:
 * 1. Create a WalletConnect sign client
 * 2. Generate a pairing URI
 * 3. Display the QR code via @walletconnect/modal
 * 4. Wait for the wallet to approve the session
 * 5. Return the approved session with address and chain
 *
 * The current implementation simulates this flow for UI development.
 */
export async function connectWallet(
  userId: number,
  provider: WalletProvider = "walletconnect",
  chainId: number = 1,
): Promise<WalletSession> {
  // ponytail: simulated connection — real implementation uses @walletconnect/sign-client
  // In production:
  // const signClient = await SignClient.init({ projectId: WC_PROJECT_ID, ... });
  // const { uri } = await signClient.connect({ requiredNamespaces: { eip155: { methods: [...], chains: [...] } } });
  // Display URI via Modal and wait for approval...

  const mockAddress = "0x" + Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

  const session: WalletSession = {
    sessionId: nanoid(),
    address: mockAddress,
    chainId,
    provider,
    connectedAt: new Date(),
    metadata: { name: provider === "walletconnect" ? "WalletConnect" : provider === "coinbase" ? "Coinbase Wallet" : "Injected" },
  };

  sessions.set(session.sessionId, session);

  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "scope_checked",
    status: "success",
    subject: `Wallet connected: ${mockAddress.slice(0, 6)}…${mockAddress.slice(-4)}`,
    detail: `Owner connected a ${provider} wallet on chain ${chainId}. No signing authority was granted.`,
    payload: { sessionId: session.sessionId, address: mockAddress, chainId, provider },
  });

  await createSecurityAlert(userId, {
    alertId: nanoid(),
    level: "info",
    category: "wallet-connected",
    title: `Wallet connected: ${provider}`,
    detail: `A ${provider} wallet (${mockAddress.slice(0, 6)}…${mockAddress.slice(-4)}) was connected on chain ${chainId}.`,
  });

  return session;
}

/**
 * Disconnect a wallet session.
 */
export async function disconnectWallet(userId: number, sessionId: string): Promise<boolean> {
  const session = sessions.get(sessionId);
  if (!session) return false;

  sessions.delete(sessionId);

  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "scope_checked",
    status: "success",
    subject: `Wallet disconnected: ${session.address.slice(0, 6)}…${session.address.slice(-4)}`,
    detail: `Owner disconnected a ${session.provider} wallet.`,
    payload: { sessionId, address: session.address, chainId: session.chainId },
  });

  return true;
}

/**
 * Get all active sessions for a display purpose.
 */
export function getActiveSessions(): WalletSession[] {
  return Array.from(sessions.values());
}

/**
 * Get a specific session.
 */
export function getSession(sessionId: string): WalletSession | undefined {
  return sessions.get(sessionId);
}

// ─── Transaction Signing ──────────────────────────────────────────────────

/**
 * Request a transaction signature from the connected wallet.
 *
 * In production, this would:
 * 1. Validate the mandate allows this chain/asset
 * 2. Build the transaction with proper gas estimation
 * 3. Send the signing request via WalletConnect
 * 4. Wait for the wallet to sign
 * 5. Broadcast the signed transaction
 * 6. Log the result
 *
 * The current implementation simulates this flow.
 */
export async function requestTransaction(
  userId: number,
  sessionId: string,
  transaction: TransactionRequest,
): Promise<TransactionResult> {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Wallet session not found.");

  if (session.chainId !== transaction.chainId) {
    throw new Error(`Transaction chain ${transaction.chainId} does not match session chain ${session.chainId}.`);
  }

  // ponytail: simulated signing — real implementation uses signClient.request()
  const mockHash = "0x" + Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

  const result: TransactionResult = {
    hash: mockHash,
    from: session.address,
    to: transaction.to,
    chainId: transaction.chainId,
    status: "pending",
  };

  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "scope_checked",
    status: "review",
    subject: `Transaction requested: ${transaction.to.slice(0, 8)}…`,
    detail: `Owner requested a transaction signing via ${session.provider}. Hash: ${mockHash.slice(0, 10)}…`,
    payload: { sessionId, hash: mockHash, to: transaction.to, chainId: transaction.chainId, value: transaction.value },
  });

  return result;
}

// ─── Chain Utilities ──────────────────────────────────────────────────────

/**
 * Get supported chain info.
 */
export function getSupportedChains() {
  return Object.entries(SUPPORTED_CHAINS).map(([id, info]) => ({
    chainId: Number(id),
    ...info,
  }));
}

/**
 * Validate that a chain ID is supported.
 */
export function isSupportedChain(chainId: number): chainId is keyof typeof SUPPORTED_CHAINS {
  return chainId in SUPPORTED_CHAINS;
}
