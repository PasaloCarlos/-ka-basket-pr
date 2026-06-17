import { describe, it, expect } from "vitest";
import { capacityState, aggregateFormatCapacity } from "@/lib/capacity";

describe("capacityState", () => {
  it("is never full and reports null spots when max is null (unlimited)", () => {
    expect(capacityState({ count: 99, max: null })).toEqual({ isFull: false, spotsLeft: null });
  });
  it("reports spots left below the cap", () => {
    expect(capacityState({ count: 3, max: 8 })).toEqual({ isFull: false, spotsLeft: 5 });
  });
  it("is full at the cap", () => {
    expect(capacityState({ count: 8, max: 8 })).toEqual({ isFull: true, spotsLeft: 0 });
  });
  it("clamps spotsLeft to 0 when over the cap", () => {
    expect(capacityState({ count: 10, max: 8 })).toEqual({ isFull: true, spotsLeft: 0 });
  });
});

describe("aggregateFormatCapacity", () => {
  it("returns not-full / null spots for an empty format", () => {
    expect(aggregateFormatCapacity([])).toEqual({ isFull: false, spotsLeft: null, count: 0 });
  });
  it("sums counts across divisions", () => {
    const r = aggregateFormatCapacity([{ count: 2, max: 4 }, { count: 1, max: 4 }]);
    expect(r.count).toBe(3);
    expect(r.spotsLeft).toBe(5);
    expect(r.isFull).toBe(false);
  });
  it("is full only when every capped division is full", () => {
    expect(aggregateFormatCapacity([{ count: 4, max: 4 }, { count: 4, max: 4 }]).isFull).toBe(true);
    expect(aggregateFormatCapacity([{ count: 4, max: 4 }, { count: 1, max: 4 }]).isFull).toBe(false);
  });
  it("is never full and has null spots when any division is uncapped", () => {
    const r = aggregateFormatCapacity([{ count: 9, max: null }, { count: 4, max: 4 }]);
    expect(r.isFull).toBe(false);
    expect(r.spotsLeft).toBeNull();
  });
});
