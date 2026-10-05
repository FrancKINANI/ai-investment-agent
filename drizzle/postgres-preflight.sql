-- Run this once on the dedicated PostgreSQL staging database before applying
-- drizzle/postgres/0000_cool_gorilla_man.sql. Never run it against DATABASE_URL.
-- Managed providers may require an administrator to enable vector.

CREATE EXTENSION IF NOT EXISTS vector;
