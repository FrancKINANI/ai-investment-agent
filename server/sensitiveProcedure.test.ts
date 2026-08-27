import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  changeAuthorityState: vi.fn(),
  getAuthorityState: vi.fn(),
}));

vi.mock("./db", () => db);

import { authorityRouter } from "./authorityRouter";
import type { TrpcContext } from "./_core/context";

function context(headers: Record<string, string>): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "owner-7",
      name: "Owner",
      email: null,
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("sensitive tRPC mutation boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.changeAuthorityState.mockResolvedValue({ ok: true, state: "paused" });
  });

  it("rejects a cross-origin authority mutation before persistence", async () => {
    const caller = authorityRouter.createCaller(context({ host: "ledgerline.example", origin: "https://attacker.example" }));
    await expect(caller.transition({ to: "paused", initiatedBy: "owner", reason: "Pause from untrusted origin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.changeAuthorityState).not.toHaveBeenCalled();
  });

  it("allows a same-origin authority mutation through the sensitive boundary", async () => {
    const caller = authorityRouter.createCaller(context({ host: "ledgerline.example", origin: "https://ledgerline.example" }));
    await expect(caller.transition({ to: "paused", initiatedBy: "owner", reason: "Pause from the trusted console" })).resolves.toMatchObject({ ok: true });
    expect(db.changeAuthorityState).toHaveBeenCalledWith(7, "paused", "owner", "Pause from the trusted console");
  });
});
