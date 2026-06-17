"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { generateSingleElim, applyResult, type Seed } from "@/lib/bracket";

// ---------- Admin reads (gated; used by protected RSC pages) ----------

export type AdminBracketRow = {
  id: string;
  name: string;
  status: "draft" | "active" | "completed";
  is_published: boolean;
  champion_name: string | null;
};

export async function listBracketsAdmin(): Promise<AdminBracketRow[]> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("brackets")
    .select("id, name, status, is_published, champion_name")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as AdminBracketRow[] | null) ?? [];
}

export async function getBracketAdmin(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: bracket } = await supabase
    .from("brackets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!bracket) return null;

  const { data: teams } = await supabase
    .from("bracket_teams")
    .select("team_id, team_name, seed")
    .eq("bracket_id", id)
    .order("seed", { ascending: true });

  const { data: matches } = await supabase
    .from("bracket_matches")
    .select("*")
    .eq("bracket_id", id)
    .order("round", { ascending: true })
    .order("position", { ascending: true });

  return { bracket, teams: teams ?? [], matches: matches ?? [] };
}

export type PickableTeam = { id: string; team_name: string; age_bracket: string | null; inBracket: boolean };

export async function listConfirmedTeamsForBracket(bracketId: string): Promise<PickableTeam[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: bracket } = await supabase
    .from("brackets")
    .select("tournament_id")
    .eq("id", bracketId)
    .maybeSingle();

  let q = supabase
    .from("teams")
    .select("id, team_name, age_bracket")
    .eq("status", "confirmed")
    .order("created_at", { ascending: true });
  if (bracket?.tournament_id) q = q.eq("tournament_id", bracket.tournament_id);
  const { data: teams } = await q;

  const { data: inRows } = await supabase
    .from("bracket_teams")
    .select("team_id")
    .eq("bracket_id", bracketId);
  const inSet = new Set((inRows ?? []).map((r) => r.team_id));

  return (teams ?? []).map((t) => ({
    id: t.id,
    team_name: t.team_name,
    age_bracket: t.age_bracket,
    inBracket: inSet.has(t.id),
  }));
}

// ---------- Admin writes ----------

export async function createBracket(name: string, tournamentId?: string | null) {
  await requireAdmin();
  const clean = name.trim();
  if (!clean) throw new Error("El bracket necesita un nombre.");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("brackets")
    .insert({ name: clean, tournament_id: tournamentId ?? null });
  if (error) throw new Error("Error al crear el bracket.");
  revalidatePath("/admin/brackets");
}

export async function setBracketTeams(bracketId: string, teamIds: string[]) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: b } = await supabase.from("brackets").select("status").eq("id", bracketId).maybeSingle();
  if (b?.status !== "draft") throw new Error("Reinicia el bracket para cambiar los equipos.");

  const ids = teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"];
  const { data: teams } = await supabase.from("teams").select("id, team_name").in("id", ids);
  const nameById = new Map((teams ?? []).map((t) => [t.id, t.team_name]));

  await supabase.from("bracket_teams").delete().eq("bracket_id", bracketId);
  if (teamIds.length) {
    const rows = teamIds.map((id, i) => ({
      bracket_id: bracketId,
      team_id: id,
      team_name: nameById.get(id) ?? "—",
      seed: i + 1,
    }));
    const { error } = await supabase.from("bracket_teams").insert(rows);
    if (error) throw new Error("Error al guardar los equipos.");
  }
  revalidatePath(`/admin/brackets/${bracketId}`);
}

export async function reorderSeed(bracketId: string, teamId: string, direction: "up" | "down") {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: b } = await supabase.from("brackets").select("status").eq("id", bracketId).maybeSingle();
  if (b?.status !== "draft") throw new Error("Reinicia el bracket para cambiar la siembra.");

  const { data: rows } = await supabase
    .from("bracket_teams")
    .select("team_id, seed")
    .eq("bracket_id", bracketId)
    .order("seed", { ascending: true });
  const list = rows ?? [];
  const idx = list.findIndex((r) => r.team_id === teamId);
  if (idx === -1) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) return;

  const a = list[idx];
  const c = list[swapIdx];
  await supabase.from("bracket_teams").update({ seed: c.seed }).eq("bracket_id", bracketId).eq("team_id", a.team_id);
  await supabase.from("bracket_teams").update({ seed: a.seed }).eq("bracket_id", bracketId).eq("team_id", c.team_id);
  revalidatePath(`/admin/brackets/${bracketId}`);
}

