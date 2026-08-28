/**
 * PostgreSQL Cache Service
 * 
 * Uses UNLOGGED tables for fast, non-durable caching.
 * Replaces Redis for key-value caching, API response caching, and session storage.
 * 
 * Benefits over Redis:
 * - No separate service to maintain
 * - ACID transactions
 * - JSONB for flexible values
 * - TTL-based expiration
 * - SQL queries for complex cache invalidation
 */

import { sql } from "drizzle-orm";

// ─── Cache Interface ────────────────────────────────────────────────────────

export interface CacheOptions {
  ttlSeconds?: number;
  namespace?: string;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  expiresAt: Date;
  createdAt: Date;
}

// ─── Cache Service ──────────────────────────────────────────────────────────

export class PostgresCache {
  private db: any;
  private defaultTtl: number;
  private namespace: string;

  constructor(db: any, options: CacheOptions = {}) {
    this.db = db;
    this.defaultTtl = options.ttlSeconds ?? 3600; // 1 hour default
    this.namespace = options.namespace ?? "cache";
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);
    const result = await this.db.execute(sql`
      SELECT value FROM cache_store 
      WHERE key = ${fullKey} AND expires_at > NOW()
    `);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].value as T;
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const fullKey = this.getFullKey(key);
    const ttl = ttlSeconds ?? this.defaultTtl;
    
    await this.db.execute(sql`
      INSERT INTO cache_store (key, value, expires_at)
      VALUES (${fullKey}, ${JSON.stringify(value)}::jsonb, NOW() + ${`${ttl} seconds`}::interval)
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        expires_at = EXCLUDED.expires_at
    `);
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    await this.db.execute(sql`
      DELETE FROM cache_store WHERE key = ${fullKey}
    `);
  }

  /**
   * Check if a key exists and is not expired
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const result = await this.db.execute(sql`
      SELECT 1 FROM cache_store 
      WHERE key = ${fullKey} AND expires_at > NOW()
    `);
    return result.rows.length > 0;
  }

  /**
   * Get multiple values at once
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const fullKeys = keys.map(k => this.getFullKey(k));
    const result = await this.db.execute(sql`
      SELECT key, value FROM cache_store 
      WHERE key = ANY(${fullKeys}) AND expires_at > NOW()
    `);
    
    const cacheMap = new Map<string, T>();
    for (const row of result.rows) {
      cacheMap.set(row.key, row.value as T);
    }
    
    return fullKeys.map(k => cacheMap.get(k) ?? null);
  }

  /**
   * Set multiple values at once
   */
  async mset<T>(entries: [string, T][], ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtl;
    
    for (const [key, value] of entries) {
      await this.set(key, value, ttl);
    }
  }

  /**
   * Clear all cache entries for this namespace
   */
  async clear(): Promise<void> {
    await this.db.execute(sql`
      DELETE FROM cache_store WHERE key LIKE ${`${this.namespace}:%`}
    `);
  }

  /**
   * Clear expired entries (garbage collection)
   */
  async cleanup(): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM cache_store WHERE expires_at < NOW()
    `);
    return result.rowCount ?? 0;
  }

  /**
   * Get cache statistics
   */
  async stats(): Promise<{ total: number; expired: number; active: number }> {
    const result = await this.db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE expires_at < NOW()) as expired,
        COUNT(*) FILTER (WHERE expires_at >= NOW()) as active
      FROM cache_store
    `);
    return result.rows[0];
  }

  private getFullKey(key: string): string {
    return `${this.namespace}:${key}`;
  }
}

// ─── API Cache ──────────────────────────────────────────────────────────────

export class PostgresApiCache {
  private db: any;
  private defaultTtl: number;

  constructor(db: any, options: { ttlSeconds?: number } = {}) {
    this.db = db;
    this.defaultTtl = options.ttlSeconds ?? 300; // 5 minutes default
  }

  /**
   * Get cached API response
   */
  async get<T>(endpoint: string, params: Record<string, any> = {}): Promise<T | null> {
    const result = await this.db.execute(sql`
      SELECT response FROM api_cache 
      WHERE endpoint = ${endpoint} 
        AND params = ${JSON.stringify(params)}::jsonb
        AND expires_at > NOW()
    `);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].response as T;
  }

  /**
   * Cache API response
   */
  async set<T>(
    endpoint: string, 
    params: Record<string, any>, 
    response: T, 
    statusCode: number = 200,
    ttlSeconds?: number
  ): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtl;
    
    await this.db.execute(sql`
      INSERT INTO api_cache (endpoint, params, response, status_code, expires_at)
      VALUES (
        ${endpoint}, 
        ${JSON.stringify(params)}::jsonb, 
        ${JSON.stringify(response)}::jsonb,
        ${statusCode},
        NOW() + ${`${ttl} seconds`}::interval
      )
      ON CONFLICT (endpoint, params) DO UPDATE SET
        response = EXCLUDED.response,
        status_code = EXCLUDED.status_code,
        expires_at = EXCLUDED.expires_at
    `);
  }

  /**
   * Invalidate cache for an endpoint
   */
  async invalidate(endpoint: string): Promise<void> {
    await this.db.execute(sql`
      DELETE FROM api_cache WHERE endpoint = ${endpoint}
    `);
  }

  /**
   * Clear all API cache
   */
  async clear(): Promise<void> {
    await this.db.execute(sql`DELETE FROM api_cache`);
  }
}

