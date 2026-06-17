import { describe, it, expect } from "vitest";
import { buildCheckinOrFilter } from "../checkin-search";

describe("buildCheckinOrFilter", () => {
  it("produces correctly quoted filter for a normal query", () => {
    const result = buildCheckinOrFilter("Heat");
    expect(result).toBe(`lookup_code.eq."HEAT",team_name.ilike."%Heat%"`);
  });

  it("keeps comma inside double-quoted operands for a query with a comma", () => {
    const result = buildCheckinOrFilter("Heat, Jr");
    expect(result).toContain(`team_name.ilike."%Heat, Jr%"`);
    // The value must be double-quoted (comma is inside the quotes, not a separator)
    expect(result).toBe(`lookup_code.eq."HEAT, JR",team_name.ilike."%Heat, Jr%"`);
  });

  it("strips embedded double-quotes and backslashes from the query", () => {
    const result = buildCheckinOrFilter('A"b\\c');
    expect(result).toBe(`lookup_code.eq."ABC",team_name.ilike."%Abc%"`);
  });

  it("trims leading and trailing whitespace", () => {
    const result = buildCheckinOrFilter("  Heat  ");
    expect(result).toBe(`lookup_code.eq."HEAT",team_name.ilike."%Heat%"`);
  });
});
