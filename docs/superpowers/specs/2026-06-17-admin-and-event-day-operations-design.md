# Spec A — Admin & Event-Day Operations — Design

**Date:** 2026-06-17
**Project:** ka-basket-pr
**Status:** Approved (brainstorming complete)

## Context

`ka-basket-pr` is a Spanish promo + team-registration app for coach Kaguayo's
basketball tournament (paid at the door; 1v1/2v2/5v5; female-forward + men's
division). The core flows (landing, `/registro`, `/equipos`, `/admin` team
management, `/torneo` brackets + rules) already ship. This spec is the first of
four enhancement specs (A–D). It bundles four **admin- and event-day-focused**
features that share the same subsystems (`teams` / `tournaments` + the admin
panel) and add **no external dependencies beyond two client-only QR libraries**:

1. WhatsApp outreach from the admin panel (per-captain prefilled messages)
2. Registration caps + auto-close (per-category capacity)
3. Event-day check-in flow (dedicated door screen)
4. Admin dashboard stats

Specs B (bracket presentation), C (public registration UX), and D (email) are
out of scope here and will be brainstormed separately.

### Architectural constraints (inherited, must hold)

- Registrants are anonymous. `teams` / `players` are **RLS deny-all** to the
  anon key; all writes and sensitive reads go through Server Actions using the
  service-role client (`src/lib/supabase/admin.ts`).
- `tournaments` is **publicly readable** (non-sensitive).
- Admin is gated by a shared password + signed httpOnly cookie; `requireAdmin()`
  runs inside **every** admin action (never trust `proxy.ts` alone).
- All editable event copy lives in `src/config/event.config.ts` — never hardcode
  event text in components.
- Next.js 16 (App Router); `params` is a Promise; Server Actions `revalidatePath`
  the surfaces they change.

## Feature 1 — WhatsApp outreach

Each team row in `/admin` gets a compact **WhatsApp** dropdown offering three
prefilled messages the admin can open and send manually (WhatsApp cannot
auto-send; the link opens the chat ready to send).

**Templates** (in `event.config.ts.whatsappTemplates`, variables
`{team} {captain} {code} {category}`):
- `confirmacion` — confirms the team's spot + payment-at-door + their código
- `pago` — payment reminder for confirmed-but-unpaid teams
- `seguimiento` — generic follow-up / open chat

**Helper** `src/lib/whatsapp.ts`:
- `fillTemplate(tmpl: string, vars: Record<string,string>): string` — substitutes
  `{key}` placeholders.
- `captainWhatsappUrl(team, templateKey): string | null` — strips captain phone
  to digits; returns `https://wa.me/<digits>?text=<encoded filled template>`;
  returns `null` when the phone yields no usable digits (button hidden).

**UI:** `teams-table.tsx` renders the dropdown client-side from data
`listTeams` already returns (captain name/phone, team_name, lookup_code,
category). Each item is an `<a target="_blank" rel="noopener">`. No new server
action.

## Feature 2 — Registration caps + auto-close

Per-category capacity. `tournaments.max_teams` (nullable; null = unlimited).
Capacity counts **non-cancelled** teams (pending + confirmed). No waitlist.

**Pure helper** `src/lib/capacity.ts`:
- `capacityState({ count, max }): { isFull: boolean; spotsLeft: number | null }`
  — `max == null` → `{ isFull: false, spotsLeft: null }`; otherwise
  `spotsLeft = max(0, max - count)`, `isFull = count >= max`.

**Enforcement** in `registerTeam` (`actions/registrations.ts`): the open-
tournament lookup also selects `max_teams`; before insert, count non-cancelled
teams for that `tournament_id`; if `count >= max_teams`, return
`{ ok: false, error: "Esta categoría alcanzó su cupo máximo." }`.
*Documented caveat:* count-then-insert has a small race under simultaneous
submits; acceptable at this event's scale — not engineered around.

**Public surfaces:**
- `getCategoryCounts()` (`lib/stats.ts`) extended to also return `max` per
  category (and computes `capacityState` for display).
