const POSTGRES_DATABASE_URL = "POSTGRES_DATABASE_URL";

/**
 * PostgreSQL must use an explicitly dedicated database URL. The production
 * DATABASE_URL is intentionally never used as a fallback for this path.
 */
export function requirePostgresDatabaseUrl(): string {
  const postgresUrl = process.env[POSTGRES_DATABASE_URL]?.trim();
  if (!postgresUrl) {
    throw new Error(`${POSTGRES_DATABASE_URL} is required for PostgreSQL operations`);
  }

  if (!/^postgres(?:ql)?:\/\//i.test(postgresUrl)) {
    throw new Error(`${POSTGRES_DATABASE_URL} must be a PostgreSQL connection URL`);
  }

  const primaryUrl = process.env.DATABASE_URL?.trim();
  if (primaryUrl && postgresUrl === primaryUrl) {
    throw new Error(`${POSTGRES_DATABASE_URL} must not reuse DATABASE_URL`);
  }

  return postgresUrl;
}

/** Only relation-not-found errors are safe to treat as an absent optional table. */
export function isMissingPostgresRelation(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null;
  if (!candidate) return false;
  if (candidate.code === "42P01") return true;
  return /relation [^\n]+ does not exist/i.test(candidate.message ?? "");
}
