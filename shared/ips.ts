import { z } from "zod";

export const ethereumAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Use full Ethereum token contract addresses.");

export const investmentPolicySchema = z.object({
  name: z.string().trim().min(2).max(120),
  maxConcentrationBps: z.number().int().min(1).max(10_000),
  minReserveBps: z.number().int().min(0).max(10_000),
  maxTransactionBps: z.number().int().min(1).max(10_000),
  dailyMandateBps: z.number().int().min(1).max(10_000),
  allowedAssets: z.array(ethereumAddressSchema).min(1).max(20),
}).superRefine((values, ctx) => {
  if (values.maxTransactionBps > values.dailyMandateBps) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxTransactionBps"], message: "A single transaction limit cannot exceed the daily mandate." });
  }
  if (values.maxConcentrationBps + values.minReserveBps > 10_000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["minReserveBps"], message: "Concentration plus reserve limits cannot exceed 100%." });
  }
});

export type InvestmentPolicyInput = z.infer<typeof investmentPolicySchema>;

export function normalizeInvestmentPolicy(input: InvestmentPolicyInput): InvestmentPolicyInput {
  return {
    ...input,
    name: input.name.trim(),
    allowedAssets: Array.from(new Set(input.allowedAssets.map((asset) => asset.toLowerCase()))),
  };
}
