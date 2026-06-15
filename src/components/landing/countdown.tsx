"use client";

import { useEffect, useState } from "react";
import { event } from "@/config/event.config";

function diff(target: number, now: number) {
  const ms = Math.max(0, target - now);
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

const UNITS: { key: keyof ReturnType<typeof diff>; label: string }[] = [
  { key: "days", label: "Días" },
  { key: "hours", label: "Horas" },
  { key: "minutes", label: "Min" },
  { key: "seconds", label: "Seg" },
];

export function Countdown() {
  const target = event.details.date ? new Date(event.details.date).getTime() : null;
  // Start null so SSR and the first client render agree; fill in after mount to
  // avoid a hydration mismatch on the live (per-second) values.
  const [parts, setParts] = useState<ReturnType<typeof diff> | null>(null);

  useEffect(() => {
    if (!target) return;
    const update = () => setParts(diff(target, Date.now()));
    const first = setTimeout(update, 0); // first value just after mount (in a callback, not sync)
    const id = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [target]);

  // Renders nothing until a real date is configured and the timer has mounted.
  if (!target || !parts) return null;

  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Cuenta regresiva</p>
        <div className="mt-6 grid grid-cols-4 gap-3 sm:gap-5">
          {UNITS.map((u) => (
            <div key={u.key} className="rounded-2xl border border-border bg-card/70 py-5">
              <div className="font-display text-4xl font-black text-foreground tabular-nums sm:text-6xl">
                {String(parts[u.key]).padStart(2, "0")}
              </div>
              <div className="mt-1 font-display text-xs uppercase tracking-widest text-muted-foreground">
                {u.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
