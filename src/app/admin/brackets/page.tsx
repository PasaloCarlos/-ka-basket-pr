import { listBracketsAdmin } from "@/actions/brackets";
import { AdminNav } from "@/components/admin/admin-nav";
import { BracketsAdmin } from "@/components/admin/brackets-admin";

export const metadata = {
  title: "Admin — Brackets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminBracketsPage() {
  const brackets = await listBracketsAdmin();
  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Administración</p>
          <h1 className="mt-1 font-display text-5xl font-black uppercase">Brackets</h1>
        </header>
        <BracketsAdmin brackets={brackets} />
      </div>
    </main>
  );
}
