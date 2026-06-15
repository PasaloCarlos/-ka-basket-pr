import { event } from "@/config/event.config";

export function getCategory(slug: string) {
  return event.categories.find((c) => c.slug === slug) ?? null;
}

// How many roster name inputs to render for a category (its max).
export function rosterSlotsFor(slug: string): number {
  return getCategory(slug)?.rosterMax ?? 0;
}

export type RosterValidation =
  | { ok: true; players: string[] }
  | { ok: false; error: string };

export function validateRoster(slug: string, playerNames: string[]): RosterValidation {
  const cat = getCategory(slug);
  if (!cat) return { ok: false, error: "Categoría inválida." };
  const clean = playerNames.map((n) => n.trim()).filter(Boolean);
  if (clean.length < cat.rosterMin || clean.length > cat.rosterMax) {
    const range =
      cat.rosterMin === cat.rosterMax
        ? `${cat.rosterMin} jugador(es)`
        : `entre ${cat.rosterMin} y ${cat.rosterMax} jugador(es)`;
    return {
      ok: false,
      error: `La categoría ${cat.name} requiere ${range}.`,
    };
  }
  return { ok: true, players: clean };
}
