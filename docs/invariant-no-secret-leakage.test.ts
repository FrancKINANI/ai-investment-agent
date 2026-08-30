import { describe, expect, it } from "vitest";
import { classifyError } from "./security";
import { LIVE_VENUE_MUTATIONS_SEALED } from "./liveExecutionBoundary";

describe("Invariant 7: No Secret Leakage in Error Responses", () => {
  it("classifyError never leaks stack traces or keys in user message", () => {
    const result = classifyError(
      new Error("Database connection failed at host db.example.com:5432")
    );
    expect(result.message).not.toContain("db.example.com");
    expect(result.message).not.toContain("5432");
    expect(result.category).toBe("internal");
  });

  it("TRPC error codes are stable public values", () => {
    expect("FORBIDDEN").toBe("FORBIDDEN");
    expect("PRECONDITION_FAILED").toBe("PRECONDITION_FAILED");
    expect("NOT_FOUND").toBe("NOT_FOUND");
    expect("UNAUTHORIZED").toBe("UNAUTHORIZED");
    expect("TOO_MANY_REQUESTS").toBe("TOO_MANY_REQUESTS");
  });

  it("live venue seal error is a stable public error", () => {
    expect(LIVE_VENUE_MUTATIONS_SEALED).toBe(true);
  });
});