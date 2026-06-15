import { listTeams } from "@/actions/admin";
import { TeamsTable } from "@/components/admin/teams-table";

export const metadata = {
  title: "Admin — Equipos",
  robots: { index: false, follow: false },
};

// Always render fresh data (admin needs live state).
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const teams = await listTeams();

  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Administración</p>
          <h1 className="mt-1 font-display text-5xl font-black uppercase">Equipos inscritos</h1>
        </header>
        <TeamsTable teams={teams} />
      </div>
    </main>
  );
}
