import { describe, it, expect, vi, beforeEach } from "vitest";

// The scope helpers only touch prisma for the membership lookup, so it is
// mocked here — these tests prove the AUTHORIZATION BOUNDARY logic itself.
const findMany = vi.fn();
const findFirst = vi.fn();

vi.mock("../lib/prisma", () => ({
  prisma: {
    membership: { findMany: (...a: any[]) => findMany(...a) },
    chamber: { findFirst: (...a: any[]) => findFirst(...a) },
  },
}));

import {
  chamberScopeFilter,
  recordInScope,
  requestedScopeMode,
  resolveRequestScope,
  scopeFilter,
  type RequestScope,
} from "./chamberScope";

const WS_A = "ws-a";
const WS_B = "ws-b";
const CHAMBER_A = "chamber-a";
const CHAMBER_B = "chamber-b";

const current = (chamberId: string | null): RequestScope => ({
  mode: "current",
  workspaceId: WS_A,
  workspaceIds: [WS_A],
  chamberId,
});

const all = (workspaceIds: string[]): RequestScope => ({
  mode: "all",
  workspaceId: WS_A,
  workspaceIds,
  chamberId: null,
});

beforeEach(() => {
  findMany.mockReset();
  findFirst.mockReset();
});

describe("requestedScopeMode", () => {
  it("defaults to current when nothing is supplied", () => {
    expect(requestedScopeMode({ headers: {}, query: {} })).toBe("current");
  });

  it("never widens on an invalid or garbled value", () => {
    expect(requestedScopeMode({ headers: { "x-workspace-scope": "ALL " } })).toBe("all");
    expect(requestedScopeMode({ headers: { "x-workspace-scope": "yes" } })).toBe("current");
    expect(requestedScopeMode({ headers: {}, query: { workspaceScope: "1" } })).toBe("current");
    expect(requestedScopeMode({ headers: {}, query: {} })).toBe("current");
  });

  it("honours the explicit all in header or query", () => {
    expect(requestedScopeMode({ headers: { "x-workspace-scope": "all" } })).toBe("all");
    expect(requestedScopeMode({ headers: {}, query: { workspaceScope: "all" } })).toBe("all");
  });
});

describe("scopeFilter", () => {
  it("current mode pins BOTH the workspace and the chamber", () => {
    expect(scopeFilter(current(CHAMBER_A))).toEqual({
      workspaceId: WS_A,
      chamberId: CHAMBER_A,
    });
  });

  it("current mode with no chamber means the personal scope (IS NULL)", () => {
    expect(scopeFilter(current(null))).toEqual({
      workspaceId: WS_A,
      chamberId: null,
    });
  });

  it("all mode widens only to the authorized workspace set", () => {
    expect(scopeFilter(all([WS_A, WS_B]))).toEqual({
      workspaceId: { in: [WS_A, WS_B] },
    });
  });

  it("all mode with an EMPTY authorized set matches nothing", () => {
    // An empty set must never mean "unrestricted".
    expect(scopeFilter(all([]))).toEqual({ workspaceId: { in: [] } });
  });
});

describe("recordInScope", () => {
  it("current mode: same chamber is in scope, other chamber is not", () => {
    const scope = current(CHAMBER_A);
    expect(recordInScope({ workspaceId: WS_A, chamberId: CHAMBER_A }, scope)).toBe(true);
    expect(recordInScope({ workspaceId: WS_A, chamberId: CHAMBER_B }, scope)).toBe(false);
  });

  it("current mode: a foreign workspace is out of scope even in the same chamber id", () => {
    const scope = current(CHAMBER_A);
    expect(recordInScope({ workspaceId: WS_B, chamberId: CHAMBER_A }, scope)).toBe(false);
  });

  it("personal scope only accepts chamber-less records", () => {
    const scope = current(null);
    expect(recordInScope({ workspaceId: WS_A, chamberId: null }, scope)).toBe(true);
    expect(recordInScope({ workspaceId: WS_A, chamberId: CHAMBER_A }, scope)).toBe(false);
  });

  it("all mode accepts any authorized workspace and rejects the rest", () => {
    const scope = all([WS_A, WS_B]);
    expect(recordInScope({ workspaceId: WS_B, chamberId: CHAMBER_B }, scope)).toBe(true);
    expect(recordInScope({ workspaceId: "ws-other", chamberId: CHAMBER_A }, scope)).toBe(false);
  });

  it("all mode with an empty authorized set rejects everything", () => {
    expect(recordInScope({ workspaceId: WS_A, chamberId: null }, all([]))).toBe(false);
  });
});

describe("resolveRequestScope", () => {
  it("current mode validates the chamber against the caller's workspace", async () => {
    findFirst.mockResolvedValue({ id: CHAMBER_A });
    const scope = await resolveRequestScope("user-1", WS_A, {
      headers: { "x-chamber-id": CHAMBER_A },
      query: {},
    });
    expect(scope).toMatchObject({ mode: "current", workspaceId: WS_A, chamberId: CHAMBER_A });
  });

  it("rejects a chamber that does not belong to the workspace", async () => {
    findFirst.mockResolvedValue(null);
    await expect(
      resolveRequestScope("user-1", WS_A, {
        headers: { "x-chamber-id": "someone-elses-chamber" },
        query: {},
      }),
    ).rejects.toThrow(/Chamber not found/);
  });

  it("all mode derives the authorized set from ACTIVE memberships only", async () => {
    findMany.mockResolvedValue([{ workspaceId: WS_A }, { workspaceId: WS_B }]);
    const scope = await resolveRequestScope("user-1", WS_A, {
      headers: { "x-workspace-scope": "all" },
      query: {},
    });
    expect(scope.mode).toBe("all");
    expect(scope.workspaceIds).toEqual([WS_A, WS_B]);
    // The membership query must be filtered to ACTIVE memberships.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", status: "ACTIVE" }),
      }),
    );
  });

  it("all mode with no memberships yields an empty (not unrestricted) set", async () => {
    findMany.mockResolvedValue([]);
    const scope = await resolveRequestScope("user-1", WS_A, {
      headers: { "x-workspace-scope": "all" },
      query: {},
    });
    expect(scope.workspaceIds).toEqual([]);
  });
});

describe("chamberScopeFilter", () => {
  it("maps a chamber id straight through and null to the personal scope", () => {
    expect(chamberScopeFilter(CHAMBER_A)).toEqual({ chamberId: CHAMBER_A });
    expect(chamberScopeFilter(null)).toEqual({ chamberId: null });
  });
});
