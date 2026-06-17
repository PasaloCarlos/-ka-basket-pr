"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Trash2, DollarSign, RotateCcw } from "lucide-react";
import { confirmTeam, setPaid, deleteTeam, adminLogout } from "@/actions/admin";
import { event } from "@/config/event.config";
import type { TeamWithDetails, RegistrationStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { captainWhatsappUrl, type WhatsAppTemplateKey } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/shared/icons";

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
};

const FILTERS: { key: "all" | RegistrationStatus; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendientes" },
  { key: "confirmed", label: "Confirmados" },
  { key: "cancelled", label: "Cancelados" },
];

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 px-5 py-4">
      <p className="font-display text-4xl font-black text-primary tabular-nums">{value}</p>
      <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

const WA_ITEMS: { key: WhatsAppTemplateKey; label: string }[] = [
  { key: "confirmacion", label: "Confirmación" },
  { key: "pago", label: "Recordatorio de pago" },
  { key: "seguimiento", label: "Seguimiento general" },
];

function WhatsAppMenu({ team }: { team: TeamWithDetails }) {
  const [open, setOpen] = useState(false);
  // If the captain phone has no usable digits, hide the control entirely.
  if (!captainWhatsappUrl(team, "seguimiento")) return null;
  return (
    <div className="relative">
      <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
        <WhatsAppIcon className="size-4 text-[#25D366]" /> WhatsApp
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            {WA_ITEMS.map((item) => {
              const url = captainWhatsappUrl(team, item.key)!;
              return (
                <a
                  key={item.key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 text-sm text-foreground hover:bg-secondary/60"
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function TeamsTable({ teams }: { teams: TeamWithDetails[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | RegistrationStatus>("all");

  const counts = {
    total: teams.length,
    confirmed: teams.filter((t) => t.status === "confirmed").length,
    paid: teams.filter((t) => t.paid).length,
  };

  const visible = filter === "all" ? teams : teams.filter((t) => t.status === filter);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Equipos" value={counts.total} />
          <Stat label="Confirmados" value={counts.confirmed} />
          <Stat label="Pagados" value={counts.paid} />
        </div>
        <form action={adminLogout}>
          <Button type="submit" variant="ghost" size="sm">
            Cerrar sesión
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-4 py-1.5 font-display text-sm uppercase tracking-wider transition-colors ${
              filter === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">
          No hay equipos en esta vista.
        </p>
      ) : (
        <div className="space-y-4">
          {visible.map((team) => (
            <article key={team.id} className="rounded-2xl border border-border bg-card/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-2xl font-black uppercase">{team.team_name}</h3>
                    <span className="font-display text-xs tracking-[0.2em] text-primary">
                      {team.lookup_code}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {team.tournaments?.name ?? "—"} · {event.divisions[team.division].label}
                    {team.age_bracket ? ` · ${team.age_bracket}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge
                    variant={
                      team.status === "confirmed"
                        ? "confirmed"
                        : team.status === "cancelled"
                          ? "cancelled"
                          : "pending"
                    }
                  >
                    {STATUS_LABEL[team.status]}
                  </Badge>
                  <Badge variant={team.paid ? "paid" : "unpaid"}>
                    {team.paid ? "Pagado" : "Sin pagar"}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <p>
                  <span className="text-foreground">{team.captain_name}</span> · {team.captain_phone}
                  {team.captain_email ? ` · ${team.captain_email}` : ""}
                </p>
                <p>
                  Roster: {team.players.map((p) => p.name).join(", ") || "—"}
                </p>
              </div>
              {team.notes && <p className="mt-2 text-sm italic text-muted-foreground">“{team.notes}”</p>}

              <div className="mt-4 flex flex-wrap gap-2">
                <WhatsAppMenu team={team} />
                {team.status !== "confirmed" && (
                  <Button size="sm" disabled={pending} onClick={() => act(() => confirmTeam(team.id, "confirmed"), "Equipo confirmado")}>
                    <Check className="size-4" /> Confirmar
                  </Button>
                )}
                {team.status !== "pending" && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => confirmTeam(team.id, "pending"), "Marcado pendiente")}>
                    <RotateCcw className="size-4" /> Pendiente
                  </Button>
                )}
                {team.status !== "cancelled" && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => confirmTeam(team.id, "cancelled"), "Equipo cancelado")}>
                    <X className="size-4" /> Cancelar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={team.paid ? "ghost" : "secondary"}
                  disabled={pending}
                  onClick={() => act(() => setPaid(team.id, !team.paid), team.paid ? "Pago retirado" : "Pago marcado")}
                >
                  <DollarSign className="size-4" /> {team.paid ? "Quitar pago" : "Marcar pagado"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`¿Eliminar el equipo "${team.team_name}"? Esta acción no se puede deshacer.`)) {
                      act(() => deleteTeam(team.id), "Equipo eliminado");
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
