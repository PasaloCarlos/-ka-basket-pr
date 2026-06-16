import { createAdminClient } from "@/lib/supabase/admin";

// Conteo de equipos inscritos por formato (1v1/2v2/5v5), agregando ambas
// divisiones. Usa el cliente service-role porque `teams` es RLS deny-all al
// anon. Excluye equipos cancelados para que la prueba social sea honesta.
export type CategoryCounts = Record<string, number>;

export async function getCategoryCounts(): Promise<CategoryCounts> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("teams")
    .select("status, tournaments(format)")
    .neq("status", "cancelled");

  const counts: CategoryCounts = {};
  for (const row of data ?? []) {
    // tournaments es una relación a-uno → objeto (no arreglo).
    const format = (row as { tournaments: { format: string } | null }).tournaments?.format;
    if (format) counts[format] = (counts[format] ?? 0) + 1;
  }
  return counts;
}
