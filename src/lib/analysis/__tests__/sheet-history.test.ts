import { describe, expect, it } from "vitest";
import { computeScoreTrend, groupLatestSheetPerTicker, type SheetHistoryEntry } from "../sheet-history";

function entry(id: string, daysAgo: number, totalScore: number | null): SheetHistoryEntry {
  return { id, analysisDate: new Date(2026, 0, 1 - daysAgo), totalScore };
}

describe("computeScoreTrend", () => {
  it("returns all null when there are no sheets", () => {
    expect(computeScoreTrend([])).toEqual({ latestScore: null, previousScore: null, deltaAbsolute: null });
  });

  it("returns latestScore only when there's a single scored sheet", () => {
    const result = computeScoreTrend([entry("a", 0, 7)]);
    expect(result).toEqual({ latestScore: 7, previousScore: null, deltaAbsolute: null });
  });

  it("computes a positive delta when the score improved", () => {
    const result = computeScoreTrend([entry("a", 10, 6), entry("b", 0, 8)]);
    expect(result).toEqual({ latestScore: 8, previousScore: 6, deltaAbsolute: 2 });
  });

  it("computes a negative delta when the score dropped", () => {
    const result = computeScoreTrend([entry("a", 10, 8), entry("b", 0, 5)]);
    expect(result.deltaAbsolute).toBeCloseTo(-3);
  });

  it("ignores sheets without a score (null) when finding the two most recent scored entries", () => {
    const result = computeScoreTrend([entry("a", 20, 6), entry("b", 10, null), entry("c", 0, 9)]);
    expect(result).toEqual({ latestScore: 9, previousScore: 6, deltaAbsolute: 3 });
  });
});

describe("groupLatestSheetPerTicker", () => {
  it("keeps a single ticker with previousCount 0 when there's only one sheet", () => {
    const result = groupLatestSheetPerTicker([{ ticker: "PETR4", id: "a" }]);
    expect(result).toEqual([{ latest: { ticker: "PETR4", id: "a" }, previousCount: 0 }]);
  });

  it("keeps only the first (most recent) sheet per ticker, counting the rest", () => {
    const sheetsDescending = [
      { ticker: "PETR4", id: "newest" },
      { ticker: "VALE3", id: "vale-newest" },
      { ticker: "PETR4", id: "older" },
      { ticker: "PETR4", id: "oldest" },
    ];
    const result = groupLatestSheetPerTicker(sheetsDescending);
    expect(result).toEqual([
      { latest: { ticker: "PETR4", id: "newest" }, previousCount: 2 },
      { latest: { ticker: "VALE3", id: "vale-newest" }, previousCount: 0 },
    ]);
  });

  it("preserves the order of first appearance across tickers", () => {
    const sheetsDescending = [
      { ticker: "B", id: "1" },
      { ticker: "A", id: "2" },
      { ticker: "B", id: "3" },
    ];
    const result = groupLatestSheetPerTicker(sheetsDescending);
    expect(result.map((g) => g.latest.ticker)).toEqual(["B", "A"]);
  });
});
