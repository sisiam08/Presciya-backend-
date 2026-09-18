import { describe, it, expect } from "vitest";
import { AuthValidation } from "./auth.validation";

describe("SignUpSchema", () => {
  const valid = {
    body: {
      name: "Dr. Karim",
      email: "karim@example.com",
      password: "Password@123",
      accountType: "DOCTOR",
      OTP: "123456",
    },
  };

  it("accepts a valid signup payload", () => {
    const result = AuthValidation.SignUpSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid OTP", () => {
    const result = AuthValidation.SignUpSchema.safeParse({
      body: { ...valid.body, OTP: "12ab56" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.includes("OTP")),
      ).toBe(true);
    }
  });

  it("rejects a short password", () => {
    const result = AuthValidation.SignUpSchema.safeParse({
      body: { ...valid.body, password: "short" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = AuthValidation.SignUpSchema.safeParse({
      body: { ...valid.body, email: "not-an-email" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid accountType", () => {
    const result = AuthValidation.SignUpSchema.safeParse({
      body: { ...valid.body, accountType: "NURSE" },
    });
    expect(result.success).toBe(false);
  });
});

describe("logInSchema", () => {
  it("accepts a valid login payload", () => {
    const result = AuthValidation.logInSchema.safeParse({
      body: { email: "a@b.com", password: "Password@123" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = AuthValidation.logInSchema.safeParse({
      body: { email: "bad", password: "Password@123" },
    });
    expect(result.success).toBe(false);
  });
});

describe("SwitchWorkspaceSchema", () => {
  it("accepts a workspaceId", () => {
    const result = AuthValidation.SwitchWorkspaceSchema.safeParse({
      body: { workspaceId: "ws-123" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing workspaceId", () => {
    const result = AuthValidation.SwitchWorkspaceSchema.safeParse({
      body: {},
    });
    expect(result.success).toBe(false);
  });

  it("strips a forged userId from the body (identity must come from the session)", () => {
    const result = AuthValidation.SwitchWorkspaceSchema.safeParse({
      body: { workspaceId: "ws-123", userId: "victim-user-id" },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body).toEqual({ workspaceId: "ws-123" });
      expect("userId" in result.data.body).toBe(false);
    }
  });
});
