"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { event } from "@/config/event.config";
import {
  buildDashboardStats,
  type DashboardStats,
  type DashboardTournament,
  type DashboardTeamRow,
} from "@/lib/dashboard";

type RawTeam = {
  tournament_id: string;
  status: "pending" | "confirmed" | "cancelled";
  paid: boolean;
  checked_in: boolean;
  players: { id: string }[] | null;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireAdmin();
  const supabase = createAdminClient();

  const [{ data: tournaments }, { data: teams }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, name, division, format, max_teams")
      .order("sort_order", { ascending: true }),
    // Embedded players(id) infers as never with the hand-written Database type;
    // cast at the boundary (same pattern as brackets-public.ts).
    supabase.from("teams").select("tournament_id, status, paid, checked_in, players(id)"),
  ]);

  const tRows: DashboardTournament[] = (tournaments ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    division: t.division,
    format: t.format,
    max_teams: t.max_teams,
  }));

  const teamRows: DashboardTeamRow[] = ((teams ?? []) as unknown as RawTeam[]).map((r) => ({
    tournament_id: r.tournament_id,
    status: r.status,
    paid: r.paid,
    checked_in: r.checked_in,
    player_count: r.players?.length ?? 0,
  }));

  return buildDashboardStats(tRows, teamRows, {
    amount: event.pricing.amount,
    basis: event.pricing.basis,
  });
}
