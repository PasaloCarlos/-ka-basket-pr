import { Suspense } from "react";
import Link from "next/link";
import { event } from "@/config/event.config";
import { isRegistrationOpen } from "@/lib/deadline";
import { getCategoryCapacity } from "@/lib/stats";
import { PageShell } from "@/components/shared/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { RegistrationForm } from "@/components/registro/registration-form";

export const metadata = {
  title: `Inscripción — ${event.brand.name}`,
};

export const dynamic = "force-dynamic";

export default async function RegistroPage() {
  const open = isRegistrationOpen();
  const capacity = open ? await getCategoryCapacity() : {};

  return (
    <PageShell
      eyebrow="Inscripción"
      title="Inscribe tu equipo"
      intro={
        open
          ? "Completa los datos de tu equipo. Al terminar recibirás un código para consultar tu estado."
          : undefined
      }
    >
      {open ? (
        <Suspense
          fallback={<p className="text-center text-muted-foreground">Cargando formulario...</p>}
        >
          <RegistrationForm capacity={capacity} />
        </Suspense>
      ) : (
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card/70 p-8 text-center">
          <h2 className="font-display text-3xl font-black uppercase text-foreground">
            Inscripción cerrada
          </h2>
          <p className="mt-3 text-muted-foreground">
            El periodo de inscripción no está disponible por el momento. Sigue{" "}
            {event.brand.instagramHandle} para enterarte cuando abra.
          </p>
          <Link href="/" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
            Volver al inicio
          </Link>
        </div>
      )}
    </PageShell>
  );
}
