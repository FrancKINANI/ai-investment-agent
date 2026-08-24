import { describe, expect, it } from "vitest";
import { nextPromotionStage, outcomeStatus } from "./workflow";

describe("v0.2 operator workflow interactions", () => {
  it("moves an approved research candidate to simulation, not execution", () => {
    expect(nextPromotionStage("research", "pass")).toEqual({ next: "simulation", action: "simulation" });
  });

  it("holds a simulation candidate when the hard gate is in review", () => {
    expect(nextPromotionStage("simulation", "review")).toEqual({ next: "simulation", action: "hold" });
  });

  it("allows only a passing simulation candidate into decision review", () => {
    expect(nextPromotionStage("simulation", "pass")).toEqual({ next: "decision", action: "decision" });
  });

  it("classifies an interim outcome against its declared expectation", () => {
    expect(outcomeStatus(430, 310)).toBe("underperforming");
  });
});
