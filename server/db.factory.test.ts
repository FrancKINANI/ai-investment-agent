import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the adapters before importing the factory
const mockMysqlAdapter = {
  driver: "mysql" as const,
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
};

const mockPostgresAdapter = {
  driver: "postgresql" as const,
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
};

class MockMysqlAdapter {
  driver = "mysql" as const;
  upsertUser = vi.fn();
  getUserByOpenId = vi.fn();
}

class MockPostgresAdapter {
  driver = "postgresql" as const;
  upsertUser = vi.fn();
  getUserByOpenId = vi.fn();
}

vi.mock("./adapters/mysql.adapter", () => ({
  MysqlAdapter: MockMysqlAdapter,
}));

vi.mock("./adapters/postgres.adapter", () => ({
  PostgresAdapter: MockPostgresAdapter,
}));

import { getDatabaseAdapter, resetDatabaseAdapter } from "./db.factory";

describe("DatabaseAdapterFactory", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    resetDatabaseAdapter();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns MySQL adapter by default", async () => {
    delete process.env.DATABASE_DRIVER;
    const adapter = await getDatabaseAdapter();
    expect(adapter.driver).toBe("mysql");
  });

  it("returns MySQL adapter when DATABASE_DRIVER=mysql", async () => {
    process.env.DATABASE_DRIVER = "mysql";
    const adapter = await getDatabaseAdapter();
    expect(adapter.driver).toBe("mysql");
  });

  it("returns PostgreSQL adapter when DATABASE_DRIVER=postgresql", async () => {
    process.env.DATABASE_DRIVER = "postgresql";
    const adapter = await getDatabaseAdapter();
    expect(adapter.driver).toBe("postgresql");
  });

  it("caches adapter instance", async () => {
    process.env.DATABASE_DRIVER = "mysql";
    const adapter1 = await getDatabaseAdapter();
    const adapter2 = await getDatabaseAdapter();
    expect(adapter1).toBe(adapter2);
  });

  it("resets adapter instance", async () => {
    process.env.DATABASE_DRIVER = "mysql";
    const adapter1 = await getDatabaseAdapter();
    resetDatabaseAdapter();
    const adapter2 = await getDatabaseAdapter();
    expect(adapter1).not.toBe(adapter2);
  });
});
