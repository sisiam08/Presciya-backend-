import { describe, it, expect } from "vitest";
import { getPaginationParams, buildPaginatedResult } from "./pagination";

describe("getPaginationParams", () => {
  it("returns defaults when no args provided", () => {
    expect(getPaginationParams()).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it("parses valid page and limit", () => {
    expect(getPaginationParams("3", "10")).toEqual({
      page: 3,
      limit: 10,
      skip: 20,
    });
  });

  it("clamps limit to 100", () => {
    expect(getPaginationParams(undefined, "500").limit).toBe(100);
  });

  it("clamps page to minimum of 1", () => {
    expect(getPaginationParams("0", undefined)).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
    });
  });

  it("falls back to defaults for non-numeric input", () => {
    expect(getPaginationParams("abc", {})).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
    });
  });
});

describe("buildPaginatedResult", () => {
  it("computes totalPages correctly", () => {
    const items = [{ id: 1 }, { id: 2 }];
    const result = buildPaginatedResult(items, 25, 1, 10);
    expect(result.data).toHaveLength(2);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
  });

  it("returns at least one totalPage for empty results", () => {
    const result = buildPaginatedResult([], 0, 1, 20);
    expect(result.pagination.totalPages).toBe(0);
  });
});
