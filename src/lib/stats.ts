import { createAdminClient } from "@/lib/supabase/admin";
import { aggregateFormatCapacity, type CapacityState } from "@/lib/capacity";

// Capacidad por formato (1v1/2v2/5v5), agregando ambas divisiones. Usa el
// cliente service-role porque `teams` es RLS deny-all al anon. Excluye
// cancelados. Sólo cuenta torneos abiertos (is_open).
export type FormatCapacity = CapacityState & { count: number };
export type CategoryCapacity = Record<string, FormatCapacity>;

export async function getCategoryCapacity(): Promise<CategoryCapacity> {
  const supabase = createAdminClient();
  const [{ data: tournaments }, { data: teams }] = await Promise.all([
    supabase.from("tournaments").select("id, format, max_teams").eq("is_open", true),
    supabase.from("teams").select("tournament_id, status").neq("status", "cancelled"),
  ]);

  const perTournament = new Map<string, number>();
  for (const t of teams ?? []) {
    perTournament.set(t.tournament_id, (perTournament.get(t.tournament_id) ?? 0) + 1);
  }

  const byFormat = new Map<string, { count: number; max: number | null }[]>();
  for (const t of tournaments ?? []) {
    const arr = byFormat.get(t.format) ?? [];
    arr.push({ count: perTournament.get(t.id) ?? 0, max: t.max_teams });
    byFormat.set(t.format, arr);
  }

  const result: CategoryCapacity = {};
  for (const [format, items] of byFormat) {
    result[format] = aggregateFormatCapacity(items);
  }
  return result;
}
