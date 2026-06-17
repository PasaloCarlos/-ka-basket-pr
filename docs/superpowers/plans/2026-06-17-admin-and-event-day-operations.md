# Admin & Event-Day Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WhatsApp captain outreach, per-category registration caps with auto-close, an event-day check-in door screen (QR scan + generate), and an admin dashboard with stats to the ka-basket-pr admin panel.

**Architecture:** Pure, unit-tested helpers (`capacity`, `whatsapp`, `dashboard`) hold all logic; thin Server Actions (service-role, `requireAdmin()`) fetch DB rows and delegate to them; client components render. One additive migration (`007`) extends `tournaments` (capacity) and `teams` (check-in). Two client-only deps add QR scan/generate.

**Tech Stack:** Next.js 16 (App Router, webpack) · React 19 · TypeScript · Supabase (Postgres, service-role client) · Tailwind 4 · shadcn · vitest · `html5-qrcode` · `qrcode.react`.

## Global Constraints

- Next.js 16: route `params`/`searchParams` are Promises; Server Actions call `revalidatePath` for every surface they change.
- `teams`/`players` are **RLS deny-all** to anon — reach them ONLY via the service-role client (`@/lib/supabase/admin`) inside Server Actions. `tournaments` is publicly readable; `max_teams` is non-sensitive.
- Every admin Server Action calls `await requireAdmin()` as its first line (`@/lib/admin-guard`). Never trust `proxy.ts` alone.
- All editable event copy lives in `src/config/event.config.ts`. Never hardcode Spanish event text in components.
- All UI copy is Spanish (es).
- Commit after every task. Gates before declaring a task done: `npm run lint`, `npm run test`, `npm run build` all clean.
- The hand-written `Database` type has empty `Relationships`, so embedded selects infer as `never`; cast embedded query results with `as unknown as <LocalType>` (same pattern as `src/lib/brackets-public.ts`).
- Do NOT apply migration `007` to Supabase during implementation — the user applies it manually in the SQL editor. Code must build without it applied (reads degrade gracefully).

---

### Task 1: Schema migration, DB types, and config foundation

**Files:**
- Create: `supabase/migrations/007_admin_ops.sql`
- Modify: `src/types/database.ts` (tournaments + teams Row/Insert/Update)
- Modify: `src/config/event.config.ts`

**Interfaces:**
- Produces (config): `event.pricing = { amount: number | null; basis: "team" | "player"; currency: string }`; `event.whatsappTemplates = { confirmacion: string; pago: string; seguimiento: string }`; `event.counter.fullLabel: string`; `event.counter.spotsLeftLabel: string`.
- Produces (types): `tournaments.Row.max_teams: number | null`; `teams.Row.checked_in: boolean`; `teams.Row.checked_in_at: string | null` (and matching Insert/Update optionals).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/007_admin_ops.sql` (idempotent so the user can re-run safely):

```sql
-- ============================================================
-- ADMIN & EVENT-DAY OPERATIONS
-- tournaments.max_teams: per-category capacity (null = unlimited)
-- teams.checked_in / checked_in_at: event-day door check-in
-- ============================================================

alter table public.tournaments
  add column if not exists max_teams int check (max_teams is null or max_teams > 0);

alter table public.teams
  add column if not exists checked_in boolean not null default false;
alter table public.teams
  add column if not exists checked_in_at timestamptz;

-- Stamp checked_in_at on flip-to-true; clear on false (mirrors stamp_paid_at).
create or replace function public.stamp_checked_in_at()
returns trigger as $$
begin
  if new.checked_in = true and (old.checked_in is distinct from true) then
    new.checked_in_at = now();
  elsif new.checked_in = false then
    new.checked_in_at = null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_team_checked_in on public.teams;
create trigger on_team_checked_in
  before update on public.teams
  for each row execute function public.stamp_checked_in_at();
```

- [ ] **Step 2: Update DB types**

In `src/types/database.ts`, add `max_teams: number | null;` to the tournaments `Row` and `max_teams?: number | null;` to its `Insert` and `Update`. Add `checked_in: boolean;` and `checked_in_at: string | null;` to the teams `Row`, and `checked_in?: boolean;` + `checked_in_at?: string | null;` to its `Insert` and `Update`.

- [ ] **Step 3: Add config blocks**

In `src/config/event.config.ts`, add a `fullLabel` and `spotsLeftLabel` to the existing `counter` block:

```ts
  counter: {
    enabled: true,
    scarcityLabel: "cupos limitados",
    emptyLabel: "Sé el primer equipo",
    oneLabel: "equipo inscrito",
    manyLabel: "equipos inscritos",
    fullLabel: "Cupo lleno",
    spotsLeftLabel: "cupos disponibles",
  },
```

And add two new top-level blocks (place after the `sponsors` block):

```ts
  // Precio numérico OPCIONAL para el panel admin (cálculo de recaudo).
  // Distinto de details.price (texto público). amount=null oculta el recaudo.
  pricing: {
    amount: null as number | null, // ej. 10
    basis: "team" as "team" | "player", // ¿el precio es por equipo o por jugador?
    currency: "$",
  },

  // Plantillas de WhatsApp para escribir a capitanes desde /admin.
  // Variables disponibles: {team} {captain} {code} {category}
  whatsappTemplates: {
    confirmacion:
      '¡Hola {captain}! Tu equipo "{team}" ({category}) quedó confirmado para el torneo 🏀. El pago se realiza en la entrada. Tu código es {code}.',
    pago:
      '¡Hola {captain}! Recordatorio: el pago de "{team}" se realiza en la puerta el día del evento. ¡Nos vemos!',
    seguimiento:
      '¡Hola {captain}! Te escribo sobre la inscripción de tu equipo "{team}" en el torneo 🏀.',
  },
```

- [ ] **Step 4: Verify build + typecheck**

Run: `npm run build`
Expected: PASS (compiles; the new config/type fields resolve). The migration file is not executed by the build.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/007_admin_ops.sql src/types/database.ts src/config/event.config.ts
git commit -m "feat(admin-ops): migration 007 + DB types + config (caps, pricing, whatsapp templates)"
```

---

### Task 2: Capacity helper (pure, TDD)

