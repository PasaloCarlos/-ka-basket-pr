import Link from "next/link";
import { notFound } from "next/navigation";
import { event } from "@/config/event.config";
import { getPublishedBrackets } from "@/lib/brackets-public";
import { getRulesBody } from "@/lib/settings";
import { buttonVariants } from "@/components/ui/button";
import { BracketView } from "@/components/torneo/bracket-view";
import { SiteFooter } from "@/components/landing/site-footer";

export const metadata = {
  title: `${event.tournament.pageTitle} — ${event.brand.name}`,
  description: event.tournament.pageIntro,
};

// Live during the event — always reflect the latest published brackets/results
// (matches the admin pages; avoids any static/ISR staleness while games run).
export const dynamic = "force-dynamic";

function RulesBlock({ body }: { body: string }) {
  const lines = body.split("\n");
  return (
    <div className="space-y-2 text-muted-foreground">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        if (trimmed.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-primary">•</span>
              <span>{trimmed.slice(2)}</span>
            </div>
          );
        }
        return <p key={i} className="text-foreground">{trimmed}</p>;
      })}
    </div>
  );
}

export default async function TorneoPage() {
  if (!event.tournament.enabled) notFound();
  const [brackets, rules] = await Promise.all([getPublishedBrackets(), getRulesBody()]);

  return (
    <main className="relative pb-20">
      <nav className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="font-display text-lg font-black uppercase tracking-wide">
            {event.brand.name}
          </Link>
          <Link href="/registro" className={buttonVariants({ size: "sm" })}>
            Inscríbete
          </Link>
        </div>
      </nav>

      <section className="px-6 pt-14 text-center">
        <h1 className="font-display text-5xl font-black uppercase sm:text-7xl">{event.tournament.pageTitle}</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{event.tournament.pageIntro}</p>
      </section>

      <section className="px-6 py-12">
        <div className="mx-auto max-w-3xl space-y-6">
          {brackets.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card/50 p-10 text-center text-muted-foreground">
              {event.tournament.bracketsEmptyLabel}
            </p>
          ) : (
            brackets.map((b) => <BracketView key={b.id} bracket={b} />)
          )}
        </div>
      </section>

      {rules.trim() && (
        <section className="px-6 py-12">
          <div className="mx-auto max-w-3xl rounded-2xl border border-primary/30 bg-card/60 p-7 glow-orange">
            <h2 className="mb-5 font-display text-3xl font-black uppercase">{event.tournament.rulesTitle}</h2>
            <RulesBlock body={rules} />
          </div>
        </section>
      )}

      <SiteFooter />
    </main>
  );
}
