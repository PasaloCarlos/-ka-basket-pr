import { describe, it, expect } from "vitest";
import { fillTemplate, captainWhatsappUrl } from "@/lib/whatsapp";
import type { TeamWithDetails } from "@/types";

describe("fillTemplate", () => {
  it("substitutes {placeholders} from vars", () => {
    expect(fillTemplate("Hola {captain}, equipo {team}", { captain: "Ana", team: "Panteras" }))
      .toBe("Hola Ana, equipo Panteras");
  });
  it("replaces an unknown placeholder with empty string", () => {
    expect(fillTemplate("x {missing} y", {})).toBe("x  y");
  });
});

function team(overrides: Partial<TeamWithDetails> = {}): TeamWithDetails {
  return {
    id: "t1", tournament_id: "tr1", team_name: "Panteras", division: "female",
    age_bracket: "Sub-12", captain_name: "Ana", captain_phone: "787-555-1234",
    captain_email: null, notes: null, status: "confirmed", paid: false, paid_at: null,
    checked_in: false, checked_in_at: null, lookup_code: "A1B2C3",
    created_at: "", updated_at: "",
    tournaments: { name: "2 vs 2 - Femenino", format: "2v2", division: "female" },
    players: [],
    ...overrides,
  } as TeamWithDetails;
}

describe("captainWhatsappUrl", () => {
  it("builds a wa.me link, prepending PR/US country code to a 10-digit number", () => {
    const url = captainWhatsappUrl(team(), "confirmacion");
    expect(url).toContain("https://wa.me/17875551234?text=");
    expect(decodeURIComponent(url!)).toContain("Panteras");
    expect(decodeURIComponent(url!)).toContain("A1B2C3");
    expect(decodeURIComponent(url!)).toContain("2 vs 2 - Femenino");
  });
  it("keeps an already-prefixed number as-is", () => {
    expect(captainWhatsappUrl(team({ captain_phone: "1 (939) 332-5639" }), "pago"))
      .toContain("https://wa.me/19393325639?text=");
  });
  it("returns null when the phone has no digits", () => {
    expect(captainWhatsappUrl(team({ captain_phone: "n/a" }), "seguimiento")).toBeNull();
  });
});
