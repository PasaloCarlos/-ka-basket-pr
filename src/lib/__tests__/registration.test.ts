import { describe, it, expect } from "vitest";
import { validateRoster, getCategory, rosterSlotsFor } from "@/lib/registration";

describe("validateRoster", () => {
  it("accepts the minimum roster for 5v5 (5 players)", () => {
    const r = validateRoster("5v5", ["a", "b", "c", "d", "e"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.players).toHaveLength(5);
  });

  it("accepts the maximum roster for 5v5 (8 players)", () => {
    const r = validateRoster("5v5", ["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(r.ok).toBe(true);
  });

  it("rejects below the minimum (5v5 with 4)", () => {
    const r = validateRoster("5v5", ["a", "b", "c", "d"]);
    expect(r.ok).toBe(false);
  });

  it("rejects above the maximum (5v5 with 9)", () => {
    const r = validateRoster("5v5", ["a", "b", "c", "d", "e", "f", "g", "h", "i"]);
    expect(r.ok).toBe(false);
  });

  it("trims blanks before counting (2v2 with two names + blanks)", () => {
    const r = validateRoster("2v2", ["a", "b", "  ", ""]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.players).toEqual(["a", "b"]);
  });

  it("rejects 1v1 with two players", () => {
    expect(validateRoster("1v1", ["a", "b"]).ok).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(validateRoster("9v9", ["a"]).ok).toBe(false);
  });
});

describe("category helpers", () => {
  it("resolves known categories and null otherwise", () => {
    expect(getCategory("2v2")?.rosterMax).toBe(3);
    expect(getCategory("nope")).toBeNull();
  });

  it("returns roster slot count = rosterMax", () => {
    expect(rosterSlotsFor("5v5")).toBe(8);
    expect(rosterSlotsFor("1v1")).toBe(1);
  });
});
