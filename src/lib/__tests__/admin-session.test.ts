import { describe, it, expect, beforeAll } from "vitest";
import { signSession, verifySession } from "@/lib/admin-session";

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET = "test-secret-please-ignore-0123456789abcdef";
});

describe("admin session token", () => {
  it("signs then verifies a fresh token", async () => {
    const token = await signSession();
    expect(await verifySession(token)).toBe(true);
  });

  it("rejects empty / missing tokens", async () => {
    expect(await verifySession(undefined)).toBe(false);
    expect(await verifySession("")).toBe(false);
    expect(await verifySession("garbage")).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const token = await signSession();
    const tampered = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    expect(await verifySession(tampered)).toBe(false);
  });

  it("rejects a tampered expiry", async () => {
    const token = await signSession();
    const sig = token.slice(token.indexOf(".") + 1);
    const farFuture = `${Date.now() + 999_999_999}.${sig}`;
    expect(await verifySession(farFuture)).toBe(false);
  });

  it("rejects an expired token", async () => {
    // signed as if it were issued at epoch 0 -> already expired by now
    const token = await signSession(0);
    expect(await verifySession(token)).toBe(false);
  });
});
