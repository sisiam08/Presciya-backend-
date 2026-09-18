import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./auth.service", () => ({
  AuthServices: {
    switchWorkspace: vi.fn().mockResolvedValue({
      data: { user: {}, profile: {}, workspace: {} },
      accessToken: "access-token",
      refreshToken: "refresh-token",
    }),
  },
}));

import { AuthServices } from "./auth.service";
import { AuthControllers } from "./auth.controller";

const mockSwitchWorkspace = vi.mocked(AuthServices.switchWorkspace);

const createRes = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
  }) as any;

describe("switchWorkspace controller — identity source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the authenticated session user id, never the body userId", async () => {
    const req: any = {
      user: { id: "attacker-id" },
      body: { workspaceId: "ws-1", userId: "victim-id" },
      headers: { "user-agent": "vitest" },
      ip: "127.0.0.1",
    };
    const res = createRes();
    const next = vi.fn();

    await AuthControllers.switchWorkspace(req, res, next);

    expect(mockSwitchWorkspace).toHaveBeenCalledWith(
      "attacker-id",
      "ws-1",
      "vitest",
      "127.0.0.1",
    );
    expect(mockSwitchWorkspace).not.toHaveBeenCalledWith(
      "victim-id",
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects the request when there is no authenticated user", async () => {
    const req: any = {
      user: undefined,
      body: { workspaceId: "ws-1", userId: "victim-id" },
      headers: {},
      ip: "127.0.0.1",
    };
    const res = createRes();
    const next = vi.fn();

    await AuthControllers.switchWorkspace(req, res, next);

    expect(mockSwitchWorkspace).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 401 });
  });
});
