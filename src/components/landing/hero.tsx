import Image from "next/image";
import Link from "next/link";
import { MapPin, CalendarDays, Ticket } from "lucide-react";
import { event } from "@/config/event.config";
import { buttonVariants } from "@/components/ui/button";
import { InstagramIcon } from "@/components/shared/icons";
import { dateLabel, locationLabel, priceLabel } from "@/lib/format";

function Chip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 backdrop-blur-sm">
      <span className="text-primary">{icon}</span>
      <span className="leading-tight">
        <span className="block font-display text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="block font-display text-lg uppercase text-foreground">{value}</span>
      </span>
    </div>
  );
}

export function Hero() {
  return (
    <section className="court-lines relative overflow-hidden px-6 pt-16 pb-20 sm:pt-24">
      <div className="stagger mx-auto flex max-w-4xl flex-col items-center text-center">
        {/* Logo */}
        <div className="relative mb-8">
          <div className="absolute inset-0 -z-10 rounded-full bg-primary/30 blur-3xl" />
          <Image
            src={event.brand.logo}
            alt={`Logo de ${event.brand.name}`}
            width={132}
            height={132}
            priority
            className="rounded-2xl ring-2 ring-primary/40"
          />
        </div>

        <Link
          href={event.brand.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/40 px-4 py-1.5 font-display text-sm uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          <InstagramIcon className="size-4" />
          {event.brand.instagramHandle}
        </Link>

        <h1 className="font-display font-black leading-[0.9] text-[clamp(2.75rem,13vw,7rem)]">
          <span className="block text-foreground">Torneo de</span>
          <span className="block text-primary drop-shadow-[0_0_30px_oklch(0.685_0.181_47_/_0.5)]">
            Baloncesto
          </span>
        </h1>

        <p className="mt-4 font-display text-lg uppercase tracking-wide text-foreground/90 sm:text-2xl">
          1 vs 1 · 2 vs 2 · 5 vs 5
        </p>

        <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          Un torneo para jugadoras de <span className="text-foreground">todas las edades</span> —
          con categoría masculina abierta.
        </p>

        {/* Detail chips */}
        <div className="mt-9 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          <Chip icon={<CalendarDays className="size-5" />} label="Fecha" value={dateLabel()} />
          <Chip icon={<MapPin className="size-5" />} label="Lugar" value={locationLabel()} />
          <Chip icon={<Ticket className="size-5" />} label="Entrada" value={priceLabel()} />
        </div>

        {/* CTAs */}
        <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href="/registro" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
            Inscribe tu equipo
          </Link>
          <Link
            href="/equipos"
            className={buttonVariants({ variant: "outline", size: "lg", className: "w-full sm:w-auto" })}
          >
            Consulta tu inscripción
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{event.details.paymentNote}</p>
      </div>
    </section>
  );
}
