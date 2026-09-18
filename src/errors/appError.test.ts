import { describe, it, expect } from "vitest";
import { createAppError, isAppError } from "./appError";
import { Status } from "./httpStatus";

describe("createAppError", () => {
  it("creates an Error with statusCode and isOperational", () => {
    const err = createAppError("Something failed", Status.NOT_FOUND);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Something failed");
    expect(err.statusCode).toBe(404);
    expect(err.isOperational).toBe(true);
  });

  it("defaults isOperational to true", () => {
    const err = createAppError("test", 400);
    expect(err.isOperational).toBe(true);
  });

  it("allows isOperational to be set to false", () => {
    const err = createAppError("test", 500, false);
    expect(err.isOperational).toBe(false);
  });
});

describe("isAppError", () => {
  it("returns true for app errors", () => {
    expect(isAppError(createAppError("x", 400))).toBe(true);
  });

  it("returns false for plain errors", () => {
    expect(isAppError(new Error("x"))).toBe(false);
  });

  it("returns false for non-error values", () => {
    expect(isAppError(null)).toBe(false);
    expect(isAppError("string")).toBe(false);
    expect(isAppError(42)).toBe(false);
  });
});
