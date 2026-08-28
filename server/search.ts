/**
 * PostgreSQL Search Service
 * 
 * Provides full-text search and vector similarity search for memory entries.
 * Replaces Elasticsearch for text search and Pinecone for vector search.
 * 
 * Features:
 * - Full-text search with tsvector + GIN indexes
 * - Vector similarity search with pgvector
 * - Hybrid search combining text and vector scores
 * - Trigram similarity for fuzzy matching
 */

import { sql } from "drizzle-orm";

// ─── Search Interfaces ──────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  content: string;
  kind: string;
  scope: string;
  score: number;
  highlight?: string;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  minScore?: number;
  kinds?: string[];
  scopes?: string[];
}

export interface VectorSearchOptions extends SearchOptions {
  similarityThreshold?: number;
}

export interface HybridSearchOptions extends SearchOptions {
  textWeight?: number;
  vectorWeight?: number;
}

// ─── Search Service ─────────────────────────────────────────────────────────

export class PostgresSearch {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Full-text search for memory entries
   */
  async searchText(
    userId: number,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { limit = 20, offset = 0, minScore = 0.1, kinds, scopes } = options;
    
    let whereClause = sql`
      me."userId" = ${userId}
        AND me.search_vector @@ plainto_tsquery('english', ${query})
        AND ts_rank(me.search_vector, plainto_tsquery('english', ${query})) > ${minScore}
    `;
    
    if (kinds && kinds.length > 0) {
      whereClause = sql`${whereClause} AND me.kind = ANY(${kinds})`;
    }
    
    if (scopes && scopes.length > 0) {
      whereClause = sql`${whereClause} AND me.scope = ANY(${scopes})`;
    }
    
    const result = await this.db.execute(sql`
      SELECT 
        me."memoryId" as id,
        me.content,
        me.kind,
        me.scope,
        ts_rank(me.search_vector, plainto_tsquery('english', ${query})) as score,
        ts_headline('english', me.content, plainto_tsquery('english', ${query}), 
          'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20') as highlight
      FROM "agentMemoryEntries" me
      WHERE ${whereClause}
      ORDER BY score DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    
    return result.rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      kind: row.kind,
      scope: row.scope,
      score: parseFloat(row.score),
      highlight: row.highlight,
    }));
  }

  /**
   * Vector similarity search for memory entries
   */
  async searchVector(
    userId: number,
    embedding: number[],
    options: VectorSearchOptions = {}
  ): Promise<SearchResult[]> {
    const { limit = 10, offset = 0, similarityThreshold = 0.7, kinds, scopes } = options;
    
    let whereClause = sql`
      me."userId" = ${userId}
        AND me.embedding IS NOT NULL
        AND (1 - (me.embedding <=> ${JSON.stringify(embedding)}::vector)) > ${similarityThreshold}
    `;
    
    if (kinds && kinds.length > 0) {
      whereClause = sql`${whereClause} AND me.kind = ANY(${kinds})`;
    }
    
    if (scopes && scopes.length > 0) {
      whereClause = sql`${whereClause} AND me.scope = ANY(${scopes})`;
    }
    
    const result = await this.db.execute(sql`
      SELECT 
        me."memoryId" as id,
        me.content,
        me.kind,
        me.scope,
        (1 - (me.embedding <=> ${JSON.stringify(embedding)}::vector)) as score
      FROM "agentMemoryEntries" me
      WHERE ${whereClause}
      ORDER BY me.embedding <=> ${JSON.stringify(embedding)}::vector
      LIMIT ${limit} OFFSET ${offset}
    `);
    
    return result.rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      kind: row.kind,
      scope: row.scope,
      score: parseFloat(row.score),
    }));
  }

  /**
   * Hybrid search combining full-text and vector search
   */
  async searchHybrid(
    userId: number,
    query: string,
    embedding: number[],
    options: HybridSearchOptions = {}
  ): Promise<SearchResult[]> {
    const { limit = 10, offset = 0, textWeight = 0.3, vectorWeight = 0.7, kinds, scopes } = options;
    
    let kindFilter = sql``;
    let scopeFilter = sql``;
    
    if (kinds && kinds.length > 0) {
      kindFilter = sql`AND me.kind = ANY(${kinds})`;
    }
    
    if (scopes && scopes.length > 0) {
      scopeFilter = sql`AND me.scope = ANY(${scopes})`;
    }
    
    const result = await this.db.execute(sql`
      WITH text_scores AS (
        SELECT 
          me."memoryId",
          ts_rank(me.search_vector, plainto_tsquery('english', ${query})) as text_rank
        FROM "agentMemoryEntries" me
        WHERE me."userId" = ${userId}
          AND me.search_vector @@ plainto_tsquery('english', ${query})
          ${kindFilter}
          ${scopeFilter}
      ),
      vector_scores AS (
        SELECT 
          me."memoryId",
          (1 - (me.embedding <=> ${JSON.stringify(embedding)}::vector)) as vec_rank
        FROM "agentMemoryEntries" me
        WHERE me."userId" = ${userId}
          AND me.embedding IS NOT NULL
          ${kindFilter}
          ${scopeFilter}
      )
      SELECT 
        me."memoryId" as id,
        me.content,
        me.kind,
        me.scope,
        (COALESCE(ts.text_rank, 0) * ${textWeight} + 
         COALESCE(vs.vec_rank, 0) * ${vectorWeight}) as score
      FROM "agentMemoryEntries" me
      LEFT JOIN text_scores ts ON me."memoryId" = ts."memoryId"
      LEFT JOIN vector_scores vs ON me."memoryId" = vs."memoryId"
      WHERE me."userId" = ${userId}
        AND (ts."memoryId" IS NOT NULL OR vs."memoryId" IS NOT NULL)
      ORDER BY score DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    
    return result.rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      kind: row.kind,
      scope: row.scope,
      score: parseFloat(row.score),
    }));
  }

  /**
   * Fuzzy search using trigram similarity
   */
  async searchFuzzy(
    userId: number,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { limit = 20, offset = 0, minScore = 0.3, kinds, scopes } = options;
    
    let whereClause = sql`
      me."userId" = ${userId}
        AND similarity(me.content, ${query}) > ${minScore}
    `;
    
    if (kinds && kinds.length > 0) {
      whereClause = sql`${whereClause} AND me.kind = ANY(${kinds})`;
    }
    
    if (scopes && scopes.length > 0) {
      whereClause = sql`${whereClause} AND me.scope = ANY(${scopes})`;
    }
    
    const result = await this.db.execute(sql`
      SELECT 
        me."memoryId" as id,
        me.content,
        me.kind,
        me.scope,
        similarity(me.content, ${query}) as score
      FROM "agentMemoryEntries" me
      WHERE ${whereClause}
      ORDER BY score DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    
    return result.rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      kind: row.kind,
      scope: row.scope,
      score: parseFloat(row.score),
    }));
  }

  /**
   * Auto-complete suggestions using trigram similarity
   */
  async autocomplete(
    userId: number,
    prefix: string,
    limit: number = 5
  ): Promise<string[]> {
    const result = await this.db.execute(sql`
      SELECT DISTINCT content
      FROM "agentMemoryEntries"
      WHERE "userId" = ${userId}
        AND content ILIKE ${`%${prefix}%`}
      ORDER BY similarity(content, ${prefix}) DESC
      LIMIT ${limit}
    `);
    
    return result.rows.map((row: any) => row.content);
  }

  /**
   * Update search vectors for all entries (batch reindex)
   */
  async reindexAll(userId?: number): Promise<number> {
    let whereClause = sql``;
    if (userId) {
      whereClause = sql`WHERE "userId" = ${userId}`;
    }
    
    const result = await this.db.execute(sql`
      UPDATE "agentMemoryEntries"
      SET search_vector = 
        setweight(to_tsvector('english', COALESCE(content, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(kind, '')), 'B')
      ${whereClause}
    `);
    
    return result.rowCount ?? 0;
  }

  /**
   * Get search statistics
   */
  async stats(userId?: number): Promise<{
    totalEntries: number;
    indexedEntries: number;
    embeddedEntries: number;
  }> {
    let whereClause = sql``;
    if (userId) {
      whereClause = sql`WHERE "userId" = ${userId}`;
    }
    
    const result = await this.db.execute(sql`
      SELECT 
        COUNT(*) as total_entries,
        COUNT(*) FILTER (WHERE search_vector IS NOT NULL) as indexed_entries,
        COUNT(*) FILTER (WHERE embedding IS NOT NULL) as embedded_entries
      FROM "agentMemoryEntries"
      ${whereClause}
    `);
    
    const row = result.rows[0];
    return {
      totalEntries: parseInt(row.total_entries),
      indexedEntries: parseInt(row.indexed_entries),
      embeddedEntries: parseInt(row.embedded_entries),
    };
  }
}

// ─── Search Factory ─────────────────────────────────────────────────────────

export function createSearch(db: any): PostgresSearch {
  return new PostgresSearch(db);
}
