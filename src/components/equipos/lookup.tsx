"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { lookupRegistration } from "@/actions/registrations";
import { event } from "@/config/event.config";
import type { TeamWithDetails, RegistrationStatus } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LookupQr } from "@/components/shared/qr-code";

const STATUS: Record<RegistrationStatus, { label: string; variant: "pending" | "confirmed" | "cancelled" }> = {
  pending: { label: "Pendiente", variant: "pending" },
  confirmed: { label: "Confirmado", variant: "confirmed" },
  cancelled: { label: "Cancelado", variant: "cancelled" },
};

export function TeamLookup() {
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code")?.toUpperCase() ?? "");
  const [pending, startTransition] = useTransition();
  const [team, setTeam] = useState<TeamWithDetails | null>(null);
  const [notFound, setNotFound] = useState(false);
  const auto = useRef(false);

  function run(value: string) {
    const clean = value.trim().toUpperCase();
    if (!clean) return;
    startTransition(async () => {
      const result = await lookupRegistration(clean);
      setTeam(result);
      setNotFound(!result);
    });
  }

  useEffect(() => {
    if (!auto.current && code) {
      auto.current = true;
      run(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(code);
        }}
        className="flex gap-3"
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Tu código (ej. A1B2C3)"
          maxLength={6}
          className="font-display text-lg tracking-[0.3em]"
          aria-label="Código de inscripción"
        />
        <Button type="submit" disabled={pending}>
          <Search className="size-4" /> {pending ? "..." : "Buscar"}
        </Button>
      </form>

      {notFound && (
        <p className="mt-6 rounded-xl border border-border bg-card/60 p-5 text-center text-muted-foreground">
          No encontramos una inscripción con ese código. Verifica e inténtalo de nuevo.
        </p>
      )}

      {team && (
        <div className="mt-6 rounded-2xl border border-border bg-card/80 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-3xl font-black uppercase">{team.team_name}</h2>
            <div className="flex gap-2">
              <Badge variant={STATUS[team.status].variant}>{STATUS[team.status].label}</Badge>
              <Badge variant={team.paid ? "paid" : "unpaid"}>
                {team.paid ? "Pagado" : "Sin pagar"}
              </Badge>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-display text-xs uppercase tracking-widest text-muted-foreground">Torneo</dt>
              <dd className="text-foreground">{team.tournaments?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-display text-xs uppercase tracking-widest text-muted-foreground">Categoría</dt>
              <dd className="text-foreground">
                {event.divisions[team.division].label}
                {team.age_bracket ? ` · ${team.age_bracket}` : ""}
              </dd>
            </div>
            <div>
              <dt className="font-display text-xs uppercase tracking-widest text-muted-foreground">Capitán</dt>
              <dd className="text-foreground">{team.captain_name}</dd>
            </div>
            <div>
              <dt className="font-display text-xs uppercase tracking-widest text-muted-foreground">Código</dt>
              <dd className="font-display tracking-[0.2em] text-primary">{team.lookup_code}</dd>
            </div>
          </dl>

          {team.players.length > 0 && (
            <div className="mt-5">
              <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">Roster</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {team.players.map((p, i) => (
                  <li key={i} className="rounded-lg border border-border bg-secondary/50 px-3 py-1 text-sm">
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-col items-center gap-3 border-t border-border pt-5">
            <LookupQr code={team.lookup_code} />
            <p className="text-center text-xs text-muted-foreground">
              Muestra este código en la entrada. {event.details.paymentNote}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
