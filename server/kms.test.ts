import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { encrypt, decrypt, encryptSecret, decryptSecret, maskApiKey, verifySecret } from "./kms";

describe("KMS AES-256-GCM encryption", () => {
  it("encrypts and decrypts a string round-trip", () => {
    const secret = "my-super-secret-api-key-12345";
    const encrypted = encrypt(secret);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(secret);
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const secret = "same-secret";
    const a = encrypt(secret);
    const b = encrypt(secret);
    expect(a).not.toBe(b); // Different IVs → different ciphertext
    expect(decrypt(a)).toBe(secret);
    expect(decrypt(b)).toBe(secret);
  });

  it("encryptSecret and decryptSecret are symmetric", () => {
    const secret = "binance-api-secret-abcdef";
    const encrypted = encryptSecret(secret);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("rejects decryption with corrupted data", () => {
    expect(() => decrypt("not-valid-base64-data")).toThrow();
  });

  it("rejects decryption with tampered auth tag", () => {
    const encrypted = encrypt("test-data");
    const buf = Buffer.from(encrypted, "base64");
    // Tamper with the auth tag (bytes 12-28)
    buf[14] ^= 0xff;
    expect(() => decrypt(buf.toString("base64"))).toThrow("Decryption failed");
  });

  it("handles empty strings", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("handles long strings", () => {
    const secret = "x".repeat(10_000);
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("handles special characters", () => {
    const secret = "key-with-special-chars: !@#$%^&*()_+{}|:\"<>?`~";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("handles unicode", () => {
    const secret = "clé-secrète-🔒";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });
});

describe("maskApiKey", () => {
  it("masks a long key with first 4 + **** + last 4", () => {
    expect(maskApiKey("abcdefghijklmnop")).toBe("abcd****mnop");
  });

  it("masks a short key as ****", () => {
    expect(maskApiKey("short")).toBe("****");
  });

  it("masks an 8-char key as ****", () => {
    expect(maskApiKey("12345678")).toBe("****");
  });

  it("masks a 9-char key correctly", () => {
    expect(maskApiKey("123456789")).toBe("1234****6789");
  });
});

describe("verifySecret", () => {
  it("returns true for valid encrypted data", () => {
    const encrypted = encrypt("valid-secret");
    expect(verifySecret(encrypted)).toBe(true);
  });

  it("returns false for invalid data", () => {
    expect(verifySecret("garbage-data")).toBe(false);
  });

  it("returns false for tampered data", () => {
    const encrypted = encrypt("test");
    const buf = Buffer.from(encrypted, "base64");
    buf[0] ^= 0xff;
    expect(verifySecret(buf.toString("base64"))).toBe(false);
  });
});

describe("KMS security contracts", () => {
  it("encrypted output is not the plaintext", () => {
    const secret = "super-secret-key";
    const encrypted = encrypt(secret);
    expect(encrypted).not.toContain(secret);
    expect(encrypted).not.toBe(secret);
  });

  it("different keys produce different encrypted outputs", () => {
    const a = encrypt("key-alpha");
    const b = encrypt("key-beta");
    expect(a).not.toBe(b);
  });

  it("decryption fails with wrong data length", () => {
    // Too short to contain IV + auth tag + ciphertext
    expect(() => decrypt(Buffer.alloc(10).toString("base64"))).toThrow();
  });
});

describe("LL-SEC-002: KMS fallback blocking", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save env vars we'll modify
    savedEnv.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    savedEnv.NODE_ENV = process.env.NODE_ENV;
    savedEnv.ALLOW_DEV_KMS_FALLBACK = process.env.ALLOW_DEV_KMS_FALLBACK;
  });

  afterAll(() => {
    // Restore env vars
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("blocks fallback when NODE_ENV=staging", async () => {
    process.env.NODE_ENV = "staging";
    delete process.env.ENCRYPTION_KEY;
    delete process.env.ALLOW_DEV_KMS_FALLBACK;
    // Dynamic import to pick up env changes
    const mod = await import("./kms");
    expect(() => mod.encrypt("test")).toThrow("ENCRYPTION_KEY is required");
  });

  it("blocks fallback when NODE_ENV=production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ENCRYPTION_KEY;
    delete process.env.ALLOW_DEV_KMS_FALLBACK;
    const mod = await import("./kms");
    expect(() => mod.encrypt("test")).toThrow("ENCRYPTION_KEY is required");
  });

  it("blocks fallback when NODE_ENV=development without opt-in", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.ENCRYPTION_KEY;
    delete process.env.ALLOW_DEV_KMS_FALLBACK;
    const mod = await import("./kms");
    expect(() => mod.encrypt("test")).toThrow("ALLOW_DEV_KMS_FALLBACK");
  });

  it("allows fallback when NODE_ENV=development with opt-in", async () => {
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_KMS_FALLBACK = "true";
    delete process.env.ENCRYPTION_KEY;
    const mod = await import("./kms");
    const secret = "dev-secret";
    const encrypted = mod.encrypt(secret);
    expect(mod.decrypt(encrypted)).toBe(secret);
  });
});
