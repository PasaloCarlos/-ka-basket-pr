"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { adminLogin } from "@/actions/admin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handle(formData: FormData) {
    setError(null);
    startTransition(async () => {
      // On success this server action redirects; only failures return here.
      const result = await adminLogin(formData);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <form action={handle} className="mx-auto max-w-sm space-y-5 rounded-2xl border border-border bg-card/80 p-8">
      <div className="flex flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-full border border-primary/40 text-primary">
          <Lock className="size-5" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-black uppercase">Panel del evento</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acceso solo para administración.</p>
      </div>
      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" required autoFocus />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
