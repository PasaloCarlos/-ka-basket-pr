"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import {
  createBracket,
  setBracketPublished,
  deleteBracket,
  type AdminBracketRow,
} from "@/actions/brackets";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL = { draft: "Borrador", active: "En juego", completed: "Finalizado" } as const;

export function BracketsAdmin({ brackets }: { brackets: AdminBracketRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

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
      <form
        className="flex flex-col gap-3 sm:flex-row"
        action={() => {
          if (!name.trim()) return;
          act(async () => {
            await createBracket(name);
            setName("");
          }, "Bracket creado");
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Nombre del bracket (ej. 5v5 Femenino Abierta)"
        />
        <Button type="submit" disabled={pending || !name.trim()}>
          Crear bracket
        </Button>
      </form>

      {brackets.length === 0 ? (
        <p className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">
          Aún no hay brackets. Crea el primero arriba.
        </p>
      ) : (
        <div className="space-y-3">
          {brackets.map((b) => (
            <article
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/70 p-5"
            >
              <div>
                <Link href={`/admin/brackets/${b.id}`} className="font-display text-2xl font-black uppercase hover:text-primary">
                  {b.name}
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={b.status === "completed" ? "confirmed" : b.status === "active" ? "paid" : "pending"}>
                    {STATUS_LABEL[b.status]}
                  </Badge>
                  {b.champion_name && (
                    <span className="text-sm text-muted-foreground">🏆 {b.champion_name}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/brackets/${b.id}`}>
                  <Button size="sm" variant="outline">Gestionar</Button>
                </Link>
                <Button
                  size="sm"
                  variant={b.is_published ? "ghost" : "secondary"}
                  disabled={pending}
                  onClick={() => act(() => setBracketPublished(b.id, !b.is_published), b.is_published ? "Oculto" : "Publicado")}
                >
                  {b.is_published ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  {b.is_published ? "Ocultar" : "Publicar"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  aria-label={`Eliminar bracket ${b.name}`}
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`¿Eliminar el bracket "${b.name}"?`)) {
                      act(() => deleteBracket(b.id), "Bracket eliminado");
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
