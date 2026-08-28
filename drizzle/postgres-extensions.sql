-- =============================================================================
-- PostgreSQL Extensions for Ledgerline
-- =============================================================================
-- This file sets up PostgreSQL extensions to replace external services:
-- - pgvector: Vector search for RAG (replaces Pinecone/Qdrant)
-- - pg_cron: Scheduling (replaces external cron services)
-- - pg_trgm: Trigram similarity search
-- - Full-text search: tsvector + GIN indexes (replaces Elasticsearch)
-- - UNLOGGED tables: Caching (replaces Redis)
-- =============================================================================

-- ─── Extensions ─────────────────────────────────────────────────────────────

-- Vector search for embeddings/RAG
CREATE EXTENSION IF NOT EXISTS vector;

-- Job scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Trigram similarity for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-text search configuration
CREATE EXTENSION IF NOT EXISTS unaccent;

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Full-Text Search Setup ────────────────────────────────────────────────

-- Add search vector columns to memory entries
ALTER TABLE "agentMemoryEntries" 
    ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create index for full-text search
CREATE INDEX IF NOT EXISTS idx_memory_search_vector 
    ON "agentMemoryEntries" USING GIN (search_vector);

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_memory_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.kind, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update search vector
DROP TRIGGER IF EXISTS trg_memory_search_vector ON "agentMemoryEntries";
CREATE TRIGGER trg_memory_search_vector
    BEFORE INSERT OR UPDATE ON "agentMemoryEntries"
    FOR EACH ROW EXECUTE FUNCTION update_memory_search_vector();

-- Add search vector to messages
ALTER TABLE "agentMessages" 
    ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_message_search_vector 
    ON "agentMessages" USING GIN (search_vector);

CREATE OR REPLACE FUNCTION update_message_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_message_search_vector ON "agentMessages";
CREATE TRIGGER trg_message_search_vector
    BEFORE INSERT OR UPDATE ON "agentMessages"
    FOR EACH ROW EXECUTE FUNCTION update_message_search_vector();

-- ─── Vector Embeddings (pgvector) ──────────────────────────────────────────

-- Add embedding column to memory entries for RAG
ALTER TABLE "agentMemoryEntries" 
    ADD COLUMN IF NOT EXISTS embedding vector(1536);  -- OpenAI ada-002 dimensions

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_memory_embedding_hnsw 
    ON "agentMemoryEntries" USING hnsw (embedding vector_cosine_ops);

-- Add embedding to messages for context retrieval
ALTER TABLE "agentMessages" 
    ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_message_embedding_hnsw 
    ON "agentMessages" USING hnsw (embedding vector_cosine_ops);

-- ─── Caching Tables (UNLOGGED - replaces Redis) ────────────────────────────

