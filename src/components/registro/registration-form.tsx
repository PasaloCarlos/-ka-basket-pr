"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Copy } from "lucide-react";
import { event, type DivisionKey } from "@/config/event.config";
import type { CategoryCapacity } from "@/lib/stats";
import { registerTeam } from "@/actions/registrations";
import { whatsappUrl } from "@/lib/format";
import { WhatsAppIcon } from "@/components/shared/icons";
import { LookupQr } from "@/components/shared/qr-code";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const selectCls =
  "flex h-11 w-full rounded-lg border border-input bg-secondary/40 px-3.5 text-base text-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40";

export function RegistrationForm({ capacity = {} }: { capacity?: CategoryCapacity }) {
  const params = useSearchParams();
  const initialCat =
    event.categories.find((c) => c.slug === params.get("cat"))?.slug ??
    event.categories[0].slug;

  const [categorySlug, setCategorySlug] = useState<string>(initialCat);
  const [division, setDivision] = useState<DivisionKey>("female");
  const [ageBracket, setAgeBracket] = useState<string>(event.divisions.female.brackets[0]);
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);

  const category = event.categories.find((c) => c.slug === categorySlug)!;
  const slots = Array.from({ length: category.rosterMax });
  const brackets = event.divisions[division].brackets;
  const playerNoun = division === "female" ? "Jugadora" : "Jugador";
  const playerNounPlural = division === "female" ? "jugadoras" : "jugadores";

  function onDivisionChange(value: DivisionKey) {
    setDivision(value);
    setAgeBracket(event.divisions[value].brackets[0]);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await registerTeam(formData);
      if (result.ok) {
        setSuccess(result.lookupCode);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        toast.error(result.error);
      }
    });
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-primary/40 bg-card/80 p-8 text-center glow-orange">
        <CheckCircle2 className="mx-auto size-12 text-primary" />
        <h2 className="mt-4 font-display text-4xl font-black uppercase">¡Equipo inscrito!</h2>
        <p className="mt-3 text-muted-foreground">
          Guarda tu código de inscripción. Lo necesitarás para consultar el estado de tu equipo.
        </p>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(success);
            toast.success("Código copiado");
          }}
          className="mx-auto mt-6 flex items-center gap-3 rounded-xl border border-border bg-secondary/50 px-6 py-4 font-display text-3xl font-black tracking-[0.2em] text-primary transition-colors hover:border-primary"
        >
          {success}
          <Copy className="size-5 text-muted-foreground" />
        </button>
        <div className="mt-6 flex justify-center">
          <LookupQr code={success} />
        </div>
        <div className="mt-6 rounded-xl border border-border bg-secondary/40 px-5 py-4 text-left text-sm text-muted-foreground">
          <p className="font-display text-xs uppercase tracking-widest text-primary">Próximos pasos</p>
          <ul className="mt-2 space-y-1.5">
            <li>📌 Guarda tu código y <span className="text-foreground">preséntalo en la entrada</span> el día del evento.</li>
            <li>💵 {event.details.paymentNote}</li>
            {whatsappUrl() && <li>💬 Te contactaremos por WhatsApp para confirmar tu equipo.</li>}
          </ul>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={`/equipos?code=${success}`}>
            <Button className="w-full sm:w-auto">Ver estado de mi equipo</Button>
          </Link>
          {whatsappUrl() && (
            <Link href={whatsappUrl()!} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" className="w-full sm:w-auto">
                <WhatsAppIcon className="size-4" /> Escríbenos
              </Button>
            </Link>
          )}
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setSuccess(null)}>
            Inscribir otro equipo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-2xl space-y-8">
      {/* Category */}
      <fieldset>
        <legend className="mb-3 font-display text-sm uppercase tracking-[0.3em] text-primary">
          1 · Categoría
        </legend>
        <div className="grid grid-cols-3 gap-3">
          {event.categories.map((c) => {
            const isFull = capacity[c.slug]?.isFull ?? false;
            return (
              <button
                key={c.slug}
                type="button"
                disabled={isFull}
                onClick={() => !isFull && setCategorySlug(c.slug)}
                className={cn(
                  "rounded-xl border px-3 py-4 text-center transition-all",
                  isFull
                    ? "cursor-not-allowed border-border bg-card/40 opacity-50"
                    : categorySlug === c.slug
                      ? "border-primary bg-primary/10 glow-orange"
                      : "border-border bg-card/60 hover:border-primary/50"
                )}
              >
                <span className="block font-display text-2xl font-black text-foreground sm:text-3xl">{c.name}</span>
                {isFull && (
                  <span className="mt-1 block font-display text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                    {event.counter.fullLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="category" value={categorySlug} />
      </fieldset>

      {/* Division + bracket */}
      <fieldset>
        <legend className="mb-3 font-display text-sm uppercase tracking-[0.3em] text-primary">
          2 · División
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="division">División</Label>
            <select
              id="division"
              name="division"
              value={division}
              onChange={(e) => onDivisionChange(e.target.value as DivisionKey)}
              className={selectCls}
            >
              <option value="female">{event.divisions.female.label}</option>
              <option value="male">{event.divisions.male.label}</option>
            </select>
          </div>
          <div>
            <Label htmlFor="age_bracket">Edad / Nivel</Label>
            <select
              id="age_bracket"
              name="age_bracket"
              value={ageBracket}
              onChange={(e) => setAgeBracket(e.target.value)}
              className={selectCls}
            >
              {brackets.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      {/* Team + captain */}
      <fieldset>
        <legend className="mb-3 font-display text-sm uppercase tracking-[0.3em] text-primary">
          3 · Equipo y capitán
        </legend>
        <div className="space-y-4">
          <div>
            <Label htmlFor="team_name">Nombre del equipo *</Label>
            <Input id="team_name" name="team_name" required maxLength={80} placeholder="Las Panteras" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="captain_name">Capitán / contacto *</Label>
              <Input id="captain_name" name="captain_name" required maxLength={80} placeholder="Nombre y apellido" />
            </div>
            <div>
              <Label htmlFor="captain_phone">Teléfono *</Label>
              <Input
                id="captain_phone"
                name="captain_phone"
                type="tel"
                required
                inputMode="tel"
                maxLength={20}
                placeholder="787-555-1234"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="captain_email">Email (opcional)</Label>
            <Input id="captain_email" name="captain_email" type="email" maxLength={120} placeholder="tu@correo.com" />
          </div>
        </div>
      </fieldset>

      {/* Roster */}
      <fieldset key={categorySlug}>
        <legend className="mb-3 font-display text-sm uppercase tracking-[0.3em] text-primary">
          4 · Roster ({category.name})
        </legend>
        <p className="mb-3 text-sm text-muted-foreground">
          {category.rosterMin === category.rosterMax
            ? `Ingresa ${category.rosterMin} ${category.rosterMin === 1 ? playerNoun.toLowerCase() : playerNounPlural}.`
            : `Ingresa entre ${category.rosterMin} y ${category.rosterMax} ${playerNounPlural}. Los espacios extra son opcionales.`}
        </p>
        <div className="space-y-3">
          {slots.map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border font-display text-sm text-primary">
                {i + 1}
              </span>
              <Input
                name="players[]"
                required={i < category.rosterMin}
                maxLength={80}
                placeholder={
                  i < category.rosterMin
                    ? `${playerNoun} ${i + 1} *`
                    : `${playerNoun} ${i + 1} (opcional)`
                }
              />
            </div>
          ))}
        </div>
      </fieldset>

      {/* Notes */}
      <fieldset>
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" name="notes" maxLength={500} placeholder="Algo que debamos saber..." />
      </fieldset>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Inscribiendo..." : "Inscribir equipo"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{event.details.paymentNote}</p>
    </form>
  );
}
