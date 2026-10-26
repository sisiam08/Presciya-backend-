import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockEmailsSend } = vi.hoisted(() => ({
  mockEmailsSend: vi.fn(),
}));

vi.mock("resend", () => {
  function MockResend(this: { emails: { send: typeof mockEmailsSend } }) {
    this.emails = {
      send: mockEmailsSend,
    };
  }

  return { Resend: MockResend };
});

vi.mock("../config", () => ({
  default: {
    resend: {
      apiKey: "re_test_only_fake_key",
      fromEmail: "sender@example.test",
      fromName: "Presciya",
    },
    invitationExpiryDays: 7,
  },
}));

import {
  createResendDiagnosticFetch,
  emailService,
} from "./emailService";

describe("emailService Resend diagnostics", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs provider status and redacted error details without recipient or OTP", async () => {
    mockEmailsSend.mockRejectedValueOnce({
      statusCode: 403,
      message: "Delivery to user@example.com rejected for code 123456 using re_live_secret_key.",
    });

    await expect(
      emailService.sendOTPEmail(
        "user@example.com",
        "Test User",
        "123456",
        "request-123",
      ),
    ).rejects.toThrow("Failed to send email. Please try again later.");

    const diagnosticLog = vi.mocked(console.error).mock.calls[0]?.[0];
    expect(typeof diagnosticLog).toBe("string");
    const entry = JSON.parse(diagnosticLog as string);

    expect(entry).toMatchObject({
      level: "error",
      type: "email_delivery_failed",
      provider: "resend",
      requestId: "request-123",
      statusCode: 403,
      details: [
        "Delivery to [redacted email] rejected for code [redacted code] using [redacted key].",
      ],
    });
    expect(diagnosticLog).not.toContain("user@example.com");
    expect(diagnosticLog).not.toContain("123456");
    expect(diagnosticLog).not.toContain("re_live_secret_key");
    expect(mockEmailsSend.mock.calls[0]?.[1]).toMatchObject({
      idempotencyKey: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
    });
  });

  it("logs the underlying fetch cause for Resend network failures", async () => {
    const cause = Object.assign(
      new Error("getaddrinfo ENOTFOUND api.resend.com"),
      { code: "ENOTFOUND" },
    );
    const networkError = Object.assign(new TypeError("fetch failed"), {
      cause,
    });
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(networkError);
    const diagnosticFetch = createResendDiagnosticFetch(fetchImplementation);

    await expect(
      diagnosticFetch("https://api.resend.com/emails", undefined),
    ).rejects.toBe(networkError);

    const diagnosticLog = vi.mocked(console.error).mock.calls[0]?.[0];
    expect(typeof diagnosticLog).toBe("string");
    expect(JSON.parse(diagnosticLog as string)).toMatchObject({
      type: "email_transport_failed",
      provider: "resend",
      host: "api.resend.com",
      path: "/emails",
      networkError: {
        name: "TypeError",
        message: "fetch failed",
        cause: {
          name: "Error",
          code: "ENOTFOUND",
          message: "getaddrinfo ENOTFOUND api.resend.com",
        },
      },
    });
  });

  it("retries bounded connection timeouts with backoff and reuses the request idempotency key", async () => {
    const timeout = Object.assign(new Error("Connect Timeout Error"), {
      name: "ConnectTimeoutError",
      code: "UND_ERR_CONNECT_TIMEOUT",
    });
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const diagnosticFetch = createResendDiagnosticFetch(fetchImplementation, {
      sleep,
      random: () => 0,
    });

    const response = await diagnosticFetch(
      "https://api.resend.com/emails",
      { method: "POST", headers: { "Idempotency-Key": "email-send-123" } },
    );

    expect(response.status).toBe(202);
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[300], [600]]);
    expect(fetchImplementation.mock.calls.map((call) => call[1]?.headers)).toEqual([
      { "Idempotency-Key": "email-send-123" },
      { "Idempotency-Key": "email-send-123" },
      { "Idempotency-Key": "email-send-123" },
    ]);
  });

  it("does not retry a non-connect network failure", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(
        Object.assign(new Error("getaddrinfo ENOTFOUND api.resend.com"), {
          code: "ENOTFOUND",
        }),
      );
    const sleep = vi.fn().mockResolvedValue(undefined);
    const diagnosticFetch = createResendDiagnosticFetch(fetchImplementation, {
      sleep,
    });

    await expect(
      diagnosticFetch("https://api.resend.com/emails"),
    ).rejects.toMatchObject({ code: "ENOTFOUND" });

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("does not retry provider validation responses", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("invalid sender", { status: 403 }));
    const diagnosticFetch = createResendDiagnosticFetch(fetchImplementation);

    const response = await diagnosticFetch(
      "https://api.resend.com/emails",
      { method: "POST" },
    );

    expect(response.status).toBe(403);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });
});
