import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "http";
import app from "./app";

let server: Server;
let base: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

describe("app bootstrap", () => {
  it("exposes a health endpoint", async () => {
    const res = await fetch(`${base}/api/v1/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  it("generates an X-Request-Id and echoes a supplied one", async () => {
    const generated = await fetch(`${base}/api/v1/health`);
    expect(generated.headers.get("x-request-id")).toBeTruthy();

    const echoed = await fetch(`${base}/api/v1/health`, {
      headers: { "x-request-id": "test-trace-123" },
    });
    expect(echoed.headers.get("x-request-id")).toBe("test-trace-123");
  });

  it("returns a standardized 404 for unknown routes", async () => {
    const res = await fetch(`${base}/api/v1/definitely-not-a-route`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as {
      success: boolean;
      code: string;
      requestId?: string;
    };
    expect(body.success).toBe(false);
    expect(body.code).toBe("RESOURCE_NOT_FOUND");
    expect(body.requestId).toBeTruthy();
  });
});