- `categories.tsx` counter shows `"N equipos inscritos · K cupos disponibles"`,
  or `"Cupo lleno"` when full (labels from `event.config.ts.counter`).
- `registration-form.tsx` disables a full category in the picker (server still
  enforces as source of truth).

Cap **editing** UI lives in the dashboard (Feature 4): inline number field per
category → `setMaxTeams(tournamentId, max)`.

## Feature 3 — Event-day check-in door screen

New columns on `teams`: `checked_in boolean not null default false`,
`checked_in_at timestamptz`. A `stamp_checked_in_at` trigger mirrors
`stamp_paid_at` (stamps on flip-to-true, clears on false).

**Route:** `/admin/checkin` (password-gated), linked in `admin-nav` as
"Check-in".

**Server actions** `src/actions/checkin.ts` (each `requireAdmin()`):
- `findTeamsForCheckin(query: string)` — matches `lookup_code` (exact, upper-
  cased) **or** `team_name` (`ilike %query%`); returns team + roster + status +
  paid + checked_in. Empty query → recent confirmed teams.
- `setCheckedIn(teamId, value)` — flips `checked_in` (trigger stamps
  `checked_in_at`); `revalidatePath("/admin/checkin")` + `revalidatePath("/admin")`.
- Reuses existing `setPaid` so the door can also mark paid.

**UI** `components/admin/checkin-board.tsx` (client):
- Auto-focused search box; type código or team name → result card(s) with team,
  category, roster, and three large tap toggles: **Confirmado**, **Pagado**,
  **Llegó**.
- **"Escanear" button** opens the camera via `html5-qrcode`; on decode it fills
  the código and runs the search. Fallback: if no camera or permission denied,
  show a message and keep typed search fully working (always available).
- Live header **"X de Y equipos llegaron"** (Y = confirmed teams).

**QR generation:** `components/shared/qr-code.tsx` (wraps `qrcode.react`)
renders the `lookup_code` as a QR on the `/registro` success screen and on the
`/equipos` lookup result, next to the código text, so captains have something to
scan.

**New deps:** `html5-qrcode` (scanner), `qrcode.react` (generator) — both
client-only.

## Feature 4 — Admin dashboard stats

**Server action** `getDashboardStats()` (`actions/dashboard.ts`,
`requireAdmin()`) fetches raw team rows (with `tournament` + `players` counts)
and calls a pure shaper.

**Pure function** `src/lib/dashboard.ts`:
`buildDashboardStats(rows, pricing): DashboardStats` returning:
- **Totals:** teams, byStatus (pendiente/confirmado/cancelado), paid count,
  checkedIn count.
- **Per-category rows:** `{ tournamentId, name, division, count (non-cancelled),
  max, confirmed, pending, checkedIn }`.
- **Revenue** (only when `pricing.amount != null`): `{ projected, collected }`.
  Basis `"team"` → count teams; `"player"` → count players. Projected =
  non-cancelled × amount; collected = paid × amount. When `amount` is null the
  `revenue` field is omitted.

**UI** `components/admin/stats-board.tsx` (atop `/admin`):
- Stat tiles: Equipos · Confirmados · Pagados · Llegaron · (Recaudo
  proyectado/cobrado when price set).
- Per-category table with counts + an inline editable **"Cupo máximo"** number
  per row → `setMaxTeams(tournamentId, value)` (empty = unlimited).
- Existing teams table renders below on the same `/admin` page.

## Data model — migration `007_admin_ops.sql`

```sql
-- tournaments: per-category capacity (null = unlimited)
alter table public.tournaments
  add column max_teams int check (max_teams is null or max_teams > 0);

-- teams: event-day check-in
alter table public.teams
  add column checked_in boolean not null default false;
alter table public.teams
  add column checked_in_at timestamptz;

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

create trigger on_team_checked_in
  before update on public.teams
  for each row execute function public.stamp_checked_in_at();
```

RLS is unaffected: `max_teams` is on publicly-readable `tournaments` (just a
number, safe to expose); `checked_in`/`checked_in_at` are on deny-all `teams`
(reached only via service-role). `types/database.ts` updated for the new columns.

## Config additions — `event.config.ts`

