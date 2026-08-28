import { describe, expect, it, vi, beforeEach } from "vitest";
import { PostgresSearch } from "./search";

// Mock database
const mockExecute = vi.fn();
const mockDb = { execute: mockExecute };

describe("PostgresSearch", () => {
  let search: PostgresSearch;

  beforeEach(() => {
    vi.clearAllMocks();
    search = new PostgresSearch(mockDb);
  });

  describe("searchText", () => {
    it("returns empty array for no results", async () => {
      mockExecute.mockResolvedValue({ rows: [] });
      const results = await search.searchText(1, "bitcoin");
      
      expect(results).toEqual([]);
    });

    it("returns results with scores", async () => {
      mockExecute.mockResolvedValue({ 
        rows: [
          { id: "m1", content: "Bitcoin research", kind: "research_note", scope: "shared", score: 0.8, highlight: "Bitcoin" },
          { id: "m2", content: "Bitcoin analysis", kind: "verified_fact", scope: "private", score: 0.6, highlight: "Bitcoin" },
        ] 
      });
      
      const results = await search.searchText(1, "bitcoin");
      
      expect(results).toHaveLength(2);
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it("filters by kinds", async () => {
      mockExecute.mockResolvedValue({ rows: [] });
      await search.searchText(1, "bitcoin", { kinds: ["research_note"] });
      
      expect(mockExecute).toHaveBeenCalled();
    });

    it("filters by scopes", async () => {
      mockExecute.mockResolvedValue({ rows: [] });
      await search.searchText(1, "bitcoin", { scopes: ["shared"] });
      
      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe("searchVector", () => {
    it("returns empty array for no results", async () => {
      mockExecute.mockResolvedValue({ rows: [] });
      const results = await search.searchVector(1, [0.1, 0.2, 0.3]);
      
      expect(results).toEqual([]);
    });

    it("returns results with similarity scores", async () => {
      mockExecute.mockResolvedValue({ 
        rows: [
          { id: "m1", content: "Bitcoin research", kind: "research_note", scope: "shared", score: 0.9 },
          { id: "m2", content: "Ethereum analysis", kind: "verified_fact", scope: "private", score: 0.7 },
        ] 
      });
      
      const results = await search.searchVector(1, [0.1, 0.2, 0.3]);
      
      expect(results).toHaveLength(2);
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it("respects similarity threshold", async () => {
      mockExecute.mockResolvedValue({ rows: [] });
      await search.searchVector(1, [0.1, 0.2, 0.3], { similarityThreshold: 0.9 });
      
      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe("searchHybrid", () => {
    it("combines text and vector scores", async () => {
      mockExecute.mockResolvedValue({ 
        rows: [
          { id: "m1", content: "Bitcoin research", kind: "research_note", scope: "shared", score: 0.85 },
        ] 
      });
      
      const results = await search.searchHybrid(1, "bitcoin", [0.1, 0.2, 0.3]);
      
      expect(results).toHaveLength(1);
      expect(results[0].score).toBeCloseTo(0.85, 1);
    });

    it("applies text and vector weights", async () => {
      mockExecute.mockResolvedValue({ rows: [] });
      await search.searchHybrid(1, "bitcoin", [0.1, 0.2, 0.3], { textWeight: 0.5, vectorWeight: 0.5 });
      
      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe("searchFuzzy", () => {
    it("returns fuzzy matches", async () => {
      mockExecute.mockResolvedValue({ 
        rows: [
          { id: "m1", content: "Bitcoin", kind: "research_note", scope: "shared", score: 0.8 },
        ] 
      });
      
      const results = await search.searchFuzzy(1, "btcoin");
      
      expect(results).toHaveLength(1);
      expect(results[0].score).toBeGreaterThan(0);
    });
  });

  describe("autocomplete", () => {
    it("returns suggestions", async () => {
      mockExecute.mockResolvedValue({ 
        rows: [
          { content: "Bitcoin research notes" },
          { content: "Bitcoin price analysis" },
        ] 
      });
      
      const suggestions = await search.autocomplete(1, "bitc");
      
      expect(suggestions).toHaveLength(2);
    });
  });

  describe("reindexAll", () => {
    it("reindexes all entries", async () => {
      mockExecute.mockResolvedValue({ rowCount: 100 });
      const count = await search.reindexAll();
      
      expect(count).toBe(100);
    });

    it("reindexes user entries only", async () => {
      mockExecute.mockResolvedValue({ rowCount: 50 });
      const count = await search.reindexAll(1);
      
      expect(count).toBe(50);
    });
  });

  describe("stats", () => {
    it("returns search statistics", async () => {
      mockExecute.mockResolvedValue({ 
        rows: [{ 
          total_entries: "1000", 
          indexed_entries: "800", 
          embedded_entries: "500" 
        }] 
      });
      
      const stats = await search.stats();
      
      expect(stats.totalEntries).toBe(1000);
      expect(stats.indexedEntries).toBe(800);
      expect(stats.embeddedEntries).toBe(500);
    });
  });
});
