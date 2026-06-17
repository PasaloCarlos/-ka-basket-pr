"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import type { TeamWithDetails } from "@/types";

const SELECT = "*, tournaments(name, format, division), players(name, jersey_number)";

// Matches by exact lookup_code (upper-cased) OR partial team_name (ilike).
// Empty query returns recent confirmed teams (the day-of working set).
export async function findTeamsForCheckin(query: string): Promise<TeamWithDetails[]> {
  await requireAdmin();
  const supabase = createAdminClient();
  const clean = query.trim();

  if (!clean) {
    const { data } = await supabase
      .from("teams")
      .select(SELECT)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(25);
    return (data as TeamWithDetails[] | null) ?? [];
  }

  const { data } = await supabase
    .from("teams")
    .select(SELECT)
    .or(`lookup_code.eq.${clean.toUpperCase()},team_name.ilike.%${clean}%`)
    .order("created_at", { ascending: false })
    .limit(25);
  return (data as TeamWithDetails[] | null) ?? [];
}

export async function setCheckedIn(teamId: string, value: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  // The on_team_checked_in trigger stamps/clears checked_in_at.
  const { error } = await supabase.from("teams").update({ checked_in: value }).eq("id", teamId);
  if (error) throw new Error("Error al actualizar la llegada.");
  revalidatePath("/admin/checkin");
  revalidatePath("/admin");
}
