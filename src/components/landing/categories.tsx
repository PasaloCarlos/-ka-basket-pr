import Link from "next/link";
import { event } from "@/config/event.config";
import { buttonVariants } from "@/components/ui/button";
import type { CategoryCounts } from "@/lib/stats";

function countLabel(n: number): string {
  const { emptyLabel, oneLabel, manyLabel } = event.counter;
  if (n <= 0) return emptyLabel;
  return `${n} ${n === 1 ? oneLabel : manyLabel}`;
}

export function Categories({ counts = {} }: { counts?: CategoryCounts }) {
  return (
    <section id="categorias" className="relative px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <header className="mb-12 text-center">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Categorías</p>
          <h2 className="mt-2 font-display text-4xl font-black sm:text-6xl">Escoge tu cancha</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Inscríbete en división femenina (todas las edades) o masculina. Cada formato tiene su
            propio torneo.
          </p>
        </header>

        <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-3">
          {event.categories.map((cat, i) => {
            const n = counts[cat.slug] ?? 0;
            return (
              <article
                key={cat.slug}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card/70 p-7 transition-all hover:border-primary/60 hover:glow-orange"
              >
                {/* jersey-number watermark */}
                <span className="pointer-events-none absolute -right-3 -top-7 select-none font-display text-[7rem] font-black leading-none text-primary/10 transition-colors group-hover:text-primary/20">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-5xl font-black text-foreground">{cat.name}</h3>
                <p className="mt-3 min-h-[3rem] text-sm text-muted-foreground">{cat.blurb}</p>
                <p className="mt-4 font-display text-xs uppercase tracking-widest text-primary">
                  {cat.detail}
                </p>

                {event.counter.enabled && (
                  <div className="mt-4 flex items-center gap-2 text-xs">
                    <span className="inline-flex size-2 shrink-0 rounded-full bg-primary" />
                    <span className="font-display uppercase tracking-widest text-foreground">
                      {countLabel(n)}
                    </span>
                    {n > 0 && (
                      <span className="text-muted-foreground">· {event.counter.scarcityLabel}</span>
                    )}
                  </div>
                )}

                <Link
                  href={`/registro?cat=${cat.slug}`}
                  className={buttonVariants({ variant: "outline", size: "sm", className: "mt-6 w-full" })}
                >
                  Inscribir {cat.name}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
