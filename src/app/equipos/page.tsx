import { Suspense } from "react";
import { event } from "@/config/event.config";
import { PageShell } from "@/components/shared/page-shell";
import { TeamLookup } from "@/components/equipos/lookup";

export const metadata = {
  title: `Consulta tu inscripción — ${event.brand.name}`,
};

export default function EquiposPage() {
  return (
    <PageShell
      eyebrow="Consulta"
      title="Mi equipo"
      intro="Ingresa el código que recibiste al inscribir tu equipo para ver su estado."
    >
      <Suspense fallback={<p className="text-center text-muted-foreground">Cargando...</p>}>
        <TeamLookup />
      </Suspense>
    </PageShell>
  );
}
