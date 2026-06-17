// Pure aggregation for the admin dashboard. No I/O — the action feeds it rows.

export type DashboardTournament = {
  id: string;
  name: string;
  division: "female" | "male";
  format: string;
  max_teams: number | null;
};

export type DashboardTeamRow = {
  tournament_id: string;
  status: "pending" | "confirmed" | "cancelled";
  paid: boolean;
  checked_in: boolean;
  player_count: number;
};

export type Pricing = { amount: number | null; basis: "team" | "player" };

export type DashboardCategory = {
  tournamentId: string;
  name: string;
  division: "female" | "male";
  count: number; // non-cancelled
  max: number | null;
  confirmed: number;
  pending: number;
  checkedIn: number;
};

export type DashboardStats = {
  totals: {
    teams: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    paid: number;
    checkedIn: number;
  };
  categories: DashboardCategory[];
  revenue: { projected: number; collected: number } | null;
};

export function buildDashboardStats(
  tournaments: DashboardTournament[],
  teams: DashboardTeamRow[],
  pricing: Pricing
): DashboardStats {
  const totals = {
    teams: teams.length,
    pending: teams.filter((t) => t.status === "pending").length,
    confirmed: teams.filter((t) => t.status === "confirmed").length,
    cancelled: teams.filter((t) => t.status === "cancelled").length,
    paid: teams.filter((t) => t.paid).length,
    checkedIn: teams.filter((t) => t.checked_in).length,
  };

  const categories: DashboardCategory[] = tournaments.map((t) => {
    const rows = teams.filter((r) => r.tournament_id === t.id);
    return {
      tournamentId: t.id,
      name: t.name,
      division: t.division,
      count: rows.filter((r) => r.status !== "cancelled").length,
      max: t.max_teams,
      confirmed: rows.filter((r) => r.status === "confirmed").length,
      pending: rows.filter((r) => r.status === "pending").length,
      checkedIn: rows.filter((r) => r.checked_in).length,
    };
  });

  let revenue: { projected: number; collected: number } | null = null;
  if (pricing.amount != null) {
    const units = (list: DashboardTeamRow[]) =>
      pricing.basis === "player"
        ? list.reduce((sum, t) => sum + t.player_count, 0)
        : list.length;
    const nonCancelled = teams.filter((t) => t.status !== "cancelled");
    const paid = teams.filter((t) => t.paid && t.status !== "cancelled");
    revenue = {
      projected: units(nonCancelled) * pricing.amount,
      collected: units(paid) * pricing.amount,
    };
  }

  return { totals, categories, revenue };
}
