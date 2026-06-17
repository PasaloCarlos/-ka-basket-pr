import { CheckinBoard } from "@/components/admin/checkin-board";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata = {
  title: "Admin — Check-in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function CheckinPage() {
  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Día del evento</p>
          <h1 className="mt-1 font-display text-5xl font-black uppercase">Check-in</h1>
        </header>
        <CheckinBoard />
      </div>
    </main>
  );
}
