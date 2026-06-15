import Link from "next/link";
import { event } from "@/config/event.config";
import { InstagramIcon } from "@/components/shared/icons";

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 text-center">
        <p className="font-display text-3xl font-black uppercase text-foreground">
          {event.brand.name}
        </p>
        <p className="max-w-md text-sm text-muted-foreground">{event.brand.tagline}</p>
        <Link
          href={event.brand.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-display text-sm uppercase tracking-widest text-primary transition-colors hover:text-foreground"
        >
          <InstagramIcon className="size-4" />
          {event.brand.instagramHandle}
        </Link>
        <div className="flex gap-5 font-display text-xs uppercase tracking-widest text-muted-foreground">
          <Link href="/registro" className="hover:text-foreground">Inscripción</Link>
          <Link href="/equipos" className="hover:text-foreground">Consultar equipo</Link>
        </div>
        <p className="text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} {event.brand.name} · Hecho en Puerto Rico 🏀
        </p>
      </div>
    </footer>
  );
}
