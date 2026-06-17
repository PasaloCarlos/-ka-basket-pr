import { Trophy } from "lucide-react";
import { roundLabel } from "@/lib/bracket";
import type { PublicBracket, PublicMatch } from "@/lib/brackets-public";

function MatchRow({ name, score, winner }: { name: string | null; score: number | null; winner: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-sm ${winner ? "font-bold text-primary" : "text-foreground"}`}>
        {name ?? "Por definir"}
      </span>
      <span className="font-display tabular-nums text-sm text-muted-foreground">{score ?? "—"}</span>
    </div>
  );
}

function MatchCard({ m }: { m: PublicMatch }) {
  if (m.is_bye) {
    return (
      <article className="rounded-xl border border-border/60 bg-card/40 px-4 py-2.5 text-sm text-muted-foreground">
        {m.team1_name ?? m.team2_name ?? "Por definir"} avanza (bye)
      </article>
    );
  }
  // Winner is matched by name because the public shape carries only names (no ids).
  // If two teams shared an identical name both rows would highlight — acceptable for
  // this event app; team names are effectively unique in practice.
  return (
    <article className="space-y-1.5 rounded-xl border border-border bg-card/70 px-4 py-3">
      <MatchRow name={m.team1_name} score={m.score1} winner={!!m.winner_name && m.winner_name === m.team1_name} />
      <div className="border-t border-border/50" />
      <MatchRow name={m.team2_name} score={m.score2} winner={!!m.winner_name && m.winner_name === m.team2_name} />
    </article>
  );
}

export function BracketView({ bracket }: { bracket: PublicBracket }) {
  const totalRounds = bracket.matches.length ? Math.max(...bracket.matches.map((m) => m.round)) : 0;
  const rounds = [...new Set(bracket.matches.map((m) => m.round))].sort((a, b) => a - b);

  // Published but not yet generated (no matches): show a placeholder, not a blank card.
  if (bracket.matches.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-5 sm:p-7">
        <h3 className="font-display text-2xl font-black uppercase sm:text-3xl">{bracket.name}</h3>
        <p className="mt-3 text-sm text-muted-foreground">El bracket se publicará pronto.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 sm:p-7">
      <h3 className="font-display text-2xl font-black uppercase sm:text-3xl">{bracket.name}</h3>

      {bracket.status === "completed" && bracket.champion_name && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-5 py-3 glow-orange">
          <Trophy className="size-6 text-primary" />
          <div>
            <p className="font-display text-xs uppercase tracking-widest text-primary">Campeón</p>
            <p className="font-display text-xl font-black uppercase">{bracket.champion_name}</p>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-6">
        {rounds.map((round) => (
          <div key={round}>
            <h4 className="mb-2 font-display text-sm uppercase tracking-[0.2em] text-muted-foreground">
              {roundLabel(round, totalRounds)}
            </h4>
            <div className="space-y-2.5">
              {bracket.matches
                .filter((m) => m.round === round)
                .sort((a, b) => a.position - b.position)
                .map((m) => (
                  <MatchCard key={m.id} m={m} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
