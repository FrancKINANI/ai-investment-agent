import { describe, expect, it, vi } from "vitest";
import { readSecurityAlertsOrFallback } from "./db";

describe("security alert schema fallback", () => {
  it("returns the explicit empty fallback when the securityAlerts table is absent", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      readSecurityAlertsOrFallback(
        async () => Promise.reject({ cause: { code: "ER_NO_SUCH_TABLE" } }),
        [],
      ),
    ).resolves.toEqual([]);

    expect(warning).toHaveBeenCalledWith(
      "[Security alerts] Alert table is unavailable; returning an empty owner-scoped result.",
    );
    warning.mockRestore();
  });

  it("does not hide database failures unrelated to the absent alert table", async () => {
    const failure = { cause: { code: "ER_ACCESS_DENIED_ERROR" } };

    await expect(
      readSecurityAlertsOrFallback(async () => Promise.reject(failure), []),
    ).rejects.toBe(failure);
  });
});
