"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateRoster } from "@/lib/registration";
import { isRegistrationOpen } from "@/lib/deadline";
import { event } from "@/config/event.config";
import type { TeamWithDetails } from "@/types";

export type RegisterResult =
  | { ok: true; lookupCode: string }
  | { ok: false; error: string };

export async function registerTeam(formData: FormData): Promise<RegisterResult> {
  if (!isRegistrationOpen()) {
    return { ok: false, error: "El periodo de inscripción está cerrado." };
  }

  const categorySlug = String(formData.get("category") ?? "");
  const division = String(formData.get("division") ?? "");
  const ageBracket = String(formData.get("age_bracket") ?? "").trim() || null;
  const teamName = String(formData.get("team_name") ?? "").trim();
  const captainName = String(formData.get("captain_name") ?? "").trim();
  const captainPhone = String(formData.get("captain_phone") ?? "").trim();
  const captainEmail = String(formData.get("captain_email") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const players = formData.getAll("players[]").map((p) => String(p));

  if (!teamName || !captainName || !captainPhone) {
    return { ok: false, error: "Faltan campos obligatorios (equipo, capitán, teléfono)." };
  }
  if (division !== "female" && division !== "male") {
    return { ok: false, error: "División inválida." };
  }

  const roster = validateRoster(categorySlug, players);
  if (!roster.ok) return { ok: false, error: roster.error };

  // Validate age bracket against the configured options for the division.
  const validBrackets = event.divisions[division].brackets as readonly string[];
  if (ageBracket && !validBrackets.includes(ageBracket)) {
    return { ok: false, error: "Categoría de edad inválida." };
  }

  const supabase = createAdminClient();

  // Resolve an OPEN tournament row for this format + division.
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, is_open, max_teams")
    .eq("format", categorySlug)
    .eq("division", division)
    .eq("is_open", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!tournament) {
    return { ok: false, error: "Esta categoría no está disponible por el momento." };
  }

  // Capacity check (count-then-insert; small race acceptable at this scale).
  if (tournament.max_teams != null) {
    const { count } = await supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournament.id)
      .neq("status", "cancelled");
    if ((count ?? 0) >= tournament.max_teams) {
      return { ok: false, error: "Esta categoría alcanzó su cupo máximo." };
    }
  }

  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .insert({
      tournament_id: tournament.id,
      team_name: teamName,
      division,
      age_bracket: ageBracket,
      captain_name: captainName,
      captain_phone: captainPhone,
      captain_email: captainEmail,
      notes,
    })
    .select("id, lookup_code")
    .single();

  if (teamErr || !team) {
    return { ok: false, error: "Error al inscribir el equipo. Inténtalo de nuevo." };
  }

  const { error: playersErr } = await supabase.from("players").insert(
    roster.players.map((name, i) => ({
      team_id: team.id,
      name,
      sort_order: i,
    }))
  );

  if (playersErr) {
    // Roll back the orphaned team so a retry is clean.
    await supabase.from("teams").delete().eq("id", team.id);
    return { ok: false, error: "Error al guardar el roster. Inténtalo de nuevo." };
  }

  revalidatePath("/admin");
  revalidatePath("/"); // refresca el contador de equipos en la landing
  return { ok: true, lookupCode: team.lookup_code };
}

export async function lookupRegistration(code: string): Promise<TeamWithDetails | null> {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("teams")
    .select(
      "*, tournaments(name, format, division), players(name, jersey_number)"
    )
    .eq("lookup_code", clean)
    .maybeSingle();

  return (data as TeamWithDetails | null) ?? null;
}
