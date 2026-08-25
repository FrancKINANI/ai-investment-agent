/**
 * Key Management Service (KMS) — AES-256-GCM encryption for API secrets.
 *
 * Security design:
 * - Master key derived from ENCRYPTION_KEY env var (32 bytes hex)
 * - Each secret gets a unique 12-byte IV per encryption
 * - Auth tag provides integrity verification
 * - Format: base64(iv + authTag + ciphertext)
 *
 * ponytail: For production, replace with a cloud KMS (AWS KMS, GCP KMS, HashiCorp Vault).
 * The built-in AES-256-GCM is cryptographically sound but the master key lives in env vars.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// ─── Master Key ───────────────────────────────────────────────────────────

function getMasterKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    // ponytail: development fallback — NOT for production
    // In dev, derive a key from a fixed passphrase. In prod, this must be a real key.
    console.warn("[KMS] No ENCRYPTION_KEY set. Using development fallback. DO NOT use in production.");
    return scryptSync("ledgerline-dev-fallback-key-do-not-use-in-prod", "ledgerline-salt", KEY_LENGTH);
  }

  // Accept hex-encoded key (64 hex chars = 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  // Or derive from passphrase via scrypt
  return scryptSync(raw, "ledgerline-kms-salt", KEY_LENGTH);
}

// ─── Encrypt ──────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns base64-encoded (iv + authTag + ciphertext).
 */
export function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: iv (12) + authTag (16) + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString("base64");
}

// ─── Decrypt ──────────────────────────────────────────────────────────────

/**
 * Decrypt a base64-encoded (iv + authTag + ciphertext) string.
 */
export function decrypt(encoded: string): string {
  const key = getMasterKey();
  const packed = Buffer.from(encoded, "base64");

  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted data: too short.");
  }

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error("Decryption failed: invalid key or corrupted data.");
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Encrypt an API secret for storage in platformApiKeys.secretEncrypted.
 */
export function encryptSecret(secret: string): string {
  return encrypt(secret);
}

/**
 * Decrypt an API secret from platformApiKeys.secretEncrypted.
 */
export function decryptSecret(encrypted: string): string {
  return decrypt(encrypted);
}

/**
 * Mask an API key for display: first 4 + **** + last 4.
 */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

/**
 * Verify that a key can be decrypted (integrity check).
 */
export function verifySecret(encrypted: string): boolean {
  try {
    decrypt(encrypted);
    return true;
  } catch {
    return false;
  }
}
