"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Trophy } from "lucide-react";
import {
  setBracketTeams,
  reorderSeed,
  generateBracket,
  resetBracket,
  recordResult,
  clearResult,
  type PickableTeam,
} from "@/actions/brackets";
import { roundLabel } from "@/lib/bracket";
import type { Database } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Bracket = Database["public"]["Tables"]["brackets"]["Row"];
type BracketTeam = { team_id: string; team_name: string; seed: number };
type Match = Database["public"]["Tables"]["bracket_matches"]["Row"];

export function BracketManager({
  bracket,
  teams,
  matches,
  pickable,
}: {
  bracket: Bracket;
  teams: BracketTeam[];
  matches: Match[];
  pickable: PickableTeam[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isDraft = bracket.status === "draft";
  const selectedIds = new Set(teams.map((t) => t.team_id));

  function act(fn: () => Promise<void>, okMsg: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(okMsg);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  function toggleTeam(teamId: string) {
    const next = new Set(selectedIds);
    if (next.has(teamId)) next.delete(teamId);
    else next.add(teamId);
    const ordered = [
      ...teams.filter((t) => next.has(t.team_id)).map((t) => t.team_id),
      ...[...next].filter((id) => !selectedIds.has(id)),
    ];
    act(() => setBracketTeams(bracket.id, ordered), "Equipos actualizados");
  }

  const totalRounds = matches.length ? Math.max(...matches.map((m) => m.round)) : 0;
  const byRound = matches.reduce<Record<number, Match[]>>((acc, m) => {
    (acc[m.round] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-black uppercase">{bracket.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estado: {bracket.status === "draft" ? "Borrador" : bracket.status === "active" ? "En juego" : "Finalizado"}
          {bracket.champion_name ? ` · 🏆 ${bracket.champion_name}` : ""}
        </p>
      </header>

      {isDraft ? (
        <>
          <section>
            <h2 className="mb-3 font-display text-sm uppercase tracking-[0.3em] text-primary">1 · Elige equipos confirmados</h2>
            {pickable.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay equipos confirmados para esta categoría todavía.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {pickable.map((t) => (
                  <label key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleTeam(t.id)}
                      disabled={pending}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className="text-sm">
                      {t.team_name}
                      {t.age_bracket ? <span className="text-muted-foreground"> · {t.age_bracket}</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {teams.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-sm uppercase tracking-[0.3em] text-primary">2 · Siembra (orden)</h2>
              <ol className="space-y-2">
                {teams.map((t, i) => (
                  <li key={t.team_id} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border font-display text-sm text-primary">
                      {t.seed}
                    </span>
                    <span className="flex-1 text-sm">{t.team_name}</span>
                    <Button size="sm" variant="ghost" disabled={pending || i === 0} onClick={() => act(() => reorderSeed(bracket.id, t.team_id, "up"), "Reordenado")}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pending || i === teams.length - 1} onClick={() => act(() => reorderSeed(bracket.id, t.team_id, "down"), "Reordenado")}>
                      <ArrowDown className="size-4" />
                    </Button>
                  </li>
                ))}
              </ol>
              <Button
                className="mt-5"
                disabled={pending || teams.length < 2}
                onClick={() => act(() => generateBracket(bracket.id), "Bracket generado")}
              >
                Generar bracket ({teams.length} equipos)
              </Button>
              {teams.length < 2 && <p className="mt-2 text-xs text-muted-foreground">Necesitas al menos 2 equipos.</p>}
            </section>
          )}
        </>
      ) : (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm uppercase tracking-[0.3em] text-primary">Partidos</h2>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (confirm("¿Reiniciar el bracket? Se borrarán todos los resultados.")) {
                  act(() => resetBracket(bracket.id), "Bracket reiniciado");
                }
              }}
            >
              Reiniciar
            </Button>
          </div>

          {bracket.status === "completed" && bracket.champion_name && (
            <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-6 py-4 glow-orange">
              <Trophy className="size-7 text-primary" />
              <div>
                <p className="font-display text-xs uppercase tracking-widest text-primary">Campeón</p>
                <p className="font-display text-2xl font-black uppercase">{bracket.champion_name}</p>
              </div>
            </div>
          )}

          {Object.keys(byRound)
            .map(Number)
            .sort((a, b) => a - b)
            .map((round) => (
              <div key={round}>
                <h3 className="mb-3 font-display text-lg font-black uppercase">{roundLabel(round, totalRounds)}</h3>
                <div className="space-y-3">
                  {byRound[round]
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((m) => (
                      // key includes scores so the card remounts (resetting its
                      // local input state) whenever a result is recorded or cleared.
                      <MatchAdminCard
                        key={`${m.id}-${m.score1 ?? "x"}-${m.score2 ?? "x"}`}
                        match={m}
                        pending={pending}
                        act={act}
                      />
                    ))}
                </div>
              </div>
            ))}
        </section>
      )}
    </div>
  );
}

function MatchAdminCard({
  match,
  pending,
  act,
}: {
  match: Match;
  pending: boolean;
  act: (fn: () => Promise<void>, okMsg: string) => void;
}) {
  const [s1, setS1] = useState(match.score1?.toString() ?? "");
  const [s2, setS2] = useState(match.score2?.toString() ?? "");
  const decided = match.winner_team_id != null;
  const ready = match.team1_id && match.team2_id;

  if (match.is_bye) {
    return (
      <article className="rounded-xl border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
        {match.team1_name ?? match.team2_name} avanza (bye)
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-border bg-card/70 px-4 py-3">
      <div className="grid grid-cols-[1fr_auto] items-center gap-2">
        <span className={`text-sm ${match.winner_team_id === match.team1_id ? "font-bold text-primary" : ""}`}>
          {match.team1_name ?? "Por definir"}
        </span>
        <Input
          inputMode="numeric"
          className="h-9 w-16 text-center"
          value={s1}
          disabled={!ready || pending}
          onChange={(e) => setS1(e.target.value.replace(/\D/g, ""))}
        />
        <span className={`text-sm ${match.winner_team_id === match.team2_id ? "font-bold text-primary" : ""}`}>
          {match.team2_name ?? "Por definir"}
        </span>
        <Input
          inputMode="numeric"
          className="h-9 w-16 text-center"
          value={s2}
          disabled={!ready || pending}
          onChange={(e) => setS2(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={!ready || pending || s1 === "" || s2 === ""}
          onClick={() => act(() => recordResult(match.id, Number(s1), Number(s2)), "Resultado guardado")}
        >
          {decided ? "Actualizar" : "Guardar resultado"}
        </Button>
        {decided && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => clearResult(match.id), "Resultado borrado")}>
            Borrar
          </Button>
        )}
      </div>
    </article>
  );
}
