import { notFound } from "next/navigation";
import { getBracketAdmin, listConfirmedTeamsForBracket } from "@/actions/brackets";
import { AdminNav } from "@/components/admin/admin-nav";
import { BracketManager } from "@/components/admin/bracket-manager";

export const metadata = {
  title: "Admin — Gestionar bracket",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ManageBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getBracketAdmin(id);
  if (!data) notFound();
  const pickable = await listConfirmedTeamsForBracket(id);

  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <BracketManager
          bracket={data.bracket}
          teams={data.teams}
          matches={data.matches}
          pickable={pickable}
        />
      </div>
    </main>
  );
}
