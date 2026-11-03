import { describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
import { hashCode, newCode, sign, verifyToken } from "./twoStep";

describe("two-step tokens", () => {
  it("accepts a valid token for the same user only, until it expires", () => {
    const t = sign("user-1", 2_000, "k");
    expect(verifyToken(t, "user-1", 1_000, "k")).toBe(true);
    expect(verifyToken(t, "user-2", 1_000, "k")).toBe(false);
    expect(verifyToken(t, "user-1", 3_000, "k")).toBe(false);
    expect(verifyToken(t.replace(/.$/, (c) => (c === "A" ? "B" : "A")), "user-1", 1_000, "k")).toBe(false);
    expect(verifyToken(sign("user-1", 2_000, "other"), "user-1", 1_000, "k")).toBe(false);
  });
  it("codes are 6 digits and hashed per user", () => {
    process.env.TWO_STEP_SECRET = "s";
    expect(newCode()).toMatch(/^\d{6}$/);
    expect(hashCode("a", "123456")).not.toBe(hashCode("b", "123456"));
  });
});
