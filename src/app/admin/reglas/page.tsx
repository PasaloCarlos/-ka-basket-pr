import { getRulesBody } from "@/lib/settings";
import { AdminNav } from "@/components/admin/admin-nav";
import { RulesEditor } from "@/components/admin/rules-editor";
import { event } from "@/config/event.config";

export const metadata = {
  title: "Admin — Reglas",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminRulesPage() {
  const body = await getRulesBody();
  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Administración</p>
          <h1 className="mt-1 font-display text-5xl font-black uppercase">{event.tournament.rulesTitle}</h1>
        </header>
        <RulesEditor initial={body} />
      </div>
    </main>
  );
}
