import Link from "next/link";
import { event } from "@/config/event.config";
import { InstagramIcon, WhatsAppIcon } from "@/components/shared/icons";
import { whatsappUrl } from "@/lib/format";

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 text-center">
        <p className="font-display text-3xl font-black uppercase text-foreground">
          {event.brand.name}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <Link
            href={event.brand.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-display text-sm uppercase tracking-widest text-primary transition-colors hover:text-foreground"
          >
            <InstagramIcon className="size-4" />
            {event.brand.instagramHandle}
          </Link>
          {whatsappUrl() && (
            <Link
              href={whatsappUrl()!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-display text-sm uppercase tracking-widest text-primary transition-colors hover:text-foreground"
            >
              <WhatsAppIcon className="size-4" />
              Escríbenos por WhatsApp
            </Link>
          )}
        </div>
        <div className="flex gap-5 font-display text-xs uppercase tracking-widest text-muted-foreground">
          <Link href="/registro" className="hover:text-foreground">Inscripción</Link>
          <Link href="/equipos" className="hover:text-foreground">Consultar equipo</Link>
        </div>
        <p className="text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} {event.brand.name} · Hecho en el Este de Puerto Rico 🏀
        </p>
      </div>
    </footer>
  );
}
