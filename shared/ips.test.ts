import { describe, expect, it } from "vitest";
import { investmentPolicySchema, normalizeInvestmentPolicy } from "./ips";

const validPolicy = {
  name: "Core research mandate",
  maxConcentrationBps: 3_500,
  minReserveBps: 2_500,
  maxTransactionBps: 500,
  dailyMandateBps: 1_000,
  allowedAssets: ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"],
};

describe("investmentPolicySchema", () => {
  it("accepts a bounded simulation policy", () => {
    expect(investmentPolicySchema.parse(validPolicy)).toMatchObject(validPolicy);
  });

  it("rejects a single transaction that exceeds the daily mandate", () => {
    const result = investmentPolicySchema.safeParse({ ...validPolicy, maxTransactionBps: 1_500 });
    expect(result.success).toBe(false);
  });

  it("rejects an impossible concentration and reserve combination", () => {
    const result = investmentPolicySchema.safeParse({ ...validPolicy, maxConcentrationBps: 8_000, minReserveBps: 3_000 });
    expect(result.success).toBe(false);
  });

  it("normalizes and de-duplicates owner-supplied contract addresses", () => {
    const parsed = investmentPolicySchema.parse({ ...validPolicy, allowedAssets: [validPolicy.allowedAssets[0], validPolicy.allowedAssets[0].toLowerCase()] });
    expect(normalizeInvestmentPolicy(parsed).allowedAssets).toEqual([validPolicy.allowedAssets[0].toLowerCase()]);
  });
});
