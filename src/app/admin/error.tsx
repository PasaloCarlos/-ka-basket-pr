"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in logs for debugging; users just see the friendly message.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Ups</p>
      <h1 className="mt-2 font-display text-4xl font-black uppercase">Algo no cargó</h1>
      <p className="mt-3 max-w-sm text-muted-foreground">
        Hubo un problema al cargar el panel. Vuelve a intentarlo; si sigue
        fallando, recarga la página.
      </p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => reset()}>Reintentar</Button>
        <Link href="/">
          <Button variant="outline">Volver al inicio</Button>
        </Link>
      </div>
    </main>
  );
}
