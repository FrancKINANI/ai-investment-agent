import { describe, expect, it, vi, beforeEach } from "vitest";
import { PostgresCache, PostgresApiCache, PostgresSessionCache, PostgresRateLimiter } from "./cache";

// Mock database
const mockExecute = vi.fn();
const mockDb = { execute: mockExecute };

describe("PostgresCache", () => {
  let cache: PostgresCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new PostgresCache(mockDb, { ttlSeconds: 3600, namespace: "test" });
  });

  it("get returns null for missing key", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    const result = await cache.get("nonexistent");
    expect(result).toBeNull();
  });

  it("set stores value with TTL", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    await cache.set("key1", { data: "value" }, 60);
    
    expect(mockExecute).toHaveBeenCalled();
    const call = mockExecute.mock.calls[0][0];
    expect(call).toBeDefined();
  });

  it("delete removes key", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    await cache.delete("key1");
    
    expect(mockExecute).toHaveBeenCalled();
  });

  it("exists returns true for valid key", async () => {
    mockExecute.mockResolvedValue({ rows: [{ 1: 1 }] });
    const result = await cache.exists("key1");
    expect(result).toBe(true);
  });

  it("exists returns false for expired key", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    const result = await cache.exists("key1");
    expect(result).toBe(false);
  });

  it("clear removes all keys in namespace", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    await cache.clear();
    
    expect(mockExecute).toHaveBeenCalled();
  });

  it("cleanup removes expired entries", async () => {
    mockExecute.mockResolvedValue({ rowCount: 5 });
    const removed = await cache.cleanup();
    expect(removed).toBe(5);
  });

  it("stats returns cache statistics", async () => {
    mockExecute.mockResolvedValue({ 
      rows: [{ total: 100, expired: 10, active: 90 }] 
    });
    const stats = await cache.stats();
    
    expect(stats.total).toBe(100);
    expect(stats.expired).toBe(10);
    expect(stats.active).toBe(90);
  });
});

describe("PostgresApiCache", () => {
  let cache: PostgresApiCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new PostgresApiCache(mockDb, { ttlSeconds: 300 });
  });

  it("get returns null for missing endpoint", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    const result = await cache.get("/api/test");
    expect(result).toBeNull();
  });

  it("set stores API response", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    await cache.set("/api/test", { id: 1 }, { data: "response" }, 200);
    
    expect(mockExecute).toHaveBeenCalled();
  });

  it("invalidate removes endpoint cache", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    await cache.invalidate("/api/test");
    
    expect(mockExecute).toHaveBeenCalled();
  });

  it("clear removes all API cache", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    await cache.clear();
    
    expect(mockExecute).toHaveBeenCalled();
  });
});

describe("PostgresSessionCache", () => {
  let cache: PostgresSessionCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new PostgresSessionCache(mockDb, { ttlSeconds: 86400 });
  });

  it("get returns null for missing session", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    const result = await cache.get("session123");
    expect(result).toBeNull();
  });

  it("set stores session data", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    await cache.set("session123", 1, { user: "test" });
    
    expect(mockExecute).toHaveBeenCalled();
  });

  it("delete removes session", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    await cache.delete("session123");
    
    expect(mockExecute).toHaveBeenCalled();
  });

  it("getByUserId returns all user sessions", async () => {
    mockExecute.mockResolvedValue({ 
      rows: [{ session_id: "s1" }, { session_id: "s2" }] 
    });
    const sessions = await cache.getByUserId(1);
    
    expect(sessions).toEqual(["s1", "s2"]);
  });

  it("deleteByUserId removes all user sessions", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    await cache.deleteByUserId(1);
    
    expect(mockExecute).toHaveBeenCalled();
  });
});

describe("PostgresRateLimiter", () => {
  let limiter: PostgresRateLimiter;

  beforeEach(() => {
    vi.clearAllMocks();
    limiter = new PostgresRateLimiter(mockDb);
  });

  it("allows first request", async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [] }) // cleanup
      .mockResolvedValueOnce({ rows: [] }) // no existing
      .mockResolvedValueOnce({ rows: [] }); // insert
    
    const result = await limiter.isAllowed("user:123", 10, 60);
    
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("blocks when limit exceeded", async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [] }) // cleanup
      .mockResolvedValueOnce({ rows: [{ count: 10, window_start: new Date() }] }); // at limit
    
    const result = await limiter.isAllowed("user:123", 10, 60);
    
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets rate limit", async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    await limiter.reset("user:123");
    
    expect(mockExecute).toHaveBeenCalled();
  });
});