```ts
// Pricing — optional numeric, separate from free-text details.price display.
pricing: {
  amount: null as number | null,       // e.g. 10
  basis: "team" as "team" | "player",
  currency: "$",
},

// Plantillas de WhatsApp. Variables: {team} {captain} {code} {category}
whatsappTemplates: {
  confirmacion: "¡Hola {captain}! Tu equipo \"{team}\" ({category}) quedó confirmado para el torneo 🏀. El pago se realiza en la entrada. Tu código es {code}.",
  pago: "¡Hola {captain}! Recordatorio: el pago de \"{team}\" se realiza en la puerta el día del evento. ¡Nos vemos!",
  seguimiento: "¡Hola {captain}! Te escribo sobre la inscripción de tu equipo \"{team}\" en el torneo 🏀.",
},

// Added to existing `counter` block:
counter: {
  // ...existing...
  fullLabel: "Cupo lleno",
  spotsLeftLabel: "cupos disponibles",
},
```

`details.price` (public free-text) is unchanged; `pricing.amount` is the admin-
only numeric for revenue math. Both editable by Kaguayo.

## Routes (final shape)

| Route | Change |
|---|---|
| `/admin` | Stats board + per-category cap editor above the teams table (rows now have WhatsApp dropdowns) |
| `/admin/checkin` | **New** — event-day door screen |
| `/registro` | Success screen gains a QR of the código; full categories disabled |
| `/equipos` | Lookup result gains a QR of the código |
| `/` | Counter shows spots-left / "Cupo lleno" |

## File structure

**New:** `supabase/migrations/007_admin_ops.sql`, `src/lib/whatsapp.ts`,
`src/lib/capacity.ts`, `src/lib/dashboard.ts`, `src/actions/checkin.ts`,
`src/actions/dashboard.ts`, `src/components/admin/stats-board.tsx`,
`src/components/admin/checkin-board.tsx`, `src/components/shared/qr-code.tsx`.

**Modified:** `src/config/event.config.ts`, `src/types/database.ts`,
`src/lib/stats.ts`, `src/actions/registrations.ts`, `src/actions/admin.ts`
(`setMaxTeams`), `src/components/admin/teams-table.tsx`,
`src/components/landing/categories.tsx`,
`src/components/registro/registration-form.tsx`,
`src/components/equipos/lookup.tsx`, `src/components/admin/admin-nav.tsx`,
`src/app/admin/page.tsx`, `src/app/registro/page.tsx` (success QR).

## Testing

**Unit (vitest):**
- `whatsapp.test.ts` — `fillTemplate` substitution; `captainWhatsappUrl` digit-
  strip, encoding, null-phone → null.
- `capacity.test.ts` — `capacityState`: unlimited (max null), spots-left
  boundary, exactly-full, over-full clamps to 0.
- `dashboard.test.ts` — `buildDashboardStats`: status/paid/checked-in counts;
  revenue by `team` basis; revenue by `player` basis; null price omits revenue.

**Manual E2E (local dev vs live Supabase — note: dev writes to prod data, clean
up test rows):**
1. Set a category's cap to 1 in `/admin`; register one team; second registration
   to that category is rejected ("cupo máximo") and the landing counter shows
   "Cupo lleno"; the form disables it.
2. WhatsApp dropdown on a team row opens wa.me prefilled to that captain with
   each of the 3 templates filled correctly.
3. `/admin/checkin`: search by código and by team name finds the team; toggling
   Llegó updates the live "X de Y" count; "Escanear" opens the camera and a
   scanned código jumps to the team; deny camera → typed search still works.
4. `/registro` success + `/equipos` lookup render a scannable QR of the código.
5. Dashboard tiles show correct counts; with `pricing.amount` null no revenue
   tiles; set `amount` → projected/collected appear (verify team vs player
   basis).

**Gates:** `npm run lint`, `npm run test`, `npm run build` clean.

## Out of scope (deferred)

Waitlists; automated/auto-sending messages; per-player payment tracking; QR for
anything other than the lookup código; Specs B (bracket schedule + SVG
connectors), C (roster self-edit + share buttons), D (email confirmations).
