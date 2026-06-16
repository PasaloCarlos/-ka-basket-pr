"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveRules } from "@/actions/brackets";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function RulesEditor({ initial }: { initial: string }) {
  const [body, setBody] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Una línea por regla. Las líneas que empiezan con &ldquo;- &rdquo; se muestran como lista.
      </p>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={14}
        maxLength={4000}
        placeholder="- 1v1 a 11 puntos&#10;- 5v5: 2 periodos de 10 min"
      />
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await saveRules(body);
              toast.success("Reglas guardadas");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Error");
            }
          })
        }
      >
        {pending ? "Guardando..." : "Guardar reglas"}
      </Button>
    </div>
  );
}
