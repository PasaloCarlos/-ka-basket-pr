import Link from "next/link";
import Image from "next/image";
import { event } from "@/config/event.config";
import { buttonVariants } from "@/components/ui/button";
import { Hero } from "@/components/landing/hero";
import { Countdown } from "@/components/landing/countdown";
import { Categories } from "@/components/landing/categories";
import { EventInfo } from "@/components/landing/event-info";
import { FoodTeaser } from "@/components/landing/food-teaser";
import { Sponsors } from "@/components/landing/sponsors";
import { SiteFooter } from "@/components/landing/site-footer";
import { getCategoryCapacity } from "@/lib/stats";

export default async function HomePage() {
  const capacity = await getCategoryCapacity();

  return (
    <main className="relative pb-20 sm:pb-0">
      {/* Sticky top bar */}
      <nav className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src={event.brand.logo}
              alt={event.brand.name}
              width={36}
              height={36}
              className="rounded-md ring-1 ring-primary/40"
            />
            <span className="hidden font-display text-lg font-black uppercase tracking-wide min-[380px]:inline">
              {event.brand.name}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {event.tournament.enabled && (
              <Link
                href="/torneo"
                className="hidden font-display text-sm uppercase tracking-widest text-muted-foreground hover:text-foreground sm:inline"
              >
                {event.tournament.navLabel}
              </Link>
            )}
            <Link
              href="#categorias"
              className="hidden font-display text-sm uppercase tracking-widest text-muted-foreground hover:text-foreground sm:inline"
            >
              Categorías
            </Link>
            <Link href="/registro" className={buttonVariants({ size: "sm" })}>
              Inscríbete
            </Link>
          </div>
        </div>
      </nav>

      <Hero />
      <Countdown />
      <Categories capacity={capacity} />
      <EventInfo />
      <FoodTeaser />
      <Sponsors />
      <SiteFooter />

      {/* Persistent thumb-reach CTA — phones only */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 p-3 backdrop-blur-md sm:hidden">
        <Link href="/registro" className={buttonVariants({ size: "lg", className: "w-full" })}>
          Inscribe tu equipo
        </Link>
      </div>
    </main>
  );
}
