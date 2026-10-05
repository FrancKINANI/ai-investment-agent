import { defineConfig } from "drizzle-kit";
import { requirePostgresDatabaseUrl } from "./server/postgresConnection";

const connectionString = requirePostgresDatabaseUrl();

export default defineConfig({
  schema: "./drizzle/schema.postgres.ts",
  out: "./drizzle/postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