// ─── Session Cache ──────────────────────────────────────────────────────────

export class PostgresSessionCache {
  private db: any;
  private defaultTtl: number;

  constructor(db: any, options: { ttlSeconds?: number } = {}) {
    this.db = db;
    this.defaultTtl = options.ttlSeconds ?? 86400; // 24 hours default
  }

  /**
   * Get session data
   */
  async get<T>(sessionId: string): Promise<T | null> {
    const result = await this.db.execute(sql`
      SELECT data FROM session_cache 
      WHERE session_id = ${sessionId} AND expires_at > NOW()
    `);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].data as T;
  }

  /**
   * Set session data
   */
  async set<T>(sessionId: string, userId: number, data: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtl;
    
    await this.db.execute(sql`
      INSERT INTO session_cache (session_id, user_id, data, expires_at)
      VALUES (${sessionId}, ${userId}, ${JSON.stringify(data)}::jsonb, NOW() + ${`${ttl} seconds`}::interval)
      ON CONFLICT (session_id) DO UPDATE SET
        data = EXCLUDED.data,
        expires_at = EXCLUDED.expires_at
    `);
  }

  /**
   * Delete session
   */
  async delete(sessionId: string): Promise<void> {
    await this.db.execute(sql`
      DELETE FROM session_cache WHERE session_id = ${sessionId}
    `);
  }

  /**
   * Get all sessions for a user
   */
  async getByUserId(userId: number): Promise<string[]> {
    const result = await this.db.execute(sql`
      SELECT session_id FROM session_cache 
      WHERE user_id = ${userId} AND expires_at > NOW()
    `);
    return result.rows.map((r: any) => r.session_id);
  }

  /**
   * Delete all sessions for a user
   */
  async deleteByUserId(userId: number): Promise<void> {
    await this.db.execute(sql`
      DELETE FROM session_cache WHERE user_id = ${userId}
    `);
  }
}

// ─── Rate Limiter ───────────────────────────────────────────────────────────

export class PostgresRateLimiter {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Check if a request is allowed (sliding window rate limiting)
   */
  async isAllowed(
    key: string, 
    maxRequests: number, 
    windowSeconds: number = 60
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const windowStart = new Date(Date.now() - windowSeconds * 1000);
    
    // Clean up old entries and get current count
    await this.db.execute(sql`
      DELETE FROM rate_limit_cache 
      WHERE key = ${key} AND expires_at < NOW()
    `);
    
    const result = await this.db.execute(sql`
      SELECT count, window_start FROM rate_limit_cache 
      WHERE key = ${key}
    `);
    
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowSeconds * 1000);
    
    if (result.rows.length === 0) {
      // First request in window
      await this.db.execute(sql`
        INSERT INTO rate_limit_cache (key, count, window_start, expires_at)
        VALUES (${key}, 1, ${now.toISOString()}, ${resetAt.toISOString()})
      `);
      
      return { allowed: true, remaining: maxRequests - 1, resetAt };
    }
    
    const { count, window_start } = result.rows[0];
    
    if (count >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt: new Date(window_start.getTime() + windowSeconds * 1000) };
    }
    
    // Increment count
    await this.db.execute(sql`
      UPDATE rate_limit_cache 
      SET count = count + 1 
      WHERE key = ${key}
    `);
    
    return { allowed: true, remaining: maxRequests - count - 1, resetAt };
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    await this.db.execute(sql`
      DELETE FROM rate_limit_cache WHERE key = ${key}
    `);
  }
}

// ─── Cache Factory ──────────────────────────────────────────────────────────

export function createCache(db: any, options: CacheOptions = {}): PostgresCache {
  return new PostgresCache(db, options);
}

export function createApiCache(db: any, options: { ttlSeconds?: number } = {}): PostgresApiCache {
  return new PostgresApiCache(db, options);
}

export function createSessionCache(db: any, options: { ttlSeconds?: number } = {}): PostgresSessionCache {
  return new PostgresSessionCache(db, options);
}

export function createRateLimiter(db: any): PostgresRateLimiter {
  return new PostgresRateLimiter(db);
}
