/**
 * Sailor Protocol service for non-custodial on-chain mandates.
 *
 * Security design:
 * - The agent NEVER holds private keys
 * - Mandates are on-chain smart contracts that define execution rules
 * - The owner signs mandates with their wallet via WalletConnect
 * - The agent can only execute within the mandate's parameters
 * - Mandate revocation is immediate and on-chain
 *
 * Sailor Protocol concepts:
 * - Mandate: An on-chain contract defining what the agent can do
 * - Scope: The specific operations allowed (e.g., swap, add liquidity)
 * - Cap: Maximum value the agent can move per transaction or per day
 * - Revocation: Owner can revoke the mandate at any time
 *
 * ponytail: This module provides the interface and types. Full Sailor Protocol
 * integration requires the Sailor SDK. The current implementation uses a
 * simulated mandate store for UI development.
 */

import { nanoid } from "nanoid";
import { createOperatorAction, createSecurityAlert } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────

export type MandateScope = "swap" | "add_liquidity" | "remove_liquidity" | "stake" | "claim" | "transfer";

export type SailorMandate = {
  mandateId: string;
  userId: number;
  ownerAddress: string;
  chainId: number;
  contractAddress?: string;
  scopes: MandateScope[];
  maxTransactionValue: string; // In wei or smallest unit
  maxDailyValue: string;
  allowedTokens: string[]; // Token addresses (empty = all)
  allowedProtocols: string[]; // Protocol addresses (empty = all)
  expiresAt?: Date;
  revokedAt?: Date;
  status: "pending" | "active" | "revoked" | "expired";
  createdAt: Date;
  updatedAt: Date;
};

export type MandateTransaction = {
  txId: string;
  mandateId: string;
  to: string;
  value: string;
  data: string;
  chainId: number;
  status: "pending" | "signed" | "submitted" | "confirmed" | "failed";
  hash?: string;
  createdAt: Date;
};

// ─── Mandate Store ────────────────────────────────────────────────────────

// ponytail: In production, mandates are on-chain contracts.
// This store simulates them for UI development.
const mandates = new Map<string, SailorMandate>();
const mandateTransactions = new Map<string, MandateTransaction[]>();

// ─── Mandate Management ───────────────────────────────────────────────────

/**
 * Create a new sailor mandate.
 *
 * In production, this would:
 * 1. Deploy a mandate contract on-chain via the Sailor SDK
 * 2. Return the contract address for owner signing
 * 3. Wait for the owner to sign the mandate with their wallet
 * 4. Activate the mandate once signed
 *
 * The current implementation simulates this flow.
 */
export async function createMandate(
  userId: number,
  params: {
    ownerAddress: string;
    chainId: number;
    scopes: MandateScope[];
    maxTransactionValue: string;
    maxDailyValue: string;
    allowedTokens?: string[];
    allowedProtocols?: string[];
    expiresAt?: Date;
  },
): Promise<SailorMandate> {
  const mandate: SailorMandate = {
    mandateId: nanoid(),
    userId,
    ownerAddress: params.ownerAddress,
    chainId: params.chainId,
    scopes: params.scopes,
    maxTransactionValue: params.maxTransactionValue,
    maxDailyValue: params.maxDailyValue,
    allowedTokens: params.allowedTokens ?? [],
    allowedProtocols: params.allowedProtocols ?? [],
    expiresAt: params.expiresAt,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mandates.set(mandate.mandateId, mandate);

  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "mandate_created",
    status: "review",
    subject: `Sailor mandate created: ${mandate.mandateId.slice(0, 8)}`,
    detail: `Owner created a non-custodial mandate for chain ${params.chainId}. Scopes: ${params.scopes.join(", ")}. Awaiting owner signature.`,
    payload: {
      mandateId: mandate.mandateId,
      chainId: params.chainId,
      scopes: params.scopes,
      maxTransactionValue: params.maxTransactionValue,
      maxDailyValue: params.maxDailyValue,
    },
  });

  return mandate;
}

/**
 * Activate a mandate after owner signature.
 *
 * In production, this would verify the on-chain contract is deployed
 * and the owner has signed it.
 */
export async function activateMandate(
  userId: number,
  mandateId: string,
  contractAddress: string,
): Promise<SailorMandate> {
  const mandate = mandates.get(mandateId);
  if (!mandate) throw new Error("Mandate not found.");
  if (mandate.status !== "pending") throw new Error(`Mandate is ${mandate.status}, not pending.`);

  mandate.contractAddress = contractAddress;
  mandate.status = "active";
  mandate.updatedAt = new Date();

  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "mandate_mode_changed",
    status: "success",
    subject: `Mandate activated: ${mandateId.slice(0, 8)}`,
    detail: `Owner signed and activated a non-custodial Sailor mandate. The agent can now execute within the mandate's scope and limits.`,
    payload: { mandateId, contractAddress, scopes: mandate.scopes },
  });

  await createSecurityAlert(userId, {
    alertId: nanoid(),
    level: "info",
    category: "mandate-activated",
    title: `Sailor mandate activated`,
    detail: `A non-custodial mandate (${mandateId.slice(0, 8)}…) was activated on chain ${mandate.chainId}. Scopes: ${mandate.scopes.join(", ")}.`,
  });

  return mandate;
}

