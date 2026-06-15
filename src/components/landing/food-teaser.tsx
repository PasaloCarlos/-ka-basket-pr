import { UtensilsCrossed } from "lucide-react";
import { event } from "@/config/event.config";

export function FoodTeaser() {
  return (
    <section id="comida" className="relative px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card/70 px-8 py-14 text-center glow-orange">
          <UtensilsCrossed className="mx-auto size-10 text-primary" />
          <h2 className="mt-5 font-display text-4xl font-black uppercase sm:text-5xl">
            {event.food.title}
          </h2>
          <p className="mt-4 font-display text-2xl uppercase tracking-wide text-primary">
            {event.food.teaser}
          </p>
        </div>
      </div>
    </section>
  );
}