**Files:**
- Create: `src/lib/capacity.ts`
- Test: `src/lib/__tests__/capacity.test.ts`

**Interfaces:**
- Produces: `type CapacityInput = { count: number; max: number | null }`; `type CapacityState = { isFull: boolean; spotsLeft: number | null }`; `capacityState(input: CapacityInput): CapacityState`; `aggregateFormatCapacity(items: CapacityInput[]): CapacityState & { count: number }`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/capacity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { capacityState, aggregateFormatCapacity } from "@/lib/capacity";

describe("capacityState", () => {
  it("is never full and reports null spots when max is null (unlimited)", () => {
    expect(capacityState({ count: 99, max: null })).toEqual({ isFull: false, spotsLeft: null });
  });
  it("reports spots left below the cap", () => {
    expect(capacityState({ count: 3, max: 8 })).toEqual({ isFull: false, spotsLeft: 5 });
  });
  it("is full at the cap", () => {
    expect(capacityState({ count: 8, max: 8 })).toEqual({ isFull: true, spotsLeft: 0 });
  });
  it("clamps spotsLeft to 0 when over the cap", () => {
    expect(capacityState({ count: 10, max: 8 })).toEqual({ isFull: true, spotsLeft: 0 });
  });
});

describe("aggregateFormatCapacity", () => {
  it("returns not-full / null spots for an empty format", () => {
    expect(aggregateFormatCapacity([])).toEqual({ isFull: false, spotsLeft: null, count: 0 });
  });
  it("sums counts across divisions", () => {
    const r = aggregateFormatCapacity([{ count: 2, max: 4 }, { count: 1, max: 4 }]);
    expect(r.count).toBe(3);
    expect(r.spotsLeft).toBe(5);
    expect(r.isFull).toBe(false);
  });
  it("is full only when every capped division is full", () => {
    expect(aggregateFormatCapacity([{ count: 4, max: 4 }, { count: 4, max: 4 }]).isFull).toBe(true);
    expect(aggregateFormatCapacity([{ count: 4, max: 4 }, { count: 1, max: 4 }]).isFull).toBe(false);
  });
  it("is never full and has null spots when any division is uncapped", () => {
    const r = aggregateFormatCapacity([{ count: 9, max: null }, { count: 4, max: 4 }]);
    expect(r.isFull).toBe(false);
    expect(r.spotsLeft).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- capacity`
Expected: FAIL (cannot resolve `@/lib/capacity`).

- [ ] **Step 3: Write the implementation**

Create `src/lib/capacity.ts`:

```ts
// Pure capacity math for registration caps. No I/O.
// Per-tournament cap is the primitive; aggregateFormatCapacity rolls up the
// divisions that share one public category card (e.g. 1v1 femenino + masculino).

export type CapacityInput = { count: number; max: number | null };
export type CapacityState = { isFull: boolean; spotsLeft: number | null };

export function capacityState({ count, max }: CapacityInput): CapacityState {
  if (max == null) return { isFull: false, spotsLeft: null };
  return { isFull: count >= max, spotsLeft: Math.max(0, max - count) };
}

export function aggregateFormatCapacity(
  items: CapacityInput[]
): CapacityState & { count: number } {
  const count = items.reduce((sum, i) => sum + i.count, 0);
  if (items.length === 0) return { isFull: false, spotsLeft: null, count };

  const hasCap = items.some((i) => i.max != null);
  const anyHasSpace = items.some((i) => i.max == null || i.count < i.max);
  const anyUncapped = items.some((i) => i.max == null);

  const spotsLeft = anyUncapped
    ? null
    : items.reduce((sum, i) => sum + Math.max(0, (i.max as number) - i.count), 0);

  return { isFull: hasCap && !anyHasSpace, spotsLeft, count };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- capacity`
Expected: PASS (9 assertions across the two describes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/capacity.ts src/lib/__tests__/capacity.test.ts
git commit -m "feat(admin-ops): pure capacity helper with tests"
```

---

### Task 3: WhatsApp helper (pure, TDD)

**Files:**
- Create: `src/lib/whatsapp.ts`
- Test: `src/lib/__tests__/whatsapp.test.ts`

**Interfaces:**
- Consumes: `event.whatsappTemplates` (Task 1); `TeamWithDetails` from `@/types`.
- Produces: `type WhatsAppTemplateKey = keyof typeof event.whatsappTemplates`; `fillTemplate(tmpl: string, vars: Record<string, string>): string`; `captainWhatsappUrl(team: TeamWithDetails, key: WhatsAppTemplateKey): string | null`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/whatsapp.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fillTemplate, captainWhatsappUrl } from "@/lib/whatsapp";
import type { TeamWithDetails } from "@/types";

describe("fillTemplate", () => {
  it("substitutes {placeholders} from vars", () => {
    expect(fillTemplate("Hola {captain}, equipo {team}", { captain: "Ana", team: "Panteras" }))
      .toBe("Hola Ana, equipo Panteras");
  });
  it("replaces an unknown placeholder with empty string", () => {
    expect(fillTemplate("x {missing} y", {})).toBe("x  y");
  });
});

function team(overrides: Partial<TeamWithDetails> = {}): TeamWithDetails {
  return {
    id: "t1", tournament_id: "tr1", team_name: "Panteras", division: "female",
    age_bracket: "Sub-12", captain_name: "Ana", captain_phone: "787-555-1234",
    captain_email: null, notes: null, status: "confirmed", paid: false, paid_at: null,
    checked_in: false, checked_in_at: null, lookup_code: "A1B2C3",
    created_at: "", updated_at: "",
    tournaments: { name: "2 vs 2 - Femenino", format: "2v2", division: "female" },
    players: [],
    ...overrides,
  } as TeamWithDetails;
}

describe("captainWhatsappUrl", () => {
  it("builds a wa.me link, prepending PR/US country code to a 10-digit number", () => {
    const url = captainWhatsappUrl(team(), "confirmacion");
    expect(url).toContain("https://wa.me/17875551234?text=");
    expect(decodeURIComponent(url!)).toContain("Panteras");
    expect(decodeURIComponent(url!)).toContain("A1B2C3");
    expect(decodeURIComponent(url!)).toContain("2 vs 2 - Femenino");
  });
  it("keeps an already-prefixed number as-is", () => {
    expect(captainWhatsappUrl(team({ captain_phone: "1 (939) 332-5639" }), "pago"))
      .toContain("https://wa.me/19393325639?text=");
  });
  it("returns null when the phone has no digits", () => {
    expect(captainWhatsappUrl(team({ captain_phone: "n/a" }), "seguimiento")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- whatsapp`
Expected: FAIL (cannot resolve `@/lib/whatsapp`).

- [ ] **Step 3: Write the implementation**

Create `src/lib/whatsapp.ts`:

```ts
import { event } from "@/config/event.config";
import type { TeamWithDetails } from "@/types";

export type WhatsAppTemplateKey = keyof typeof event.whatsappTemplates;

export function fillTemplate(tmpl: string, vars: Record<string, string>): string {
  return tmpl.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

// Local numbers are often entered without the country code; wa.me needs it.
function normalizePhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.length === 10 ? `1${digits}` : digits; // 10 digits => assume PR/US
}

export function captainWhatsappUrl(team: TeamWithDetails, key: WhatsAppTemplateKey): string | null {
  const phone = normalizePhone(team.captain_phone);
  if (!phone) return null;
  const text = fillTemplate(event.whatsappTemplates[key], {
    team: team.team_name,
    captain: team.captain_name,
    code: team.lookup_code,
    category: team.tournaments?.name ?? "",
  });
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- whatsapp`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp.ts src/lib/__tests__/whatsapp.test.ts
git commit -m "feat(admin-ops): pure whatsapp template/link helper with tests"
```

---

### Task 4: Dashboard stats builder (pure, TDD)

**Files:**
- Create: `src/lib/dashboard.ts`
- Test: `src/lib/__tests__/dashboard.test.ts`

**Interfaces:**
- Produces:
  - `type DashboardTournament = { id: string; name: string; division: "female" | "male"; format: string; max_teams: number | null }`
  - `type DashboardTeamRow = { tournament_id: string; status: "pending" | "confirmed" | "cancelled"; paid: boolean; checked_in: boolean; player_count: number }`
  - `type Pricing = { amount: number | null; basis: "team" | "player" }`
  - `type DashboardCategory = { tournamentId: string; name: string; division: "female" | "male"; count: number; max: number | null; confirmed: number; pending: number; checkedIn: number }`
  - `type DashboardStats = { totals: { teams: number; pending: number; confirmed: number; cancelled: number; paid: number; checkedIn: number }; categories: DashboardCategory[]; revenue: { projected: number; collected: number } | null }`
  - `buildDashboardStats(tournaments: DashboardTournament[], teams: DashboardTeamRow[], pricing: Pricing): DashboardStats`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/dashboard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildDashboardStats, type DashboardTournament, type DashboardTeamRow } from "@/lib/dashboard";

const tournaments: DashboardTournament[] = [
  { id: "A", name: "1v1 F", division: "female", format: "1v1", max_teams: 4 },
  { id: "B", name: "5v5 F", division: "female", format: "5v5", max_teams: null },
];
const teams: DashboardTeamRow[] = [
  { tournament_id: "A", status: "confirmed", paid: true, checked_in: true, player_count: 1 },
  { tournament_id: "A", status: "pending", paid: false, checked_in: false, player_count: 1 },
  { tournament_id: "A", status: "cancelled", paid: false, checked_in: false, player_count: 1 },
  { tournament_id: "B", status: "confirmed", paid: true, checked_in: false, player_count: 5 },
];

describe("buildDashboardStats", () => {
  it("computes totals across all teams (cancelled included in totals)", () => {
    const s = buildDashboardStats(tournaments, teams, { amount: null, basis: "team" });
    expect(s.totals).toEqual({ teams: 4, pending: 1, confirmed: 2, cancelled: 1, paid: 2, checkedIn: 1 });
  });
  it("builds per-category rows with non-cancelled count + max, including empty tournaments", () => {
    const s = buildDashboardStats(tournaments, teams, { amount: null, basis: "team" });
    const a = s.categories.find((c) => c.tournamentId === "A")!;
    expect(a).toMatchObject({ count: 2, max: 4, confirmed: 1, pending: 1, checkedIn: 1 });
    const b = s.categories.find((c) => c.tournamentId === "B")!;
    expect(b).toMatchObject({ count: 1, max: null, confirmed: 1 });
  });
  it("omits revenue when price amount is null", () => {
    expect(buildDashboardStats(tournaments, teams, { amount: null, basis: "team" }).revenue).toBeNull();
  });
  it("computes revenue per team basis (non-cancelled projected, paid collected)", () => {
    const s = buildDashboardStats(tournaments, teams, { amount: 10, basis: "team" });
    // non-cancelled teams = 3 -> projected 30; paid teams = 2 -> collected 20
    expect(s.revenue).toEqual({ projected: 30, collected: 20 });
  });
  it("computes revenue per player basis (sums player_count)", () => {
    const s = buildDashboardStats(tournaments, teams, { amount: 10, basis: "player" });
    // non-cancelled players = 1+1+5 = 7 -> 70; paid players = 1+5 = 6 -> 60
    expect(s.revenue).toEqual({ projected: 70, collected: 60 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dashboard`
Expected: FAIL (cannot resolve `@/lib/dashboard`).

- [ ] **Step 3: Write the implementation**

Create `src/lib/dashboard.ts`:

```ts
// Pure aggregation for the admin dashboard. No I/O — the action feeds it rows.

export type DashboardTournament = {
  id: string;
  name: string;
  division: "female" | "male";
  format: string;
  max_teams: number | null;
};

export type DashboardTeamRow = {
  tournament_id: string;
  status: "pending" | "confirmed" | "cancelled";
  paid: boolean;
  checked_in: boolean;
  player_count: number;
};

export type Pricing = { amount: number | null; basis: "team" | "player" };

export type DashboardCategory = {
  tournamentId: string;
  name: string;
  division: "female" | "male";
  count: number; // non-cancelled
  max: number | null;
  confirmed: number;
  pending: number;
  checkedIn: number;
};

export type DashboardStats = {
  totals: {
    teams: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    paid: number;
    checkedIn: number;
  };
  categories: DashboardCategory[];
  revenue: { projected: number; collected: number } | null;
};

export function buildDashboardStats(
  tournaments: DashboardTournament[],
  teams: DashboardTeamRow[],
  pricing: Pricing
): DashboardStats {
  const totals = {
    teams: teams.length,
    pending: teams.filter((t) => t.status === "pending").length,
    confirmed: teams.filter((t) => t.status === "confirmed").length,
    cancelled: teams.filter((t) => t.status === "cancelled").length,
    paid: teams.filter((t) => t.paid).length,
    checkedIn: teams.filter((t) => t.checked_in).length,
  };

  const categories: DashboardCategory[] = tournaments.map((t) => {
    const rows = teams.filter((r) => r.tournament_id === t.id);
    return {
      tournamentId: t.id,
      name: t.name,
      division: t.division,
      count: rows.filter((r) => r.status !== "cancelled").length,
      max: t.max_teams,
      confirmed: rows.filter((r) => r.status === "confirmed").length,
      pending: rows.filter((r) => r.status === "pending").length,
      checkedIn: rows.filter((r) => r.checked_in).length,
    };
  });

  let revenue: { projected: number; collected: number } | null = null;
  if (pricing.amount != null) {
    const units = (list: DashboardTeamRow[]) =>
      pricing.basis === "player"
        ? list.reduce((sum, t) => sum + t.player_count, 0)
        : list.length;
    const nonCancelled = teams.filter((t) => t.status !== "cancelled");
    const paid = teams.filter((t) => t.paid && t.status !== "cancelled");
    revenue = {
      projected: units(nonCancelled) * pricing.amount,
      collected: units(paid) * pricing.amount,
    };
  }

  return { totals, categories, revenue };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- dashboard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard.ts src/lib/__tests__/dashboard.test.ts
git commit -m "feat(admin-ops): pure dashboard stats builder with tests"
```

---

### Task 5: Registration caps — enforcement + public capacity surfaces

**Files:**
- Modify: `src/actions/registrations.ts` (registerTeam: select `max_teams`, count + reject when full)
- Modify: `src/lib/stats.ts` (replace `getCategoryCounts` with `getCategoryCapacity`)
- Modify: `src/components/landing/categories.tsx` (consume capacity, show full/spots)
- Modify: `src/app/page.tsx` (fetch capacity)
- Modify: `src/app/registro/page.tsx` (fetch capacity, pass to form, make async)
- Modify: `src/components/registro/registration-form.tsx` (disable full categories)

**Interfaces:**
- Consumes: `capacityState`, `aggregateFormatCapacity` (Task 2).
- Produces: `type FormatCapacity = CapacityState & { count: number }`; `type CategoryCapacity = Record<string, FormatCapacity>`; `getCategoryCapacity(): Promise<CategoryCapacity>` (keyed by format slug, e.g. `"1v1"`).

- [ ] **Step 1: Replace getCategoryCounts with getCategoryCapacity in `src/lib/stats.ts`**

Replace the entire file body with:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { aggregateFormatCapacity, type CapacityState } from "@/lib/capacity";

// Capacidad por formato (1v1/2v2/5v5), agregando ambas divisiones. Usa el
// cliente service-role porque `teams` es RLS deny-all al anon. Excluye
// cancelados. Sólo cuenta torneos abiertos (is_open).
export type FormatCapacity = CapacityState & { count: number };
export type CategoryCapacity = Record<string, FormatCapacity>;

export async function getCategoryCapacity(): Promise<CategoryCapacity> {
  const supabase = createAdminClient();
  const [{ data: tournaments }, { data: teams }] = await Promise.all([
    supabase.from("tournaments").select("id, format, max_teams").eq("is_open", true),
    supabase.from("teams").select("tournament_id, status").neq("status", "cancelled"),
  ]);

  const perTournament = new Map<string, number>();
  for (const t of teams ?? []) {
    perTournament.set(t.tournament_id, (perTournament.get(t.tournament_id) ?? 0) + 1);
  }

  const byFormat = new Map<string, { count: number; max: number | null }[]>();
  for (const t of tournaments ?? []) {
    const arr = byFormat.get(t.format) ?? [];
    arr.push({ count: perTournament.get(t.id) ?? 0, max: t.max_teams });
    byFormat.set(t.format, arr);
  }

  const result: CategoryCapacity = {};
  for (const [format, items] of byFormat) {
    result[format] = aggregateFormatCapacity(items);
  }
  return result;
}
```

- [ ] **Step 2: Enforce the cap in `registerTeam` (`src/actions/registrations.ts`)**

Change the tournament lookup `.select("id, is_open")` to `.select("id, is_open, max_teams")`. Then, immediately after the `if (!tournament)` guard and before the team insert, add:

```ts
  // Capacity check (count-then-insert; small race acceptable at this scale).
  if (tournament.max_teams != null) {
    const { count } = await supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournament.id)
      .neq("status", "cancelled");
    if ((count ?? 0) >= tournament.max_teams) {
      return { ok: false, error: "Esta categoría alcanzó su cupo máximo." };
    }
  }
```

- [ ] **Step 3: Update `src/components/landing/categories.tsx` to consume capacity**

Replace the import and `countLabel` + the component signature/counter block:

```tsx
import Link from "next/link";
import { event } from "@/config/event.config";
import { buttonVariants } from "@/components/ui/button";
import type { CategoryCapacity } from "@/lib/stats";

export function Categories({ capacity = {} }: { capacity?: CategoryCapacity }) {
  return (
    <section id="categorias" className="relative px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <header className="mb-12 text-center">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Categorías</p>
          <h2 className="mt-2 font-display text-4xl font-black sm:text-6xl">Escoge tu cancha</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Inscríbete en división femenina (todas las edades) o masculina. Cada formato tiene su
            propio torneo.
          </p>
        </header>

        <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-3">
          {event.categories.map((cat, i) => {
            const cap = capacity[cat.slug];
            const n = cap?.count ?? 0;
            const isFull = cap?.isFull ?? false;
            const spotsLeft = cap?.spotsLeft ?? null;
            return (
              <article
                key={cat.slug}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card/70 p-7 transition-all hover:border-primary/60 hover:glow-orange"
              >
                <span className="pointer-events-none absolute -right-3 -top-7 select-none font-display text-[7rem] font-black leading-none text-primary/10 transition-colors group-hover:text-primary/20">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-5xl font-black text-foreground">{cat.name}</h3>
                <p className="mt-3 min-h-[3rem] text-sm text-muted-foreground">{cat.blurb}</p>
                <p className="mt-4 font-display text-xs uppercase tracking-widest text-primary">
                  {cat.detail}
                </p>

                {event.counter.enabled && (
                  <div className="mt-4 flex items-center gap-2 text-xs">
                    <span className={`inline-flex size-2 shrink-0 rounded-full ${isFull ? "bg-muted-foreground" : "bg-primary"}`} />
                    <span className="font-display uppercase tracking-widest text-foreground">
                      {isFull
                        ? event.counter.fullLabel
                        : n <= 0
                          ? event.counter.emptyLabel
                          : `${n} ${n === 1 ? event.counter.oneLabel : event.counter.manyLabel}`}
                    </span>
                    {!isFull && spotsLeft != null && spotsLeft > 0 && (
                      <span className="text-muted-foreground">· {spotsLeft} {event.counter.spotsLeftLabel}</span>
                    )}
                    {!isFull && spotsLeft == null && n > 0 && (
                      <span className="text-muted-foreground">· {event.counter.scarcityLabel}</span>
                    )}
                  </div>
                )}

                <Link
                  href={`/registro?cat=${cat.slug}`}
                  aria-disabled={isFull}
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: `mt-6 w-full ${isFull ? "pointer-events-none opacity-50" : ""}`,
                  })}
                >
                  {isFull ? event.counter.fullLabel : `Inscribir ${cat.name}`}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Update `src/app/page.tsx` to fetch capacity**

Change the import `import { getCategoryCounts } from "@/lib/stats";` to `import { getCategoryCapacity } from "@/lib/stats";`, change `const counts = await getCategoryCounts();` to `const capacity = await getCategoryCapacity();`, and change `<Categories counts={counts} />` to `<Categories capacity={capacity} />`.

- [ ] **Step 5: Update `src/app/registro/page.tsx` to pass capacity to the form**

Make the component async and fetch capacity; pass it to the form:

```tsx
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
```

- [ ] **Step 6: Update `src/components/registro/registration-form.tsx` to disable full categories**

Add the prop and disable full category buttons. Change the signature line and the category button block:

Change the import line to add the type:
```tsx
import { event, type DivisionKey } from "@/config/event.config";
import type { CategoryCapacity } from "@/lib/stats";
```

Change the function signature:
```tsx
export function RegistrationForm({ capacity = {} }: { capacity?: CategoryCapacity }) {
```

Replace the category buttons `.map` (the block rendering each category `<button>`) with:
```tsx
          {event.categories.map((c) => {
            const isFull = capacity[c.slug]?.isFull ?? false;
            return (
              <button
                key={c.slug}
                type="button"
                disabled={isFull}
                onClick={() => !isFull && setCategorySlug(c.slug)}
                className={cn(
                  "rounded-xl border px-3 py-4 text-center transition-all",
                  isFull
                    ? "cursor-not-allowed border-border bg-card/40 opacity-50"
                    : categorySlug === c.slug
                      ? "border-primary bg-primary/10 glow-orange"
                      : "border-border bg-card/60 hover:border-primary/50"
                )}
              >
                <span className="block font-display text-2xl font-black text-foreground sm:text-3xl">{c.name}</span>
                {isFull && (
                  <span className="mt-1 block font-display text-[0.6rem] uppercase tracking-widest text-muted-foreground">
                    {event.counter.fullLabel}
                  </span>
                )}
              </button>
            );
          })}
```

- [ ] **Step 7: Verify**

Run: `npm run lint && npm run test && npm run build`
Expected: all PASS (43 tests green = 25 existing + 18 new from Tasks 2–4; build compiles 12+ routes).

Manual (with dev server + migration applied): set a tournament's `max_teams=1` (via SQL or after Task 7's admin UI), register one team to that format+division, confirm a second is rejected with "Esta categoría alcanzó su cupo máximo," and the landing card + form reflect "Cupo lleno" once all divisions of that format are full.

- [ ] **Step 8: Commit**

```bash
git add src/actions/registrations.ts src/lib/stats.ts src/components/landing/categories.tsx src/app/page.tsx src/app/registro/page.tsx src/components/registro/registration-form.tsx
git commit -m "feat(admin-ops): registration caps enforcement + public capacity surfaces"
```

---

### Task 6: WhatsApp outreach dropdown in the admin teams table

**Files:**
- Modify: `src/components/admin/teams-table.tsx`

**Interfaces:**
- Consumes: `captainWhatsappUrl`, `WhatsAppTemplateKey` (Task 3); `WhatsAppIcon` from `@/components/shared/icons`.

- [ ] **Step 1: Add a WhatsApp dropdown component + wire it into each team row**

In `src/components/admin/teams-table.tsx`:

Add imports near the top:
```tsx
import { captainWhatsappUrl, type WhatsAppTemplateKey } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/shared/icons";
```

Add this component above `export function TeamsTable`:
```tsx
const WA_ITEMS: { key: WhatsAppTemplateKey; label: string }[] = [
  { key: "confirmacion", label: "Confirmación" },
  { key: "pago", label: "Recordatorio de pago" },
  { key: "seguimiento", label: "Seguimiento general" },
];

function WhatsAppMenu({ team }: { team: TeamWithDetails }) {
  const [open, setOpen] = useState(false);
  // If the captain phone has no usable digits, hide the control entirely.
  if (!captainWhatsappUrl(team, "seguimiento")) return null;
  return (
    <div className="relative">
      <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
        <WhatsAppIcon className="size-4 text-[#25D366]" /> WhatsApp
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            {WA_ITEMS.map((item) => {
              const url = captainWhatsappUrl(team, item.key)!;
              return (
                <a
                  key={item.key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 text-sm text-foreground hover:bg-secondary/60"
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
```

In the row action bar (the `<div className="mt-4 flex flex-wrap gap-2">` block), add `<WhatsAppMenu team={team} />` as the first child (before the Confirmar button).

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run build`
Expected: PASS.

Manual: on `/admin`, each team with a valid phone shows a WhatsApp dropdown; each item opens `wa.me` in a new tab with the correctly filled Spanish message for that captain.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/teams-table.tsx
git commit -m "feat(admin-ops): per-captain WhatsApp outreach dropdown in teams table"
```

---

### Task 7: Admin dashboard — stats action, cap editor, stats board

**Files:**
- Create: `src/actions/dashboard.ts` (`getDashboardStats`)
- Modify: `src/actions/admin.ts` (add `setMaxTeams`)
- Create: `src/components/admin/stats-board.tsx`
- Modify: `src/app/admin/page.tsx` (render the stats board above the teams table)

**Interfaces:**
- Consumes: `buildDashboardStats` + its types (Task 4); `event.pricing` (Task 1); `requireAdmin`, `createAdminClient`.
- Produces: `getDashboardStats(): Promise<DashboardStats>`; `setMaxTeams(tournamentId: string, max: number | null): Promise<void>`.

- [ ] **Step 1: Add `setMaxTeams` to `src/actions/admin.ts`**

Append:
```ts
export async function setMaxTeams(tournamentId: string, max: number | null) {
  await requireAdmin();
  const supabase = createAdminClient();
  const value = max != null && max > 0 ? Math.floor(max) : null;
  const { error } = await supabase
    .from("tournaments")
    .update({ max_teams: value })
    .eq("id", tournamentId);
  if (error) throw new Error("Error al actualizar el cupo.");
  revalidatePath("/admin");
  revalidatePath("/");
}
```

- [ ] **Step 2: Create `src/actions/dashboard.ts`**

```ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { event } from "@/config/event.config";
import {
  buildDashboardStats,
  type DashboardStats,
  type DashboardTournament,
  type DashboardTeamRow,
} from "@/lib/dashboard";

type RawTeam = {
  tournament_id: string;
  status: "pending" | "confirmed" | "cancelled";
  paid: boolean;
  checked_in: boolean;
  players: { id: string }[] | null;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireAdmin();
  const supabase = createAdminClient();

  const [{ data: tournaments }, { data: teams }] = await Promise.all([
    supabase
      .from("tournaments")
      .select("id, name, division, format, max_teams")
      .order("sort_order", { ascending: true }),
    // Embedded players(id) infers as never with the hand-written Database type;
    // cast at the boundary (same pattern as brackets-public.ts).
    supabase.from("teams").select("tournament_id, status, paid, checked_in, players(id)"),
  ]);

  const tRows: DashboardTournament[] = (tournaments ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    division: t.division,
    format: t.format,
    max_teams: t.max_teams,
  }));

  const teamRows: DashboardTeamRow[] = ((teams ?? []) as unknown as RawTeam[]).map((r) => ({
    tournament_id: r.tournament_id,
    status: r.status,
    paid: r.paid,
    checked_in: r.checked_in,
    player_count: r.players?.length ?? 0,
  }));

  return buildDashboardStats(tRows, teamRows, {
    amount: event.pricing.amount,
    basis: event.pricing.basis,
  });
}
```

- [ ] **Step 3: Create `src/components/admin/stats-board.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { event } from "@/config/event.config";
import { setMaxTeams } from "@/actions/admin";
import type { DashboardStats, DashboardCategory } from "@/lib/dashboard";

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 px-5 py-4">
      <p className="font-display text-4xl font-black text-primary tabular-nums">{value}</p>
      <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

function CapCell({ cat }: { cat: DashboardCategory }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(cat.max?.toString() ?? "");

  function save() {
    const parsed = value.trim() === "" ? null : Number(value);
    if (parsed != null && (!Number.isFinite(parsed) || parsed <= 0)) {
      toast.error("Cupo inválido");
      setValue(cat.max?.toString() ?? "");
      return;
    }
    startTransition(async () => {
      try {
        await setMaxTeams(cat.tournamentId, parsed);
        toast.success("Cupo actualizado");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <input
      type="number"
      min={1}
      inputMode="numeric"
      disabled={pending}
      value={value}
      placeholder="∞"
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="h-9 w-20 rounded-lg border border-input bg-secondary/40 px-2 text-center text-sm focus-visible:border-primary focus-visible:outline-none"
      aria-label={`Cupo máximo de ${cat.name}`}
    />
  );
}

export function StatsBoard({ stats }: { stats: DashboardStats }) {
  const { totals, categories, revenue } = stats;
  const money = (n: number) => `${event.pricing.currency}${n.toLocaleString("es-PR")}`;

  return (
    <section className="mb-10 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Equipos" value={totals.teams} />
        <Tile label="Confirmados" value={totals.confirmed} />
        <Tile label="Pagados" value={totals.paid} />
        <Tile label="Llegaron" value={totals.checkedIn} />
      </div>

      {revenue && (
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Recaudo proyectado" value={money(revenue.projected)} />
          <Tile label="Recaudo cobrado" value={money(revenue.collected)} />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-left font-display text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-3 py-3 text-center">Inscritos</th>
              <th className="px-3 py-3 text-center">Conf.</th>
              <th className="px-3 py-3 text-center">Llegaron</th>
              <th className="px-3 py-3 text-center">Cupo máx.</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.tournamentId} className="border-t border-border">
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground">{c.name}</span>{" "}
                  <span className="text-muted-foreground">· {event.divisions[c.division].label}</span>
                </td>
                <td className="px-3 py-3 text-center tabular-nums">
                  {c.count}
                  {c.max != null && <span className="text-muted-foreground"> / {c.max}</span>}
                </td>
                <td className="px-3 py-3 text-center tabular-nums">{c.confirmed}</td>
                <td className="px-3 py-3 text-center tabular-nums">{c.checkedIn}</td>
                <td className="px-3 py-3 text-center">
                  <CapCell cat={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Render the stats board in `src/app/admin/page.tsx`**

Add imports and fetch stats; render `<StatsBoard>` above `<TeamsTable>`:

```tsx
import { listTeams } from "@/actions/admin";
import { getDashboardStats } from "@/actions/dashboard";
import { TeamsTable } from "@/components/admin/teams-table";
import { StatsBoard } from "@/components/admin/stats-board";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata = {
  title: "Admin — Equipos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [teams, stats] = await Promise.all([listTeams(), getDashboardStats()]);

  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Administración</p>
          <h1 className="mt-1 font-display text-5xl font-black uppercase">Panel</h1>
        </header>
        <StatsBoard stats={stats} />
        <TeamsTable teams={teams} />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run test && npm run build`
Expected: PASS.

Manual: `/admin` shows stat tiles + a per-category table; editing a "Cupo máx." cell and blurring saves it (toast), and a blank cell clears the cap (∞). With `event.pricing.amount` null no revenue tiles; set it to a number → projected/collected appear.

- [ ] **Step 6: Commit**

```bash
git add src/actions/dashboard.ts src/actions/admin.ts src/components/admin/stats-board.tsx src/app/admin/page.tsx
git commit -m "feat(admin-ops): dashboard stats action + stats board + inline cap editor"
```

---

### Task 8: Event-day check-in door screen

**Files:**
- Create: `src/actions/checkin.ts` (`findTeamsForCheckin`, `setCheckedIn`)
- Create: `src/components/admin/checkin-board.tsx`
- Create: `src/app/admin/checkin/page.tsx`
- Modify: `src/components/admin/admin-nav.tsx` (add Check-in link)
- Dependency: install `html5-qrcode`

**Interfaces:**
- Consumes: `requireAdmin`, `createAdminClient`, `setPaid` + `confirmTeam` (existing in `@/actions/admin`), `TeamWithDetails`.
- Produces: `findTeamsForCheckin(query: string): Promise<TeamWithDetails[]>`; `setCheckedIn(teamId: string, value: boolean): Promise<void>`.

- [ ] **Step 1: Install the scanner dependency**

Run: `npm install html5-qrcode`
Expected: adds `html5-qrcode` to dependencies.

- [ ] **Step 2: Create `src/actions/checkin.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import type { TeamWithDetails } from "@/types";

const SELECT = "*, tournaments(name, format, division), players(name, jersey_number)";

// Matches by exact lookup_code (upper-cased) OR partial team_name (ilike).
// Empty query returns recent confirmed teams (the day-of working set).
export async function findTeamsForCheckin(query: string): Promise<TeamWithDetails[]> {
  await requireAdmin();
  const supabase = createAdminClient();
  const clean = query.trim();

  if (!clean) {
    const { data } = await supabase
      .from("teams")
      .select(SELECT)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(25);
    return (data as TeamWithDetails[] | null) ?? [];
  }

  const { data } = await supabase
    .from("teams")
    .select(SELECT)
    .or(`lookup_code.eq.${clean.toUpperCase()},team_name.ilike.%${clean}%`)
    .order("created_at", { ascending: false })
    .limit(25);
  return (data as TeamWithDetails[] | null) ?? [];
}

export async function setCheckedIn(teamId: string, value: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  // The on_team_checked_in trigger stamps/clears checked_in_at.
  const { error } = await supabase.from("teams").update({ checked_in: value }).eq("id", teamId);
  if (error) throw new Error("Error al actualizar la llegada.");
  revalidatePath("/admin/checkin");
  revalidatePath("/admin");
}
```

- [ ] **Step 3: Create `src/components/admin/checkin-board.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, Camera, Check, DollarSign, LogIn } from "lucide-react";
import { findTeamsForCheckin, setCheckedIn } from "@/actions/checkin";
import { confirmTeam, setPaid } from "@/actions/admin";
import { event } from "@/config/event.config";
import type { TeamWithDetails } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function Toggle({
  on, onLabel, offLabel, icon, pending, onClick,
}: {
  on: boolean; onLabel: string; offLabel: string; icon: React.ReactNode; pending: boolean; onClick: () => void;
}) {
  return (
    <Button size="lg" variant={on ? "secondary" : "default"} disabled={pending} onClick={onClick} className="flex-1">
      {icon} {on ? onLabel : offLabel}
    </Button>
  );
}

export function CheckinBoard() {
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState<TeamWithDetails[]>([]);
  const [pending, startTransition] = useTransition();
  const [scanning, setScanning] = useState(false);

  function search(q: string) {
    startTransition(async () => {
      try {
        setTeams(await findTeamsForCheckin(q));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  // Load the day-of working set on mount.
  useEffect(() => {
    search("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function act(fn: () => Promise<void>, okMsg: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(okMsg);
        setTeams(await findTeamsForCheckin(query));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  const confirmedTeams = teams.filter((t) => t.status === "confirmed");
  const arrived = confirmedTeams.filter((t) => t.checked_in).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card/70 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search(query);
          }}
          className="flex gap-3"
        >
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Código o nombre del equipo"
            className="text-lg"
            aria-label="Buscar equipo por código o nombre"
          />
          <Button type="submit" disabled={pending}>
            <Search className="size-4" /> Buscar
          </Button>
          <Button type="button" variant="outline" onClick={() => setScanning((v) => !v)}>
            <Camera className="size-4" /> {scanning ? "Cerrar" : "Escanear"}
          </Button>
        </form>

        {scanning && (
          <QrScanner
            onResult={(code) => {
              setQuery(code);
              setScanning(false);
              search(code);
            }}
            onError={(msg) => {
              toast.error(msg);
              setScanning(false);
            }}
          />
        )}

        <p className="mt-3 font-display text-sm uppercase tracking-widest text-muted-foreground">
          {arrived} de {confirmedTeams.length} equipos llegaron
        </p>
      </div>

      {teams.length === 0 ? (
        <p className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">
          {pending ? "Buscando..." : "No se encontraron equipos."}
        </p>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => (
            <article key={team.id} className="rounded-2xl border border-border bg-card/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-2xl font-black uppercase">{team.team_name}</h3>
                    <span className="font-display text-xs tracking-[0.2em] text-primary">{team.lookup_code}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {team.tournaments?.name ?? "—"} · {event.divisions[team.division].label}
                    {team.age_bracket ? ` · ${team.age_bracket}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Roster: {team.players.map((p) => p.name).join(", ") || "—"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={team.checked_in ? "confirmed" : "pending"}>
                    {team.checked_in ? "Llegó" : "No ha llegado"}
                  </Badge>
                  <Badge variant={team.paid ? "paid" : "unpaid"}>
                    {team.paid ? "Pagado" : "Sin pagar"}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {team.status !== "confirmed" && (
                  <Button size="lg" variant="default" disabled={pending} onClick={() => act(() => confirmTeam(team.id, "confirmed"), "Equipo confirmado")} className="flex-1">
                    <Check className="size-4" /> Confirmar
                  </Button>
                )}
                <Toggle
                  on={team.checked_in}
                  onLabel="Llegó ✓"
                  offLabel="Marcar llegada"
                  icon={<LogIn className="size-4" />}
                  pending={pending}
                  onClick={() => act(() => setCheckedIn(team.id, !team.checked_in), team.checked_in ? "Llegada retirada" : "Llegada marcada")}
                />
                <Toggle
                  on={team.paid}
                  onLabel="Pagado ✓"
                  offLabel="Marcar pagado"
                  icon={<DollarSign className="size-4" />}
                  pending={pending}
                  onClick={() => act(() => setPaid(team.id, !team.paid), team.paid ? "Pago retirado" : "Pago marcado")}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// Camera QR scanner. html5-qrcode is browser-only — import dynamically in effect.
function QrScanner({ onResult, onError }: { onResult: (code: string) => void; onError: (msg: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled || !ref.current) return;
        const instance = new Html5Qrcode(ref.current.id);
        scanner = instance as unknown as { stop: () => Promise<void>; clear: () => void };
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          (decoded: string) => {
            onResult(decoded.trim().toUpperCase());
          },
          () => {}
        );
      } catch {
        if (!cancelled) onError("No se pudo abrir la cámara. Usa la búsqueda por código.");
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) {
        scanner.stop().then(() => scanner?.clear()).catch(() => {});
      }
    };
  }, [onResult, onError]);

  return <div id="qr-scanner-region" ref={ref} className="mx-auto mt-4 w-full max-w-xs overflow-hidden rounded-xl" />;
}
```

- [ ] **Step 4: Create `src/app/admin/checkin/page.tsx`**

```tsx
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
```

- [ ] **Step 5: Add the Check-in link to `src/components/admin/admin-nav.tsx`**

Change the `LINKS` array to:
```tsx
const LINKS = [
  { href: "/admin", label: "Equipos" },
  { href: "/admin/checkin", label: "Check-in" },
  { href: "/admin/brackets", label: "Brackets" },
  { href: "/admin/reglas", label: "Reglas" },
];
```

- [ ] **Step 6: Verify**

Run: `npm run lint && npm run test && npm run build`
Expected: PASS (the dynamic `import("html5-qrcode")` keeps it out of SSR).

Manual: `/admin/checkin` lists confirmed teams on load; searching by código or team name finds a team; "Marcar llegada" updates the "X de Y equipos llegaron" header; "Escanear" opens the camera and a scanned código fills the search and finds the team; denying the camera shows the Spanish fallback and typed search still works.

- [ ] **Step 7: Commit**

```bash
git add src/actions/checkin.ts src/components/admin/checkin-board.tsx src/app/admin/checkin/page.tsx src/components/admin/admin-nav.tsx package.json package-lock.json
git commit -m "feat(admin-ops): event-day check-in door screen with QR scan"
```

---

### Task 9: QR code generation for captains

**Files:**
- Create: `src/components/shared/qr-code.tsx`
- Modify: `src/components/registro/registration-form.tsx` (success screen)
- Modify: `src/components/equipos/lookup.tsx` (lookup result)
- Dependency: install `qrcode.react`

**Interfaces:**
- Produces: `<LookupQr code={string} />` — renders a branded QR of the lookup code.

- [ ] **Step 1: Install the generator dependency**

Run: `npm install qrcode.react`
Expected: adds `qrcode.react` to dependencies.

- [ ] **Step 2: Create `src/components/shared/qr-code.tsx`**

```tsx
"use client";

import { QRCodeSVG } from "qrcode.react";

// Renders the lookup code as a scannable QR so captains can show it at the door.
export function LookupQr({ code, size = 132 }: { code: string; size?: number }) {
  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-3">
      <QRCodeSVG value={code} size={size} level="M" />
      <span className="font-display text-xs tracking-[0.3em] text-black">{code}</span>
    </div>
  );
}
```

- [ ] **Step 3: Add the QR to the `/registro` success screen**

In `src/components/registro/registration-form.tsx`, add the import:
```tsx
import { LookupQr } from "@/components/shared/qr-code";
```
In the success block, immediately after the code-copy `<button>` (the one showing `{success}` + the `Copy` icon), add:
```tsx
        <div className="mt-6 flex justify-center">
          <LookupQr code={success} />
        </div>
```

- [ ] **Step 4: Add the QR to the `/equipos` lookup result**

In `src/components/equipos/lookup.tsx`, add the import:
```tsx
import { LookupQr } from "@/components/shared/qr-code";
```
Inside the `team && (...)` result card, replace the payment-note line near the end:
```tsx
          <p className="mt-5 text-xs text-muted-foreground">{event.details.paymentNote}</p>
```
with:
```tsx
          <div className="mt-6 flex flex-col items-center gap-3 border-t border-border pt-5">
            <LookupQr code={team.lookup_code} />
            <p className="text-center text-xs text-muted-foreground">
              Muestra este código en la entrada. {event.details.paymentNote}
            </p>
          </div>
```

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run test && npm run build`
Expected: PASS.

Manual: after a successful registration the success screen shows a scannable QR of the código; `/equipos` lookup shows the QR; scanning either from the `/admin/checkin` scanner jumps to that team.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/qr-code.tsx src/components/registro/registration-form.tsx src/components/equipos/lookup.tsx package.json package-lock.json
git commit -m "feat(admin-ops): generate scannable QR of lookup code on registro + equipos"
```

---

## Final verification

After all tasks:
- `npm run lint && npm run test && npm run build` clean (43 unit tests: 25 existing + 18 from capacity/whatsapp/dashboard).
- User applies `supabase/migrations/007_admin_ops.sql` in the Supabase SQL editor, then runs the manual E2E from the spec's Testing section.
- Then `superpowers:finishing-a-development-branch`.
