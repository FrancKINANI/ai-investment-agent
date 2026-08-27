import { describe, expect, it } from "vitest";
import { activateMandate, createMandate, listMandateTransactions, revokeMandate, validateMandateParams } from "./sailorService";

describe("sailor mandate validation", () => {
  it("accepts valid mandate parameters", () => {
    const result = validateMandateParams({
      scopes: ["swap"],
      maxTransactionValue: "1000000000000000000", // 1 ETH
      maxDailyValue: "5000000000000000000", // 5 ETH
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects empty scopes", () => {
    const result = validateMandateParams({
      scopes: [],
      maxTransactionValue: "1000000000000000000",
      maxDailyValue: "5000000000000000000",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("At least one scope is required.");
  });

  it("rejects more than 6 scopes", () => {
    const result = validateMandateParams({
      scopes: ["swap", "add_liquidity", "remove_liquidity", "stake", "claim", "transfer", "swap"],
      maxTransactionValue: "1000000000000000000",
      maxDailyValue: "5000000000000000000",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Maximum 6 scopes allowed.");
  });

  it("rejects invalid max transaction value", () => {
    const result = validateMandateParams({
      scopes: ["swap"],
      maxTransactionValue: "not-a-number",
      maxDailyValue: "5000000000000000000",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid max transaction value.");
  });

  it("rejects invalid max daily value", () => {
    const result = validateMandateParams({
      scopes: ["swap"],
      maxTransactionValue: "1000000000000000000",
      maxDailyValue: "invalid",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid max daily value.");
  });

  it("rejects zero max transaction value", () => {
    const result = validateMandateParams({
      scopes: ["swap"],
      maxTransactionValue: "0",
      maxDailyValue: "5000000000000000000",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Max transaction value must be positive.");
  });

  it("collects multiple errors", () => {
    const result = validateMandateParams({
      scopes: [],
      maxTransactionValue: "abc",
      maxDailyValue: "xyz",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("sailor mandate safety contracts", () => {
  it("every mandate requires at least one scope", () => {
    expect(validateMandateParams({ scopes: [], maxTransactionValue: "1", maxDailyValue: "1" }).valid).toBe(false);
  });

  it("mandate caps are always positive integers", () => {
    expect(validateMandateParams({ scopes: ["swap"], maxTransactionValue: "-1", maxDailyValue: "1" }).valid).toBe(false);
    expect(validateMandateParams({ scopes: ["swap"], maxTransactionValue: "1", maxDailyValue: "0" }).valid).toBe(false);
  });

  it("scope count is bounded to prevent over-authority", () => {
    const tooMany = Array(7).fill("swap") as ["swap", "swap", "swap", "swap", "swap", "swap", "swap"];
    expect(validateMandateParams({ scopes: tooMany, maxTransactionValue: "1", maxDailyValue: "1" }).valid).toBe(false);
  });
});

describe("sailor mandate owner isolation", () => {
  it("does not reveal or mutate another owner’s mandate", async () => {
    const mandate = await createMandate(101, {
      ownerAddress: "0x1111111111111111111111111111111111111111",
      chainId: 1,
      scopes: ["swap"],
      maxTransactionValue: "1",
      maxDailyValue: "1",
    });

    await expect(activateMandate(202, mandate.mandateId, "0x2222222222222222222222222222222222222222")).rejects.toThrow("Mandate not found.");
    await expect(revokeMandate(202, mandate.mandateId)).rejects.toThrow("Mandate not found.");
    expect(() => listMandateTransactions(202, mandate.mandateId)).toThrow("Mandate not found.");
  });
});