/**
 * Revoke a mandate immediately.
 *
 * In production, this would call the revoke function on the on-chain contract.
 * Revocation is immediate and cannot be undone.
 */
export async function revokeMandate(userId: number, mandateId: string): Promise<SailorMandate> {
  const mandate = mandates.get(mandateId);
  if (!mandate) throw new Error("Mandate not found.");
  if (mandate.status === "revoked") throw new Error("Mandate is already revoked.");

  mandate.status = "revoked";
  mandate.revokedAt = new Date();
  mandate.updatedAt = new Date();

  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "mandate_mode_changed",
    status: "success",
    subject: `Mandate revoked: ${mandateId.slice(0, 8)}`,
    detail: `Owner revoked a non-custodial Sailor mandate. All pending transactions are cancelled.`,
    payload: { mandateId, revokedAt: mandate.revokedAt },
  });

  await createSecurityAlert(userId, {
    alertId: nanoid(),
    level: "warning",
    category: "mandate-revoked",
    title: `Sailor mandate revoked`,
    detail: `A non-custodial mandate (${mandateId.slice(0, 8)}…) was revoked. All pending transactions are cancelled.`,
  });

  return mandate;
}

/**
 * Get all mandates for a user (owner-isolated).
 */
export function listMandates(userId: number): SailorMandate[] {
  return Array.from(mandates.values()).filter((m) => m.userId === userId);
}

/**
 * Get a specific mandate.
 */
export function getMandate(mandateId: string): SailorMandate | undefined {
  return mandates.get(mandateId);
}

// ─── Transaction Execution ────────────────────────────────────────────────

/**
 * Execute a transaction within a mandate's scope.
 *
 * In production, this would:
 * 1. Validate the mandate is active and covers the operation
 * 2. Check value caps (per-transaction and daily)
 * 3. Build the transaction calldata
 * 4. Send via WalletConnect for owner signature
 * 5. Broadcast the signed transaction
 * 6. Log everything
 *
 * The current implementation simulates this flow.
 */
export async function executeMandateTransaction(
  userId: number,
  mandateId: string,
  transaction: {
    to: string;
    value: string;
    data: string;
    chainId: number;
  },
): Promise<MandateTransaction> {
  const mandate = mandates.get(mandateId);
  if (!mandate) throw new Error("Mandate not found.");
  if (mandate.status !== "active") throw new Error(`Mandate is ${mandate.status}, not active.`);
  if (mandate.revokedAt) throw new Error("Mandate has been revoked.");

  // Check chain matches
  if (mandate.chainId !== transaction.chainId) {
    throw new Error(`Transaction chain ${transaction.chainId} does not match mandate chain ${mandate.chainId}.`);
  }

  // Check value cap
  const txValue = BigInt(transaction.value);
  const maxValue = BigInt(mandate.maxTransactionValue);
  if (txValue > maxValue) {
    throw new Error(`Transaction value ${transaction.value} exceeds mandate max ${mandate.maxTransactionValue}.`);
  }

  // Check expiry
  if (mandate.expiresAt && mandate.expiresAt < new Date()) {
    mandate.status = "expired";
    mandate.updatedAt = new Date();
    throw new Error("Mandate has expired.");
  }

  const tx: MandateTransaction = {
    txId: nanoid(),
    mandateId,
    to: transaction.to,
    value: transaction.value,
    data: transaction.data,
    chainId: transaction.chainId,
    status: "pending",
    createdAt: new Date(),
  };

  const txs = mandateTransactions.get(mandateId) ?? [];
  txs.push(tx);
  mandateTransactions.set(mandateId, txs);

  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "scope_checked",
    status: "review",
    subject: `Mandate transaction: ${transaction.to.slice(0, 8)}…`,
    detail: `Agent requested a transaction via Sailor mandate ${mandateId.slice(0, 8)}. Value: ${transaction.value}. Awaiting owner signature.`,
    payload: { mandateId, txId: tx.txId, to: transaction.to, value: transaction.value, chainId: transaction.chainId },
  });

  return tx;
}

/**
 * Get transactions for a mandate.
 */
export function listMandateTransactions(mandateId: string): MandateTransaction[] {
  return mandateTransactions.get(mandateId) ?? [];
}

// ─── Utilities ────────────────────────────────────────────────────────────

/**
 * Get available mandate scopes.
 */
export function getAvailableScopes(): MandateScope[] {
  return ["swap", "add_liquidity", "remove_liquidity", "stake", "claim", "transfer"];
}

/**
 * Validate mandate parameters.
 */
export function validateMandateParams(params: {
  scopes: MandateScope[];
  maxTransactionValue: string;
  maxDailyValue: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (params.scopes.length === 0) errors.push("At least one scope is required.");
  if (params.scopes.length > 6) errors.push("Maximum 6 scopes allowed.");

  try {
    const txValue = BigInt(params.maxTransactionValue);
    if (txValue <= BigInt(0)) errors.push("Max transaction value must be positive.");
  } catch {
    errors.push("Invalid max transaction value.");
  }

  try {
    const dailyValue = BigInt(params.maxDailyValue);
    if (dailyValue <= BigInt(0)) errors.push("Max daily value must be positive.");
  } catch {
    errors.push("Invalid max daily value.");
  }

  return { valid: errors.length === 0, errors };
}
