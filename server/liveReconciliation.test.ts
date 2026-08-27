import { describe, expect, it, vi } from "vitest";

vi.mock("./binance", () => ({ getOpenOrders: vi.fn(), getTradeHistory: vi.fn() }));

import { getOpenOrders, getTradeHistory } from "./binance";
import { reconcileLiveOrder } from "./liveReconciliation";

describe("sealed live reconciliation seam", () => {
  it("returns an explicit sealed result without querying Binance", async () => {
    await expect(reconcileLiveOrder()).resolves.toEqual({
      state: "sealed",
      reason: "Live venue reconciliation is not active while venue mutations are sealed.",
    });
    expect(getOpenOrders).not.toHaveBeenCalled();
    expect(getTradeHistory).not.toHaveBeenCalled();
  });
});
