import { afterEach, describe, expect, it } from "vitest";
import { isMissingPostgresRelation, requirePostgresDatabaseUrl } from "./postgresConnection";

describe("PostgreSQL connection guard", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalPostgresUrl = process.env.POSTGRES_DATABASE_URL;

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalPostgresUrl === undefined) delete process.env.POSTGRES_DATABASE_URL;
    else process.env.POSTGRES_DATABASE_URL = originalPostgresUrl;
  });

  it("requires an explicit dedicated PostgreSQL URL", () => {
    delete process.env.POSTGRES_DATABASE_URL;
    process.env.DATABASE_URL = "mysql://production.example/ledgerline";
    expect(() => requirePostgresDatabaseUrl()).toThrow("POSTGRES_DATABASE_URL is required");
  });

  it("rejects reuse of the active database URL", () => {
    process.env.POSTGRES_DATABASE_URL = "postgresql://shared.example/ledgerline";
    process.env.DATABASE_URL = process.env.POSTGRES_DATABASE_URL;
    expect(() => requirePostgresDatabaseUrl()).toThrow("must not reuse DATABASE_URL");
  });

  it("accepts a distinct PostgreSQL URL", () => {
    process.env.POSTGRES_DATABASE_URL = "postgresql://staging.example/ledgerline";
    process.env.DATABASE_URL = "mysql://production.example/ledgerline";
    expect(requirePostgresDatabaseUrl()).toBe(process.env.POSTGRES_DATABASE_URL);
  });
});

describe("PostgreSQL relation error classification", () => {
  it("only treats relation-not-found errors as missing tables", () => {
    expect(isMissingPostgresRelation({ code: "42P01" })).toBe(true);
    expect(isMissingPostgresRelation({ message: 'relation "securityAlerts" does not exist' })).toBe(true);
    expect(isMissingPostgresRelation({ code: "28P01", message: "authentication failed" })).toBe(false);
    expect(isMissingPostgresRelation(new Error("connection refused"))).toBe(false);
  });
});
