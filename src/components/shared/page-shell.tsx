import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { event } from "@/config/event.config";

export function PageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-dvh px-6 pb-24">
      <nav className="mx-auto flex max-w-2xl items-center justify-between py-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-display text-sm uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Inicio
        </Link>
        <Link href="/" className="flex items-center gap-2">
          <Image src={event.brand.logo} alt={event.brand.name} width={30} height={30} className="rounded-md ring-1 ring-primary/40" />
          <span className="font-display text-sm font-black uppercase">{event.brand.name}</span>
        </Link>
      </nav>

      <header className="court-lines mx-auto mb-10 max-w-2xl pt-8 text-center">
        {eyebrow && (
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">{eyebrow}</p>
        )}
        <h1 className="mt-2 font-display text-4xl font-black uppercase sm:text-6xl">{title}</h1>
        {intro && <p className="mx-auto mt-4 max-w-md text-muted-foreground">{intro}</p>}
      </header>

      {children}
    </main>
  );
}
