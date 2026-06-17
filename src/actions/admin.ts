"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { signSession, ADMIN_COOKIE } from "@/lib/admin-session";
import { requireAdmin } from "@/lib/admin-guard";
import type { RegistrationStatus, TeamWithDetails } from "@/types";

export type LoginResult = { ok: false; error: string };

// Returns an error on bad password; redirects to /admin on success.
export async function adminLogin(formData: FormData): Promise<LoginResult> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return { ok: false, error: "ADMIN_PASSWORD no está configurado en el servidor." };
  }
  if (password !== expected) {
    return { ok: false, error: "Contraseña incorrecta." };
  }

  (await cookies()).set(ADMIN_COOKIE, await signSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/admin");
}

export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

export async function listTeams(filter?: {
  tournamentId?: string;
  status?: RegistrationStatus;
}): Promise<TeamWithDetails[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  let query = supabase
    .from("teams")
    .select(
      "*, tournaments(name, format, division), players(name, jersey_number)"
    )
    .order("created_at", { ascending: false });

  if (filter?.tournamentId) query = query.eq("tournament_id", filter.tournamentId);
  if (filter?.status) query = query.eq("status", filter.status);

  const { data } = await query;
  return (data as TeamWithDetails[] | null) ?? [];
}

export async function confirmTeam(teamId: string, status: RegistrationStatus) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("teams").update({ status }).eq("id", teamId);
  if (error) throw new Error("Error al actualizar el estado.");
  revalidatePath("/admin");
  revalidatePath("/"); // cancelar/reactivar cambia el contador público
}

export async function setPaid(teamId: string, paid: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  // The on_team_paid trigger stamps/clears paid_at.
  const { error } = await supabase.from("teams").update({ paid }).eq("id", teamId);
  if (error) throw new Error("Error al actualizar el pago.");
  revalidatePath("/admin");
}

export async function deleteTeam(teamId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  // players cascade via FK
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) throw new Error("Error al eliminar el equipo.");
  revalidatePath("/admin");
  revalidatePath("/"); // eliminar baja el contador público
}

export async function setMaxTeams(tournamentId: string, max: number | null) {
  await requireAdmin();
  const supabase = createAdminClient();
  const value = max != null && max > 0 ? Math.floor(max) : null;
  const { error } = await supabase
    .from("tournaments")
    .update({ max_teams: value })
    .eq("id", tournamentId);
  if (error) throw new Error("Error al actualizar el cupo.");
  revalidatePath("/admin");
  revalidatePath("/");
}