export async function generateBracket(bracketId: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  // Guard: don't silently wipe recorded results.
  const { data: existing } = await supabase
    .from("bracket_matches")
    .select("id, winner_team_id")
    .eq("bracket_id", bracketId);
  if ((existing ?? []).some((m) => m.winner_team_id)) {
    throw new Error("Ya hay resultados. Reinicia el bracket antes de regenerar.");
  }
  await supabase.from("bracket_matches").delete().eq("bracket_id", bracketId);

  const { data: bteams } = await supabase
    .from("bracket_teams")
    .select("team_id, team_name, seed")
    .eq("bracket_id", bracketId)
    .order("seed", { ascending: true });

  const seeds: Seed[] = (bteams ?? []).map((t) => ({ teamId: t.team_id, teamName: t.team_name }));

  let generated;
  try {
    generated = generateSingleElim(seeds);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "No se pudo generar el bracket.");
  }

  const { data: inserted, error } = await supabase
    .from("bracket_matches")
    .insert(
      generated.map((m) => ({
        bracket_id: bracketId,
        round: m.round,
        position: m.position,
        team1_id: m.team1Id,
        team1_name: m.team1Name,
        team2_id: m.team2Id,
        team2_name: m.team2Name,
        is_bye: m.isBye,
        winner_team_id: m.winnerTeamId,
        winner_name: m.winnerName,
      }))
    )
    .select("id, round, position");
  if (error || !inserted) throw new Error("Error al crear los partidos.");

  const idByKey = new Map<string, string>();
  for (const r of inserted) idByKey.set(`${r.round}-${r.position}`, r.id);

  // Resolve next-match links and propagate bye winners into the next slot.
  for (const m of generated) {
    if (m.nextRound == null) continue;
    const id = idByKey.get(`${m.round}-${m.position}`)!;
    const nextId = idByKey.get(`${m.nextRound}-${m.nextPosition}`)!;
    await supabase
      .from("bracket_matches")
      .update({ next_match_id: nextId, next_slot: m.nextSlot })
      .eq("id", id);
    if (m.isBye && m.winnerTeamId) {
      const patch =
        m.nextSlot === 1
          ? { team1_id: m.winnerTeamId, team1_name: m.winnerName }
          : { team2_id: m.winnerTeamId, team2_name: m.winnerName };
      await supabase.from("bracket_matches").update(patch).eq("id", nextId);
    }
  }

  await supabase
    .from("brackets")
    .update({ status: "active", champion_team_id: null, champion_name: null })
    .eq("id", bracketId);
  revalidatePath(`/admin/brackets/${bracketId}`);
  revalidatePath("/torneo");
}

export async function resetBracket(bracketId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  await supabase.from("bracket_matches").delete().eq("bracket_id", bracketId);
  await supabase
    .from("brackets")
    .update({ status: "draft", champion_team_id: null, champion_name: null })
    .eq("id", bracketId);
  revalidatePath(`/admin/brackets/${bracketId}`);
  revalidatePath("/torneo");
}

export async function recordResult(matchId: string, score1: number, score2: number) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: m } = await supabase.from("bracket_matches").select("*").eq("id", matchId).maybeSingle();
  if (!m) throw new Error("Partido no encontrado.");
  if (!m.team1_id || !m.team2_id) throw new Error("Faltan equipos en este partido.");
  if (score1 < 0 || score2 < 0) throw new Error("Marcador inválido.");

  // Don't let a re-record corrupt an already-advanced tree: if the next match
  // already has a winner, the admin must clear it forward first (mirrors clearResult).
  if (m.next_match_id) {
    const { data: next } = await supabase
      .from("bracket_matches")
      .select("winner_team_id")
      .eq("id", m.next_match_id)
      .maybeSingle();
    if (next?.winner_team_id) {
      throw new Error("Primero borra el resultado del partido siguiente.");
    }
  }

  let winningSlot: 1 | 2;
  try {
    winningSlot = applyResult(score1, score2);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Marcador inválido.");
  }
  const winnerId = winningSlot === 1 ? m.team1_id : m.team2_id;
  const winnerName = winningSlot === 1 ? m.team1_name : m.team2_name;

  await supabase
    .from("bracket_matches")
    .update({ score1, score2, winner_team_id: winnerId, winner_name: winnerName })
    .eq("id", matchId);

  if (m.next_match_id) {
    const patch =
      m.next_slot === 1
        ? { team1_id: winnerId, team1_name: winnerName }
        : { team2_id: winnerId, team2_name: winnerName };
    await supabase.from("bracket_matches").update(patch).eq("id", m.next_match_id);
  } else {
    await supabase
      .from("brackets")
      .update({ status: "completed", champion_team_id: winnerId, champion_name: winnerName })
      .eq("id", m.bracket_id);
  }
  revalidatePath(`/admin/brackets/${m.bracket_id}`);
  revalidatePath("/torneo");
}

export async function clearResult(matchId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: m } = await supabase.from("bracket_matches").select("*").eq("id", matchId).maybeSingle();
  if (!m) throw new Error("Partido no encontrado.");

  if (m.next_match_id) {
    const { data: next } = await supabase
      .from("bracket_matches")
      .select("winner_team_id")
      .eq("id", m.next_match_id)
      .maybeSingle();
    if (next?.winner_team_id) throw new Error("Primero borra el resultado del partido siguiente.");
    const patch =
      m.next_slot === 1
        ? { team1_id: null, team1_name: null }
        : { team2_id: null, team2_name: null };
    await supabase.from("bracket_matches").update(patch).eq("id", m.next_match_id);
  } else {
    await supabase
      .from("brackets")
      .update({ status: "active", champion_team_id: null, champion_name: null })
      .eq("id", m.bracket_id);
  }
  await supabase
    .from("bracket_matches")
    .update({ score1: null, score2: null, winner_team_id: null, winner_name: null })
    .eq("id", matchId);
  revalidatePath(`/admin/brackets/${m.bracket_id}`);
  revalidatePath("/torneo");
}

export async function setBracketPublished(bracketId: string, published: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  await supabase.from("brackets").update({ is_published: published }).eq("id", bracketId);
  revalidatePath("/admin/brackets");
  revalidatePath(`/admin/brackets/${bracketId}`);
  revalidatePath("/torneo");
}

export async function deleteBracket(bracketId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("brackets").delete().eq("id", bracketId);
  if (error) throw new Error("Error al eliminar el bracket.");
  revalidatePath("/admin/brackets");
  revalidatePath("/torneo");
}

export async function saveRules(body: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "rules_body", value: body, updated_at: new Date().toISOString() });
  if (error) throw new Error("Error al guardar las reglas.");
  revalidatePath("/admin/reglas");
  revalidatePath("/torneo");
}
