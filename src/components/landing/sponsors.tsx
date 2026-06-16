import Link from "next/link";
import Image from "next/image";
import { Handshake } from "lucide-react";
import { event } from "@/config/event.config";
import { whatsappUrl } from "@/lib/format";
import { WhatsAppIcon } from "@/components/shared/icons";
import { buttonVariants } from "@/components/ui/button";

export function Sponsors() {
  if (!event.sponsors.enabled) return null;

  const { title, intro, ctaText, items } = event.sponsors;
  const wa = whatsappUrl();

  return (
    <section id="auspiciadores" className="relative px-6 py-20">
      <div className="mx-auto max-w-5xl text-center">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">{title}</p>

        {items.length > 0 ? (
          <>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{intro}</p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-8">
              {items.map((s) => {
                const logo = (
                  <Image
                    src={s.logo}
                    alt={s.name}
                    width={200}
                    height={80}
                    className="h-12 w-auto object-contain opacity-70 grayscale transition-all hover:opacity-100 hover:grayscale-0 sm:h-14"
                  />
                );
                return s.url ? (
                  <Link key={s.name} href={s.url} target="_blank" rel="noopener noreferrer">
                    {logo}
                  </Link>
                ) : (
                  <span key={s.name}>{logo}</span>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mx-auto mt-6 max-w-2xl rounded-3xl border border-primary/30 bg-card/70 px-8 py-12 glow-orange">
            <Handshake className="mx-auto size-10 text-primary" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase sm:text-4xl">
              {ctaText}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Apoya el baloncesto femenino y juvenil en el Este de Puerto Rico. Tu marca, frente a
              toda la comunidad del torneo.
            </p>
            {wa && (
              <Link
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ className: "mt-7" })}
              >
                <WhatsAppIcon className="size-4" /> Quiero auspiciar
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
