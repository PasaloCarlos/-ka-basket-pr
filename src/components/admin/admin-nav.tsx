"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Equipos" },
  { href: "/admin/checkin", label: "Check-in" },
  { href: "/admin/brackets", label: "Brackets" },
  { href: "/admin/reglas", label: "Reglas" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="mb-8 flex flex-wrap gap-2">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full border px-4 py-1.5 font-display text-sm uppercase tracking-wider transition-colors ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
