"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, Camera, Check, DollarSign, LogIn } from "lucide-react";
import { findTeamsForCheckin, setCheckedIn } from "@/actions/checkin";
import { confirmTeam, setPaid } from "@/actions/admin";
import { event } from "@/config/event.config";
import type { TeamWithDetails } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function Toggle({
  on, onLabel, offLabel, icon, pending, onClick,
}: {
  on: boolean; onLabel: string; offLabel: string; icon: React.ReactNode; pending: boolean; onClick: () => void;
}) {
  return (
    <Button size="lg" variant={on ? "secondary" : "primary"} disabled={pending} onClick={onClick} className="flex-1">
      {icon} {on ? onLabel : offLabel}
    </Button>
  );
}

export function CheckinBoard() {
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState<TeamWithDetails[]>([]);
  const [pending, startTransition] = useTransition();
  const [scanning, setScanning] = useState(false);

  function search(q: string) {
    startTransition(async () => {
      try {
        setTeams(await findTeamsForCheckin(q));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  // Load the day-of working set on mount.
  // search is stable within a render cycle — empty deps is intentional.
  useEffect(() => {
    search("");
  }, []);

  function act(fn: () => Promise<void>, okMsg: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(okMsg);
        setTeams(await findTeamsForCheckin(query));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  const confirmedTeams = teams.filter((t) => t.status === "confirmed");
  const arrived = confirmedTeams.filter((t) => t.checked_in).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card/70 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search(query);
          }}
          className="flex gap-3"
        >
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Código o nombre del equipo"
            className="text-lg"
            aria-label="Buscar equipo por código o nombre"
          />
          <Button type="submit" disabled={pending}>
            <Search className="size-4" /> Buscar
          </Button>
          <Button type="button" variant="outline" onClick={() => setScanning((v) => !v)}>
            <Camera className="size-4" /> {scanning ? "Cerrar" : "Escanear"}
          </Button>
        </form>

        {scanning && (
          <QrScanner
            onResult={(code) => {
              setQuery(code);
              setScanning(false);
              search(code);
            }}
            onError={(msg) => {
              toast.error(msg);
              setScanning(false);
            }}
          />
        )}

        <p className="mt-3 font-display text-sm uppercase tracking-widest text-muted-foreground">
          {arrived} de {confirmedTeams.length} equipos llegaron
        </p>
      </div>

      {teams.length === 0 ? (
        <p className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">
          {pending ? "Buscando..." : "No se encontraron equipos."}
        </p>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => (
            <article key={team.id} className="rounded-2xl border border-border bg-card/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-2xl font-black uppercase">{team.team_name}</h3>
                    <span className="font-display text-xs tracking-[0.2em] text-primary">{team.lookup_code}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {team.tournaments?.name ?? "—"} · {event.divisions[team.division].label}
                    {team.age_bracket ? ` · ${team.age_bracket}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Roster: {team.players.map((p) => p.name).join(", ") || "—"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={team.checked_in ? "confirmed" : "pending"}>
                    {team.checked_in ? "Llegó" : "No ha llegado"}
                  </Badge>
                  <Badge variant={team.paid ? "paid" : "unpaid"}>
                    {team.paid ? "Pagado" : "Sin pagar"}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {team.status !== "confirmed" && (
                  <Button size="lg" variant="primary" disabled={pending} onClick={() => act(() => confirmTeam(team.id, "confirmed"), "Equipo confirmado")} className="flex-1">
                    <Check className="size-4" /> Confirmar
                  </Button>
                )}
                <Toggle
                  on={team.checked_in}
                  onLabel="Llegó ✓"
                  offLabel="Marcar llegada"
                  icon={<LogIn className="size-4" />}
                  pending={pending}
                  onClick={() => act(() => setCheckedIn(team.id, !team.checked_in), team.checked_in ? "Llegada retirada" : "Llegada marcada")}
                />
                <Toggle
                  on={team.paid}
                  onLabel="Pagado ✓"
                  offLabel="Marcar pagado"
                  icon={<DollarSign className="size-4" />}
                  pending={pending}
                  onClick={() => act(() => setPaid(team.id, !team.paid), team.paid ? "Pago retirado" : "Pago marcado")}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// Camera QR scanner. html5-qrcode is browser-only — import dynamically in effect.
function QrScanner({ onResult, onError }: { onResult: (code: string) => void; onError: (msg: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled || !ref.current) return;
        const instance = new Html5Qrcode(ref.current.id);
        scanner = instance as unknown as { stop: () => Promise<void>; clear: () => void };
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          (decoded: string) => {
            onResult(decoded.trim().toUpperCase());
          },
          () => {}
        );
      } catch {
        if (!cancelled) onError("No se pudo abrir la cámara. Usa la búsqueda por código.");
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) {
        scanner.stop().then(() => scanner?.clear()).catch(() => {});
      }
    };
  }, [onResult, onError]);

  return <div id="qr-scanner-region" ref={ref} className="mx-auto mt-4 w-full max-w-xs overflow-hidden rounded-xl" />;
}