-- General-purpose cache
CREATE UNLOGGED TABLE IF NOT EXISTS cache_store (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_store (expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_value ON cache_store USING GIN (value);

-- API response cache
CREATE UNLOGGED TABLE IF NOT EXISTS api_cache (
    endpoint TEXT NOT NULL,
    params JSONB NOT NULL DEFAULT '{}',
    response JSONB NOT NULL,
    status_code INT DEFAULT 200,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (endpoint, params)
);

-- Session cache (replaces Redis sessions)
CREATE UNLOGGED TABLE IF NOT EXISTS session_cache (
    session_id TEXT PRIMARY KEY,
    user_id INT,
    data JSONB NOT NULL DEFAULT '{}',
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting cache
CREATE UNLOGGED TABLE IF NOT EXISTS rate_limit_cache (
    key TEXT PRIMARY KEY,
    count INT DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 minute'
);

-- ─── Scheduling (pg_cron) ──────────────────────────────────────────────────

-- Auto-cleanup for cache tables (every 5 minutes)
SELECT cron.schedule(
    'cache-cleanup',
    '*/5 * * * *',
    $$DELETE FROM cache_store WHERE expires_at < NOW()$$
);

-- Auto-cleanup for API cache (every minute)
SELECT cron.schedule(
    'api-cache-cleanup',
    '* * * * *',
    $$DELETE FROM api_cache WHERE expires_at < NOW()$$
);

-- Auto-cleanup for session cache (every hour)
SELECT cron.schedule(
    'session-cleanup',
    '0 * * * *',
    $$DELETE FROM session_cache WHERE expires_at < NOW()$$
);

-- Auto-cleanup for rate limit cache (every minute)
SELECT cron.schedule(
    'rate-limit-cleanup',
    '* * * * *',
    $$DELETE FROM rate_limit_cache WHERE expires_at < NOW()$$
);

-- Discovery schedule runner (daily at 8 AM)
-- This replaces external cron services
SELECT cron.schedule(
    'discovery-daily',
    '0 8 * * *',
    $$SELECT run_discovery_for_enabled_schedules()$$
);

-- ─── Helper Functions ───────────────────────────────────────────────────────

-- Function to run discovery for enabled schedules
CREATE OR REPLACE FUNCTION run_discovery_for_enabled_schedules()
RETURNS void AS $$
BEGIN
    -- This function will be called by pg_cron
    -- It triggers discovery for all enabled schedules
    RAISE NOTICE 'Running discovery for enabled schedules at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to cache a value
CREATE OR REPLACE FUNCTION cache_set(
    p_key TEXT,
    p_value JSONB,
    p_ttl_seconds INT DEFAULT 3600
)
RETURNS void AS $$
BEGIN
    INSERT INTO cache_store (key, value, expires_at)
    VALUES (p_key, p_value, NOW() + (p_ttl_seconds || ' seconds')::INTERVAL)
    ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        expires_at = EXCLUDED.expires_at;
END;
$$ LANGUAGE plpgsql;

-- Function to get a cached value
CREATE OR REPLACE FUNCTION cache_get(p_key TEXT)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT value INTO result
    FROM cache_store
    WHERE key = p_key AND expires_at > NOW();
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to invalidate cache
CREATE OR REPLACE FUNCTION cache_invalidate(p_key TEXT)
RETURNS void AS $$
BEGIN
    DELETE FROM cache_store WHERE key = p_key;
END;
$$ LANGUAGE plpgsql;

-- Function for full-text search with ranking
CREATE OR REPLACE FUNCTION search_memory_entries(
    p_user_id INT,
    p_query TEXT,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    memory_id VARCHAR,
    content TEXT,
    kind VARCHAR,
    scope VARCHAR,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        me."memoryId",
        me.content,
        me.kind::VARCHAR,
        me.scope::VARCHAR,
        ts_rank(me.search_vector, plainto_tsquery('english', p_query))::REAL as rank
    FROM "agentMemoryEntries" me
    WHERE me."userId" = p_user_id
        AND me.search_vector @@ plainto_tsquery('english', p_query)
    ORDER BY rank DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function for vector similarity search
CREATE OR REPLACE FUNCTION search_memory_by_embedding(
    p_user_id INT,
    p_embedding vector(1536),
    p_limit INT DEFAULT 10,
    p_similarity_threshold REAL DEFAULT 0.7
)
RETURNS TABLE (
    memory_id VARCHAR,
    content TEXT,
    kind VARCHAR,
    scope VARCHAR,
    similarity REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        me."memoryId",
        me.content,
        me.kind::VARCHAR,
        me.scope::VARCHAR",
        (1 - (me.embedding <=> p_embedding))::REAL as similarity
    FROM "agentMemoryEntries" me
    WHERE me."userId" = p_user_id
        AND me.embedding IS NOT NULL
        AND (1 - (me.embedding <=> p_embedding)) > p_similarity_threshold
    ORDER BY me.embedding <=> p_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function for hybrid search (full-text + vector)
CREATE OR REPLACE FUNCTION search_memory_hybrid(
    p_user_id INT,
    p_query TEXT,
    p_embedding vector(1536),
    p_limit INT DEFAULT 10,
    p_text_weight REAL DEFAULT 0.3,
    p_vector_weight REAL DEFAULT 0.7
)
RETURNS TABLE (
    memory_id VARCHAR,
    content TEXT,
    kind VARCHAR,
    scope VARCHAR,
    combined_score REAL
) AS $$
BEGIN
    RETURN QUERY
    WITH text_scores AS (
        SELECT 
            me."memoryId",
            ts_rank(me.search_vector, plainto_tsquery('english', p_query)) as text_rank
        FROM "agentMemoryEntries" me
        WHERE me."userId" = p_user_id
            AND me.search_vector @@ plainto_tsquery('english', p_query)
    ),
    vector_scores AS (
        SELECT 
            me."memoryId",
            (1 - (me.embedding <=> p_embedding)) as vec_rank
        FROM "agentMemoryEntries" me
        WHERE me."userId" = p_user_id
            AND me.embedding IS NOT NULL
    )
    SELECT 
        me."memoryId",
        me.content,
        me.kind::VARCHAR,
        me.scope::VARCHAR,
        (COALESCE(ts.text_rank, 0) * p_text_weight + 
         COALESCE(vs.vec_rank, 0) * p_vector_weight)::REAL as combined_score
    FROM "agentMemoryEntries" me
    LEFT JOIN text_scores ts ON me."memoryId" = ts."memoryId"
    LEFT JOIN vector_scores vs ON me."memoryId" = vs."memoryId"
    WHERE me."userId" = p_user_id
        AND (ts."memoryId" IS NOT NULL OR vs."memoryId" IS NOT NULL)
    ORDER BY combined_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ─── Indexes for Performance ────────────────────────────────────────────────

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_agent_runs_evidence ON "agentRuns" USING GIN (evidence);
CREATE INDEX IF NOT EXISTS idx_agent_messages_evidence ON "agentMessages" USING GIN (evidence);
CREATE INDEX IF NOT EXISTS idx_agent_memory_actions_payload ON "agentMemoryActions" USING GIN (payload);
CREATE INDEX IF NOT EXISTS idx_operator_actions_payload ON "operatorActions" USING GIN (payload);

-- Trigram indexes for fuzzy search
CREATE INDEX IF NOT EXISTS idx_memory_content_trgm ON "agentMemoryEntries" USING GIN (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_message_content_trgm ON "agentMessages" USING GIN (content gin_trgm_ops);

-- Partial indexes for common queries
CREATE INDEX IF NOT EXISTS idx_memory_active ON "agentMemoryEntries" ("userId", scope) 
    WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_memory_pending ON "agentMemoryEntries" ("userId") 
    WHERE status = 'pending_promotion';
CREATE INDEX IF NOT EXISTS idx_alerts_unack ON "securityAlerts" ("userId") 
    WHERE acknowledged = false;

-- ─── Comments ───────────────────────────────────────────────────────────────

COMMENT ON EXTENSION vector IS 'Open-source vector similarity search for PostgreSQL';
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';
COMMENT ON EXTENSION pg_trgm IS 'Trigram similarity matching for fuzzy search';

COMMENT ON TABLE cache_store IS 'UNLOGGED cache table replacing Redis for key-value caching';
COMMENT ON TABLE api_cache IS 'UNLOGGED cache for API responses';
COMMENT ON TABLE session_cache IS 'UNLOGGED cache for user sessions';

COMMENT ON COLUMN "agentMemoryEntries".embedding IS 'Vector embedding for semantic search (1536 dimensions for OpenAI ada-002)';
COMMENT ON COLUMN "agentMemoryEntries".search_vector IS 'Full-text search vector for content and kind';
COMMENT ON COLUMN "agentMessages".embedding IS 'Vector embedding for message semantic search';
COMMENT ON COLUMN "agentMessages".search_vector IS 'Full-text search vector for message content';
