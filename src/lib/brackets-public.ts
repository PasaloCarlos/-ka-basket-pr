import { createAdminClient } from "@/lib/supabase/admin";

// Public-safe shapes — NAMES and scores only, never captain phones.
export type PublicMatch = {
  id: string;
  round: number;
  position: number;
  team1_name: string | null;
  team2_name: string | null;
  score1: number | null;
  score2: number | null;
  winner_name: string | null;
  is_bye: boolean;
};

export type PublicBracket = {
  id: string;
  name: string;
  status: "draft" | "active" | "completed";
  champion_name: string | null;
  matches: PublicMatch[];
};

type BracketWithMatches = {
  id: string;
  name: string;
  status: "draft" | "active" | "completed";
  champion_name: string | null;
  sort_order: number | null;
  bracket_matches: PublicMatch[];
};

export async function getPublishedBrackets(): Promise<PublicBracket[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("brackets")
    .select(
      "id, name, status, champion_name, sort_order, bracket_matches(id, round, position, team1_name, team2_name, score1, score2, winner_name, is_bye)"
    )
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  const rows = (data as unknown as BracketWithMatches[] | null) ?? [];
  return rows.map((b) => {
    const matches = (b.bracket_matches ?? [])
      .slice()
      .sort((x, y) => x.round - y.round || x.position - y.position);
    return {
      id: b.id,
      name: b.name,
      status: b.status,
      champion_name: b.champion_name,
      matches,
    };
  });
}
