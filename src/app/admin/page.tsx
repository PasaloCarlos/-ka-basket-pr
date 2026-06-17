import { listTeams } from "@/actions/admin";
import { getDashboardStats } from "@/actions/dashboard";
import { TeamsTable } from "@/components/admin/teams-table";
import { StatsBoard } from "@/components/admin/stats-board";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata = {
  title: "Admin — Equipos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [teams, stats] = await Promise.all([listTeams(), getDashboardStats()]);

  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Administración</p>
          <h1 className="mt-1 font-display text-5xl font-black uppercase">Panel</h1>
        </header>
        <StatsBoard stats={stats} />
        <TeamsTable teams={teams} />
      </div>
    </main>
  );
}
