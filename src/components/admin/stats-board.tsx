"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { event } from "@/config/event.config";
import { setMaxTeams } from "@/actions/admin";
import type { DashboardStats, DashboardCategory } from "@/lib/dashboard";

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 px-5 py-4">
      <p className="font-display text-4xl font-black text-primary tabular-nums">{value}</p>
      <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

function CapCell({ cat }: { cat: DashboardCategory }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(cat.max?.toString() ?? "");

  function save() {
    const parsed = value.trim() === "" ? null : Number(value);
    if (parsed != null && (!Number.isFinite(parsed) || parsed <= 0)) {
      toast.error("Cupo inválido");
      setValue(cat.max?.toString() ?? "");
      return;
    }
    startTransition(async () => {
      try {
        await setMaxTeams(cat.tournamentId, parsed);
        toast.success("Cupo actualizado");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <input
      type="number"
      min={1}
      inputMode="numeric"
      disabled={pending}
      value={value}
      placeholder="∞"
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="h-9 w-20 rounded-lg border border-input bg-secondary/40 px-2 text-center text-sm focus-visible:border-primary focus-visible:outline-none"
      aria-label={`Cupo máximo de ${cat.name}`}
    />
  );
}

export function StatsBoard({ stats }: { stats: DashboardStats }) {
  const { totals, categories, revenue } = stats;
  const money = (n: number) => `${event.pricing.currency}${n.toLocaleString("es-PR")}`;

  return (
    <section className="mb-10 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Equipos" value={totals.teams} />
        <Tile label="Confirmados" value={totals.confirmed} />
        <Tile label="Pagados" value={totals.paid} />
        <Tile label="Llegaron" value={totals.checkedIn} />
      </div>

      {revenue && (
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Recaudo proyectado" value={money(revenue.projected)} />
          <Tile label="Recaudo cobrado" value={money(revenue.collected)} />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-left font-display text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-3 py-3 text-center">Inscritos</th>
              <th className="px-3 py-3 text-center">Conf.</th>
              <th className="px-3 py-3 text-center">Llegaron</th>
              <th className="px-3 py-3 text-center">Cupo máx.</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.tournamentId} className="border-t border-border">
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground">{c.name}</span>{" "}
                  <span className="text-muted-foreground">· {event.divisions[c.division].label}</span>
                </td>
                <td className="px-3 py-3 text-center tabular-nums">
                  {c.count}
                  {c.max != null && <span className="text-muted-foreground"> / {c.max}</span>}
                </td>
                <td className="px-3 py-3 text-center tabular-nums">{c.confirmed}</td>
                <td className="px-3 py-3 text-center tabular-nums">{c.checkedIn}</td>
                <td className="px-3 py-3 text-center">
                  <CapCell cat={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
