import { describe, it, expect } from "vitest";
import { buildDashboardStats, type DashboardTournament, type DashboardTeamRow } from "@/lib/dashboard";

const tournaments: DashboardTournament[] = [
  { id: "A", name: "1v1 F", division: "female", format: "1v1", max_teams: 4 },
  { id: "B", name: "5v5 F", division: "female", format: "5v5", max_teams: null },
];
const teams: DashboardTeamRow[] = [
  { tournament_id: "A", status: "confirmed", paid: true, checked_in: true, player_count: 1 },
  { tournament_id: "A", status: "pending", paid: false, checked_in: false, player_count: 1 },
  { tournament_id: "A", status: "cancelled", paid: false, checked_in: false, player_count: 1 },
  { tournament_id: "B", status: "confirmed", paid: true, checked_in: false, player_count: 5 },
];

describe("buildDashboardStats", () => {
  it("computes totals across all teams (cancelled included in totals)", () => {
    const s = buildDashboardStats(tournaments, teams, { amount: null, basis: "team" });
    expect(s.totals).toEqual({ teams: 4, pending: 1, confirmed: 2, cancelled: 1, paid: 2, checkedIn: 1 });
  });
  it("builds per-category rows with non-cancelled count + max, including empty tournaments", () => {
    const s = buildDashboardStats(tournaments, teams, { amount: null, basis: "team" });
    const a = s.categories.find((c) => c.tournamentId === "A")!;
    expect(a).toMatchObject({ count: 2, max: 4, confirmed: 1, pending: 1, checkedIn: 1 });
    const b = s.categories.find((c) => c.tournamentId === "B")!;
    expect(b).toMatchObject({ count: 1, max: null, confirmed: 1 });
  });
  it("omits revenue when price amount is null", () => {
    expect(buildDashboardStats(tournaments, teams, { amount: null, basis: "team" }).revenue).toBeNull();
  });
  it("computes revenue per team basis (non-cancelled projected, paid collected)", () => {
    const s = buildDashboardStats(tournaments, teams, { amount: 10, basis: "team" });
    // non-cancelled teams = 3 -> projected 30; paid teams = 2 -> collected 20
    expect(s.revenue).toEqual({ projected: 30, collected: 20 });
  });
  it("computes revenue per player basis (sums player_count)", () => {
    const s = buildDashboardStats(tournaments, teams, { amount: 10, basis: "player" });
    // non-cancelled players = 1+1+5 = 7 -> 70; paid players = 1+5 = 6 -> 60
    expect(s.revenue).toEqual({ projected: 70, collected: 60 });
  });
});
