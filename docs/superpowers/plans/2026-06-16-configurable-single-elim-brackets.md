# Configurable Single-Elim Brackets + Editable Rules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-curated single-elimination tournament brackets (auto-seed, tap-to-advance with scores) plus DB-backed admin-editable rules of play, shown publicly read-only at `/torneo`.

**Architecture:** A pure, unit-tested generator (`src/lib/bracket.ts`) produces the knockout tree; Server Actions persist and advance it via the service-role client. All bracket/settings tables are RLS deny-all to anon (like `teams`); team phones never leave `teams` (bracket stores only name snapshots). Public page reads published brackets through a server-only read layer.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase Postgres (`@supabase/supabase-js` service-role) · Tailwind 4 · vitest.

Spec: `docs/superpowers/specs/2026-06-16-configurable-single-elim-brackets-design.md`

---

## File structure

**Create:**
- `src/lib/bracket.ts` — pure generator + advance helpers (no I/O)
- `src/lib/__tests__/bracket.test.ts` — generator tests
- `src/lib/admin-guard.ts` — shared `requireAdmin()` (extracted from `actions/admin.ts`)
- `src/lib/brackets-public.ts` — server-only public read layer (service-role)
- `src/lib/settings.ts` — server-only settings read (rules body)
- `src/actions/brackets.ts` — admin Server Actions (reads w/ `requireAdmin` + writes)
- `supabase/migrations/004_brackets.sql` — schema
- `supabase/migrations/005_brackets_rls.sql` — RLS deny-all
- `supabase/migrations/006_brackets_triggers.sql` — updated_at triggers
- `src/components/admin/admin-nav.tsx` — Equipos · Brackets · Reglas sub-nav
- `src/components/admin/brackets-admin.tsx` — list + create (client)
- `src/components/admin/bracket-manager.tsx` — seed/generate/record (client)
- `src/components/admin/rules-editor.tsx` — rules textarea (client)
- `src/app/admin/brackets/page.tsx` — bracket list (RSC)
- `src/app/admin/brackets/[id]/page.tsx` — manage one bracket (RSC)
- `src/app/admin/reglas/page.tsx` — rules editor (RSC)
- `src/components/torneo/bracket-view.tsx` — public read-only bracket render
- `src/app/torneo/page.tsx` — public tournament page (RSC)

**Modify:**
- `src/types/database.ts` — add enum + 4 tables
- `src/actions/admin.ts` — use shared `requireAdmin`
- `src/config/event.config.ts` — add `tournament` block
- `src/app/admin/page.tsx` — render `<AdminNav>`
- `src/app/page.tsx` — add "Torneo" nav link (when enabled)
- `supabase/seed.sql` — seed `settings.rules_body`

---

## Task 1: Pure single-elim generator

**Files:**
- Create: `src/lib/bracket.ts`
- Test: `src/lib/__tests__/bracket.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/bracket.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  nextPowerOfTwo,
  generateSingleElim,
  applyResult,
  roundLabel,
  type Seed,
} from "@/lib/bracket";

function seeds(n: number): Seed[] {
  return Array.from({ length: n }, (_, i) => ({
    teamId: `t${i + 1}`,
    teamName: `Equipo ${i + 1}`,
  }));
}

describe("nextPowerOfTwo", () => {
  it("rounds up to the next power of two", () => {
    expect(nextPowerOfTwo(2)).toBe(2);
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(8)).toBe(8);
  });
});

describe("generateSingleElim", () => {
  it("throws with fewer than 2 seeds", () => {
    expect(() => generateSingleElim(seeds(1))).toThrow();
  });

  it("builds a single final for 2 teams, no byes", () => {
    const m = generateSingleElim(seeds(2));
    expect(m).toHaveLength(1);
    expect(m[0].round).toBe(1);
    expect(m[0].isBye).toBe(false);
    expect(m[0].nextRound).toBeNull();
  });

  it("builds 3 matches over 2 rounds for 4 teams, no byes", () => {
    const m = generateSingleElim(seeds(4));
    expect(m).toHaveLength(3);
    expect(m.filter((x) => x.round === 1)).toHaveLength(2);
    expect(m.filter((x) => x.round === 2)).toHaveLength(1);
    expect(m.some((x) => x.isBye)).toBe(false);
    // both round-1 matches feed the final (round 2, position 0)
    for (const r1 of m.filter((x) => x.round === 1)) {
      expect(r1.nextRound).toBe(2);
      expect(r1.nextPosition).toBe(0);
    }
  });

  it("separates seed 1 and seed 2 until the final (4 teams)", () => {
    const m = generateSingleElim(seeds(4));
    const r1 = m.filter((x) => x.round === 1);
    const seed1Match = r1.find((x) => x.team1Id === "t1" || x.team2Id === "t1")!;
    const seed2Match = r1.find((x) => x.team1Id === "t2" || x.team2Id === "t2")!;
    expect(seed1Match.position).not.toBe(seed2Match.position);
  });

  it("gives byes to top seeds for 3 teams (1 bye)", () => {
    const m = generateSingleElim(seeds(3));
    const byes = m.filter((x) => x.isBye);
    expect(byes).toHaveLength(1);
    // the bye belongs to seed 1 and pre-sets it as winner
    expect(byes[0].winnerTeamId).toBe("t1");
  });

  it("creates 7 matches and 3 byes for 5 teams", () => {
    const m = generateSingleElim(seeds(5));
    expect(m).toHaveLength(7); // 4 + 2 + 1
    expect(m.filter((x) => x.isBye)).toHaveLength(3);
    expect(Math.max(...m.map((x) => x.round))).toBe(3);
  });

  it("creates 7 matches and 0 byes for 8 teams", () => {
    const m = generateSingleElim(seeds(8));
    expect(m).toHaveLength(7);
    expect(m.filter((x) => x.isBye)).toHaveLength(0);
  });
});

describe("applyResult", () => {
  it("returns the winning slot", () => {
    expect(applyResult(21, 18)).toBe(1);
    expect(applyResult(15, 21)).toBe(2);
  });
  it("throws on a tie", () => {
    expect(() => applyResult(10, 10)).toThrow();
  });
});

describe("roundLabel", () => {
  it("labels rounds from the final backwards", () => {
    expect(roundLabel(3, 3)).toBe("Final");
    expect(roundLabel(2, 3)).toBe("Semifinal");
    expect(roundLabel(1, 3)).toBe("Cuartos");
    expect(roundLabel(1, 5)).toBe("Ronda 1");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/bracket.test.ts`
Expected: FAIL — `Cannot find module '@/lib/bracket'`.

- [ ] **Step 3: Implement the generator**

Create `src/lib/bracket.ts`:

```ts
// Pure single-elimination bracket generator. No DB, no I/O — unit-tested.
// The DB ids of next matches are unknown here, so links are emitted as
// structural coordinates (nextRound/nextPosition/nextSlot); the action layer
// resolves them to next_match_id after inserting rows.

export type Seed = { teamId: string; teamName: string };

export type GeneratedMatch = {
  round: number; // 1-based; 1 = first round
  position: number; // 0-based within the round (top → bottom)
  team1Id: string | null;
  team1Name: string | null;
  team2Id: string | null;
  team2Name: string | null;
  isBye: boolean; // round-1 match with exactly one team
  winnerTeamId: string | null; // pre-set only for byes
  winnerName: string | null;
  nextRound: number | null;
  nextPosition: number | null;
  nextSlot: 1 | 2 | null;
};

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Standard bracket seeding sequence for `size` slots (values 1..size), arranged
// so consecutive pairs are the round-1 matchups and seed 1 cannot meet seed 2
// before the final. e.g. size 4 -> [1,4,2,3]; size 8 -> [1,8,4,5,2,7,3,6].
export function seedOrder(size: number): number[] {
  let pols = [1, 2];
  while (pols.length < size) {
    const sum = pols.length * 2 + 1;
    const next: number[] = [];
    for (const p of pols) {
      next.push(p);
      next.push(sum - p);
    }
    pols = next;
  }
  return pols;
}

const FINAL_LABELS = ["Final", "Semifinal", "Cuartos", "Octavos"];

export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round; // 0 = final
  return FINAL_LABELS[fromEnd] ?? `Ronda ${round}`;
}

export function applyResult(score1: number, score2: number): 1 | 2 {
  if (!Number.isFinite(score1) || !Number.isFinite(score2)) {
    throw new Error("Marcador inválido.");
  }
  if (score1 === score2) {
    throw new Error("No puede haber empate en eliminación sencilla.");
  }
  return score1 > score2 ? 1 : 2;
}

export function generateSingleElim(seeds: Seed[]): GeneratedMatch[] {
  if (seeds.length < 2) {
    throw new Error("Necesitas al menos 2 equipos para generar el bracket.");
  }
  const n = seeds.length;
  const size = nextPowerOfTwo(n);
  const totalRounds = Math.log2(size);
  const order = seedOrder(size);
  const seedAt = (slot: number): Seed | null => {
    const seedNum = order[slot];
    return seedNum <= n ? seeds[seedNum - 1] : null;
  };

  const matches: GeneratedMatch[] = [];

  // Round 1
  const r1Count = size / 2;
  for (let p = 0; p < r1Count; p++) {
    const t1 = seedAt(2 * p);
    const t2 = seedAt(2 * p + 1);
    const isBye = (t1 == null) !== (t2 == null); // exactly one null
    const present = t1 ?? t2;
    const hasNext = totalRounds >= 2;
    matches.push({
      round: 1,
      position: p,
      team1Id: t1?.teamId ?? null,
      team1Name: t1?.teamName ?? null,
      team2Id: t2?.teamId ?? null,
      team2Name: t2?.teamName ?? null,
      isBye,
      winnerTeamId: isBye ? present!.teamId : null,
      winnerName: isBye ? present!.teamName : null,
      nextRound: hasNext ? 2 : null,
      nextPosition: hasNext ? Math.floor(p / 2) : null,
      nextSlot: hasNext ? (p % 2 === 0 ? 1 : 2) : null,
    });
  }

  // Rounds 2..totalRounds — empty, linked forward.
  for (let r = 2; r <= totalRounds; r++) {
    const count = size / Math.pow(2, r);
    for (let p = 0; p < count; p++) {
      const isFinal = r === totalRounds;
      matches.push({
        round: r,
        position: p,
        team1Id: null,
        team1Name: null,
        team2Id: null,
        team2Name: null,
        isBye: false,
        winnerTeamId: null,
        winnerName: null,
        nextRound: isFinal ? null : r + 1,
        nextPosition: isFinal ? null : Math.floor(p / 2),
        nextSlot: isFinal ? null : p % 2 === 0 ? 1 : 2,
      });
    }
  }

  return matches;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/bracket.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket.ts src/lib/__tests__/bracket.test.ts
git commit -m "feat(bracket): pure single-elim generator with byes + tests"
```

---

## Task 2: Database migrations, types, and seed

**Files:**
- Create: `supabase/migrations/004_brackets.sql`, `005_brackets_rls.sql`, `006_brackets_triggers.sql`
- Modify: `src/types/database.ts`, `supabase/seed.sql`

- [ ] **Step 1: Write the schema migration**

Create `supabase/migrations/004_brackets.sql`:

```sql
-- ============================================================
-- BRACKETS (single-elimination tournament brackets)
-- Curated by the admin from confirmed teams. Sensitive-adjacent
-- (references teams) -> RLS deny-all (see 005); all access via service role.
-- Team NAMES are snapshotted so a deleted/renamed team can't corrupt the tree.
-- ============================================================
create type bracket_status as enum ('draft', 'active', 'completed');

create table public.brackets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tournament_id uuid references public.tournaments(id) on delete set null,
  status bracket_status not null default 'draft',
  is_published boolean not null default false,
  champion_team_id uuid references public.teams(id) on delete set null,
  champion_name text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seeding scratchpad: the curated, ordered participant list (draft stage).
create table public.bracket_teams (
  bracket_id uuid not null references public.brackets(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  team_name text not null,            -- snapshot
  seed int not null,                  -- 1-based
  primary key (bracket_id, team_id)
);

-- The generated knockout tree.
create table public.bracket_matches (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.brackets(id) on delete cascade,
  round int not null,                 -- 1 = first round, increases toward final
  position int not null,              -- 0-based within round
  team1_id uuid references public.teams(id) on delete set null,
  team2_id uuid references public.teams(id) on delete set null,
  team1_name text,                    -- snapshot; null = empty/bye slot
  team2_name text,
  score1 int,
  score2 int,
  winner_team_id uuid references public.teams(id) on delete set null,
  winner_name text,
  next_match_id uuid references public.bracket_matches(id) on delete set null,
  next_slot int,                      -- 1 or 2
  is_bye boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Generic key/value for admin-editable site text (rules of play live here).
create table public.settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

create index idx_bracket_matches_bracket on public.bracket_matches(bracket_id, round, position);
create index idx_bracket_teams_bracket on public.bracket_teams(bracket_id);
create index idx_brackets_published on public.brackets(is_published);
```

- [ ] **Step 2: Write the RLS migration**

Create `supabase/migrations/005_brackets_rls.sql`:

```sql
-- Deny-all to anon, exactly like teams/players (see 002_rls_policies.sql).
-- RLS enabled + zero policies = no anon read/write. The service-role client
-- in Server Actions bypasses RLS and is the only access path.
alter table public.brackets enable row level security;
alter table public.bracket_teams enable row level security;
alter table public.bracket_matches enable row level security;
alter table public.settings enable row level security;
-- (intentionally NO policies)
```

- [ ] **Step 3: Write the triggers migration**

Create `supabase/migrations/006_brackets_triggers.sql`:

```sql
-- Reuse public.update_updated_at() defined in 003_triggers.sql.
create trigger on_bracket_update
  before update on public.brackets
  for each row execute function public.update_updated_at();

create trigger on_bracket_match_update
  before update on public.bracket_matches
  for each row execute function public.update_updated_at();
```

- [ ] **Step 4: Seed the rules placeholder**

Append to `supabase/seed.sql`:

```sql

-- Initial rules-of-play placeholder (admin edits this from /admin/reglas).
insert into public.settings (key, value)
values ('rules_body', e'Reglas por confirmar.\n\n- 1v1: a 11 puntos (gana por 2)\n- 5v5: 2 periodos de 10 minutos\n- La decisión de los árbitros es final')
on conflict (key) do nothing;
```

- [ ] **Step 5: Add the types**

In `src/types/database.ts`, add these four table entries inside `public.Tables` (after `players`):

```ts
      brackets: {
        Row: {
          id: string;
          name: string;
          tournament_id: string | null;
          status: "draft" | "active" | "completed";
          is_published: boolean;
          champion_team_id: string | null;
          champion_name: string | null;
          sort_order: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          tournament_id?: string | null;
          status?: "draft" | "active" | "completed";
          is_published?: boolean;
          champion_team_id?: string | null;
          champion_name?: string | null;
          sort_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          tournament_id?: string | null;
          status?: "draft" | "active" | "completed";
          is_published?: boolean;
          champion_team_id?: string | null;
          champion_name?: string | null;
          sort_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bracket_teams: {
        Row: {
          bracket_id: string;
          team_id: string;
          team_name: string;
          seed: number;
        };
        Insert: {
          bracket_id: string;
          team_id: string;
          team_name: string;
          seed: number;
        };
        Update: {
          bracket_id?: string;
          team_id?: string;
          team_name?: string;
          seed?: number;
        };
        Relationships: [];
      };
      bracket_matches: {
        Row: {
          id: string;
          bracket_id: string;
          round: number;
          position: number;
          team1_id: string | null;
          team2_id: string | null;
          team1_name: string | null;
          team2_name: string | null;
          score1: number | null;
          score2: number | null;
          winner_team_id: string | null;
          winner_name: string | null;
          next_match_id: string | null;
          next_slot: number | null;
          is_bye: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bracket_id: string;
          round: number;
          position: number;
          team1_id?: string | null;
          team2_id?: string | null;
          team1_name?: string | null;
          team2_name?: string | null;
          score1?: number | null;
          score2?: number | null;
          winner_team_id?: string | null;
          winner_name?: string | null;
          next_match_id?: string | null;
          next_slot?: number | null;
          is_bye?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          bracket_id?: string;
          round?: number;
          position?: number;
          team1_id?: string | null;
          team2_id?: string | null;
          team1_name?: string | null;
          team2_name?: string | null;
          score1?: number | null;
          score2?: number | null;
          winner_team_id?: string | null;
          winner_name?: string | null;
          next_match_id?: string | null;
          next_slot?: number | null;
          is_bye?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: { key: string; value: string | null; updated_at: string };
        Insert: { key: string; value?: string | null; updated_at?: string };
        Update: { key?: string; value?: string | null; updated_at?: string };
        Relationships: [];
      };
```

Then add the enum to `public.Enums`:

```ts
      bracket_status: "draft" | "active" | "completed";
```

- [ ] **Step 6: Apply migrations + seed in Supabase, then verify types compile**

Run the new SQL in the Supabase SQL editor in order: `004_brackets.sql`, `005_brackets_rls.sql`, `006_brackets_triggers.sql`, then the new `settings` insert from `seed.sql`.

Verify the type file compiles: `npx tsc --noEmit`
Expected: no errors.

Smoke-check in the SQL editor that the rules row exists:
```sql
select key, left(value, 40) from public.settings where key = 'rules_body';
```
Expected: one row.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/004_brackets.sql supabase/migrations/005_brackets_rls.sql supabase/migrations/006_brackets_triggers.sql supabase/seed.sql src/types/database.ts
git commit -m "feat(bracket): schema, RLS deny-all, triggers, types, rules seed"
```

---

## Task 3: Extract shared `requireAdmin` guard

**Files:**
- Create: `src/lib/admin-guard.ts`
- Modify: `src/actions/admin.ts:10-15`

DRY: both `actions/admin.ts` and the new `actions/brackets.ts` need `requireAdmin`. Extract it once.

- [ ] **Step 1: Create the shared guard**

Create `src/lib/admin-guard.ts`:

```ts
import { cookies } from "next/headers";
import { verifySession, ADMIN_COOKIE } from "@/lib/admin-session";

// Throws "No autorizado" when the signed admin cookie is missing/invalid.
// Called at the top of EVERY admin action — never trust the proxy alone.
export async function requireAdmin(): Promise<void> {
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!(await verifySession(cookie))) {
    throw new Error("No autorizado");
  }
}
```

- [ ] **Step 2: Use it in `actions/admin.ts`**

In `src/actions/admin.ts`, delete the local `requireAdmin` function (lines 10-15) and add this import after the existing imports (near line 8):

```ts
import { requireAdmin } from "@/lib/admin-guard";
```

Remove the now-unused `verifySession`/`ADMIN_COOKIE` from the `admin-session` import line **only if** they are no longer referenced elsewhere in the file (note: `signSession` and `ADMIN_COOKIE` are still used by `adminLogin`/`adminLogout`, so keep those — only `verifySession` becomes unused). The line should become:

```ts
import { signSession, ADMIN_COOKIE } from "@/lib/admin-session";
```

- [ ] **Step 3: Verify build + existing tests still pass**

Run: `npm run lint && npx vitest run`
Expected: lint clean; all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/admin-guard.ts src/actions/admin.ts
git commit -m "refactor(admin): extract shared requireAdmin guard"
```

---

## Task 4: Read layer + admin Server Actions

**Files:**
- Create: `src/lib/brackets-public.ts`, `src/lib/settings.ts`, `src/actions/brackets.ts`

- [ ] **Step 1: Public read layer**

Create `src/lib/brackets-public.ts`:

```ts
import { createAdminClient } from "@/lib/supabase/admin";

// Public-safe shapes — NAMES and scores only, never captain phones.
export type PublicMatch = {
  id: string;
  round: number;
  position: number;
  team1_name: string | null;
  team2_name: string | null;
  score1: number | null;
  score2: number | null;
  winner_name: string | null;
  is_bye: boolean;
};

export type PublicBracket = {
  id: string;
  name: string;
  status: "draft" | "active" | "completed";
  champion_name: string | null;
  matches: PublicMatch[];
};

export async function getPublishedBrackets(): Promise<PublicBracket[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("brackets")
    .select(
      "id, name, status, champion_name, sort_order, bracket_matches(id, round, position, team1_name, team2_name, score1, score2, winner_name, is_bye)"
    )
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  return (data ?? []).map((b) => {
    const matches = ((b.bracket_matches ?? []) as PublicMatch[])
      .slice()
      .sort((x, y) => x.round - y.round || x.position - y.position);
    return {
      id: b.id,
      name: b.name,
      status: b.status,
      champion_name: b.champion_name,
      matches,
    };
  });
}
```

- [ ] **Step 2: Settings read**

Create `src/lib/settings.ts`:

```ts
import { createAdminClient } from "@/lib/supabase/admin";

export async function getRulesBody(): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "rules_body")
    .maybeSingle();
  return data?.value ?? "";
}
```

- [ ] **Step 3: Admin actions**

Create `src/actions/brackets.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { generateSingleElim, applyResult, type Seed } from "@/lib/bracket";

// ---------- Admin reads (gated; used by protected RSC pages) ----------

export type AdminBracketRow = {
  id: string;
  name: string;
  status: "draft" | "active" | "completed";
  is_published: boolean;
  champion_name: string | null;
};

export async function listBracketsAdmin(): Promise<AdminBracketRow[]> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("brackets")
    .select("id, name, status, is_published, champion_name")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as AdminBracketRow[] | null) ?? [];
}

export async function getBracketAdmin(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: bracket } = await supabase
    .from("brackets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!bracket) return null;

  const { data: teams } = await supabase
    .from("bracket_teams")
    .select("team_id, team_name, seed")
    .eq("bracket_id", id)
    .order("seed", { ascending: true });

  const { data: matches } = await supabase
    .from("bracket_matches")
    .select("*")
    .eq("bracket_id", id)
    .order("round", { ascending: true })
    .order("position", { ascending: true });

  return { bracket, teams: teams ?? [], matches: matches ?? [] };
}

export type PickableTeam = { id: string; team_name: string; age_bracket: string | null; inBracket: boolean };

export async function listConfirmedTeamsForBracket(bracketId: string): Promise<PickableTeam[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: bracket } = await supabase
    .from("brackets")
    .select("tournament_id")
    .eq("id", bracketId)
    .maybeSingle();

  let q = supabase
    .from("teams")
    .select("id, team_name, age_bracket")
    .eq("status", "confirmed")
    .order("created_at", { ascending: true });
  if (bracket?.tournament_id) q = q.eq("tournament_id", bracket.tournament_id);
  const { data: teams } = await q;

  const { data: inRows } = await supabase
    .from("bracket_teams")
    .select("team_id")
    .eq("bracket_id", bracketId);
  const inSet = new Set((inRows ?? []).map((r) => r.team_id));

  return (teams ?? []).map((t) => ({
    id: t.id,
    team_name: t.team_name,
    age_bracket: t.age_bracket,
    inBracket: inSet.has(t.id),
  }));
}

// ---------- Admin writes ----------

export async function createBracket(name: string, tournamentId?: string | null) {
  await requireAdmin();
  const clean = name.trim();
  if (!clean) throw new Error("El bracket necesita un nombre.");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("brackets")
    .insert({ name: clean, tournament_id: tournamentId ?? null });
  if (error) throw new Error("Error al crear el bracket.");
  revalidatePath("/admin/brackets");
}

export async function setBracketTeams(bracketId: string, teamIds: string[]) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: b } = await supabase.from("brackets").select("status").eq("id", bracketId).maybeSingle();
  if (b?.status !== "draft") throw new Error("Reinicia el bracket para cambiar los equipos.");

  const ids = teamIds.length ? teamIds : ["00000000-0000-0000-0000-000000000000"];
  const { data: teams } = await supabase.from("teams").select("id, team_name").in("id", ids);
  const nameById = new Map((teams ?? []).map((t) => [t.id, t.team_name]));

  await supabase.from("bracket_teams").delete().eq("bracket_id", bracketId);
  if (teamIds.length) {
    const rows = teamIds.map((id, i) => ({
      bracket_id: bracketId,
      team_id: id,
      team_name: nameById.get(id) ?? "—",
      seed: i + 1,
    }));
    const { error } = await supabase.from("bracket_teams").insert(rows);
    if (error) throw new Error("Error al guardar los equipos.");
  }
  revalidatePath(`/admin/brackets/${bracketId}`);
}

export async function reorderSeed(bracketId: string, teamId: string, direction: "up" | "down") {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: b } = await supabase.from("brackets").select("status").eq("id", bracketId).maybeSingle();
  if (b?.status !== "draft") throw new Error("Reinicia el bracket para cambiar la siembra.");

  const { data: rows } = await supabase
    .from("bracket_teams")
    .select("team_id, seed")
    .eq("bracket_id", bracketId)
    .order("seed", { ascending: true });
  const list = rows ?? [];
  const idx = list.findIndex((r) => r.team_id === teamId);
  if (idx === -1) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) return;

  const a = list[idx];
  const c = list[swapIdx];
  await supabase.from("bracket_teams").update({ seed: c.seed }).eq("bracket_id", bracketId).eq("team_id", a.team_id);
  await supabase.from("bracket_teams").update({ seed: a.seed }).eq("bracket_id", bracketId).eq("team_id", c.team_id);
  revalidatePath(`/admin/brackets/${bracketId}`);
}

export async function generateBracket(bracketId: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  // Guard: don't silently wipe recorded results.
  const { data: existing } = await supabase
    .from("bracket_matches")
    .select("id, winner_team_id")
    .eq("bracket_id", bracketId);
  if ((existing ?? []).some((m) => m.winner_team_id)) {
    throw new Error("Ya hay resultados. Reinicia el bracket antes de regenerar.");
  }
  await supabase.from("bracket_matches").delete().eq("bracket_id", bracketId);

  const { data: bteams } = await supabase
    .from("bracket_teams")
    .select("team_id, team_name, seed")
    .eq("bracket_id", bracketId)
    .order("seed", { ascending: true });

  const seeds: Seed[] = (bteams ?? []).map((t) => ({ teamId: t.team_id, teamName: t.team_name }));

  let generated;
  try {
    generated = generateSingleElim(seeds);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "No se pudo generar el bracket.");
  }

  const { data: inserted, error } = await supabase
    .from("bracket_matches")
    .insert(
      generated.map((m) => ({
        bracket_id: bracketId,
        round: m.round,
        position: m.position,
        team1_id: m.team1Id,
        team1_name: m.team1Name,
        team2_id: m.team2Id,
        team2_name: m.team2Name,
        is_bye: m.isBye,
        winner_team_id: m.winnerTeamId,
        winner_name: m.winnerName,
      }))
    )
    .select("id, round, position");
  if (error || !inserted) throw new Error("Error al crear los partidos.");

  const idByKey = new Map<string, string>();
  for (const r of inserted) idByKey.set(`${r.round}-${r.position}`, r.id);

  // Resolve next-match links and propagate bye winners into the next slot.
  for (const m of generated) {
    if (m.nextRound == null) continue;
    const id = idByKey.get(`${m.round}-${m.position}`)!;
    const nextId = idByKey.get(`${m.nextRound}-${m.nextPosition}`)!;
    await supabase
      .from("bracket_matches")
      .update({ next_match_id: nextId, next_slot: m.nextSlot })
      .eq("id", id);
    if (m.isBye && m.winnerTeamId) {
      const patch =
        m.nextSlot === 1
          ? { team1_id: m.winnerTeamId, team1_name: m.winnerName }
          : { team2_id: m.winnerTeamId, team2_name: m.winnerName };
      await supabase.from("bracket_matches").update(patch).eq("id", nextId);
    }
  }

  await supabase
    .from("brackets")
    .update({ status: "active", champion_team_id: null, champion_name: null })
    .eq("id", bracketId);
  revalidatePath(`/admin/brackets/${bracketId}`);
  revalidatePath("/torneo");
}

export async function resetBracket(bracketId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  await supabase.from("bracket_matches").delete().eq("bracket_id", bracketId);
  await supabase
    .from("brackets")
    .update({ status: "draft", champion_team_id: null, champion_name: null })
    .eq("id", bracketId);
  revalidatePath(`/admin/brackets/${bracketId}`);
  revalidatePath("/torneo");
}

export async function recordResult(matchId: string, score1: number, score2: number) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: m } = await supabase.from("bracket_matches").select("*").eq("id", matchId).maybeSingle();
  if (!m) throw new Error("Partido no encontrado.");
  if (!m.team1_id || !m.team2_id) throw new Error("Faltan equipos en este partido.");
  if (score1 < 0 || score2 < 0) throw new Error("Marcador inválido.");

  let winningSlot: 1 | 2;
  try {
    winningSlot = applyResult(score1, score2);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Marcador inválido.");
  }
  const winnerId = winningSlot === 1 ? m.team1_id : m.team2_id;
  const winnerName = winningSlot === 1 ? m.team1_name : m.team2_name;

  await supabase
    .from("bracket_matches")
    .update({ score1, score2, winner_team_id: winnerId, winner_name: winnerName })
    .eq("id", matchId);

  if (m.next_match_id) {
    const patch =
      m.next_slot === 1
        ? { team1_id: winnerId, team1_name: winnerName }
        : { team2_id: winnerId, team2_name: winnerName };
    await supabase.from("bracket_matches").update(patch).eq("id", m.next_match_id);
  } else {
    await supabase
      .from("brackets")
      .update({ status: "completed", champion_team_id: winnerId, champion_name: winnerName })
      .eq("id", m.bracket_id);
  }
  revalidatePath(`/admin/brackets/${m.bracket_id}`);
  revalidatePath("/torneo");
}

export async function clearResult(matchId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: m } = await supabase.from("bracket_matches").select("*").eq("id", matchId).maybeSingle();
  if (!m) throw new Error("Partido no encontrado.");

  if (m.next_match_id) {
    const { data: next } = await supabase
      .from("bracket_matches")
      .select("winner_team_id")
      .eq("id", m.next_match_id)
      .maybeSingle();
    if (next?.winner_team_id) throw new Error("Primero borra el resultado del partido siguiente.");
    const patch =
      m.next_slot === 1
        ? { team1_id: null, team1_name: null }
        : { team2_id: null, team2_name: null };
    await supabase.from("bracket_matches").update(patch).eq("id", m.next_match_id);
  } else {
    await supabase
      .from("brackets")
      .update({ status: "active", champion_team_id: null, champion_name: null })
      .eq("id", m.bracket_id);
  }
  await supabase
    .from("bracket_matches")
    .update({ score1: null, score2: null, winner_team_id: null, winner_name: null })
    .eq("id", matchId);
  revalidatePath(`/admin/brackets/${m.bracket_id}`);
  revalidatePath("/torneo");
}

export async function setBracketPublished(bracketId: string, published: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  await supabase.from("brackets").update({ is_published: published }).eq("id", bracketId);
  revalidatePath("/admin/brackets");
  revalidatePath(`/admin/brackets/${bracketId}`);
  revalidatePath("/torneo");
}

export async function deleteBracket(bracketId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("brackets").delete().eq("id", bracketId);
  if (error) throw new Error("Error al eliminar el bracket.");
  revalidatePath("/admin/brackets");
  revalidatePath("/torneo");
}

export async function saveRules(body: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "rules_body", value: body, updated_at: new Date().toISOString() });
  if (error) throw new Error("Error al guardar las reglas.");
  revalidatePath("/admin/reglas");
  revalidatePath("/torneo");
}
```

- [ ] **Step 4: Verify it compiles + lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors, lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/brackets-public.ts src/lib/settings.ts src/actions/brackets.ts
git commit -m "feat(bracket): public read layer + admin server actions"
```

---

## Task 5: Config block

**Files:**
- Modify: `src/config/event.config.ts`

- [ ] **Step 1: Add the `tournament` block**

In `src/config/event.config.ts`, add this block right after the `food: {...}` object (before `counter:` added earlier):

```ts
  // Página pública del torneo (/torneo): brackets en vivo + reglas.
  tournament: {
    enabled: true, // muestra /torneo y el enlace "Torneo" en el nav
    navLabel: "Torneo",
    pageTitle: "El Torneo",
    pageIntro: "Brackets en vivo y reglas del torneo.",
    rulesTitle: "Reglas del torneo",
    bracketsEmptyLabel: "Los brackets se publicarán pronto.",
  },
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/config/event.config.ts
git commit -m "feat(bracket): add tournament page config block"
```

---

## Task 6: Admin UI — nav, brackets list/create, manager, rules editor

**Files:**
- Create: `src/components/admin/admin-nav.tsx`, `src/components/admin/brackets-admin.tsx`, `src/components/admin/bracket-manager.tsx`, `src/components/admin/rules-editor.tsx`, `src/app/admin/brackets/page.tsx`, `src/app/admin/brackets/[id]/page.tsx`, `src/app/admin/reglas/page.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Admin sub-nav**

Create `src/components/admin/admin-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Equipos" },
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
```

- [ ] **Step 2: Render the nav on the existing teams page**

In `src/app/admin/page.tsx`, add the import and render `<AdminNav />` above `<TeamsTable>`:

```tsx
import { listTeams } from "@/actions/admin";
import { TeamsTable } from "@/components/admin/teams-table";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata = {
  title: "Admin — Equipos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const teams = await listTeams();

  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Administración</p>
          <h1 className="mt-1 font-display text-5xl font-black uppercase">Equipos inscritos</h1>
        </header>
        <TeamsTable teams={teams} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Brackets list + create page (RSC)**

Create `src/app/admin/brackets/page.tsx`:

```tsx
import { listBracketsAdmin } from "@/actions/brackets";
import { AdminNav } from "@/components/admin/admin-nav";
import { BracketsAdmin } from "@/components/admin/brackets-admin";

export const metadata = {
  title: "Admin — Brackets",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminBracketsPage() {
  const brackets = await listBracketsAdmin();
  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Administración</p>
          <h1 className="mt-1 font-display text-5xl font-black uppercase">Brackets</h1>
        </header>
        <BracketsAdmin brackets={brackets} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Brackets list + create client component**

Create `src/components/admin/brackets-admin.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import {
  createBracket,
  setBracketPublished,
  deleteBracket,
  type AdminBracketRow,
} from "@/actions/brackets";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL = { draft: "Borrador", active: "En juego", completed: "Finalizado" } as const;

export function BracketsAdmin({ brackets }: { brackets: AdminBracketRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function act(fn: () => Promise<void>, okMsg: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(okMsg);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <div className="space-y-6">
      <form
        className="flex flex-col gap-3 sm:flex-row"
        action={() => {
          if (!name.trim()) return;
          act(async () => {
            await createBracket(name);
            setName("");
          }, "Bracket creado");
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Nombre del bracket (ej. 5v5 Femenino Abierta)"
        />
        <Button type="submit" disabled={pending || !name.trim()}>
          Crear bracket
        </Button>
      </form>

      {brackets.length === 0 ? (
        <p className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">
          Aún no hay brackets. Crea el primero arriba.
        </p>
      ) : (
        <div className="space-y-3">
          {brackets.map((b) => (
            <article
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/70 p-5"
            >
              <div>
                <Link href={`/admin/brackets/${b.id}`} className="font-display text-2xl font-black uppercase hover:text-primary">
                  {b.name}
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={b.status === "completed" ? "confirmed" : b.status === "active" ? "paid" : "pending"}>
                    {STATUS_LABEL[b.status]}
                  </Badge>
                  {b.champion_name && (
                    <span className="text-sm text-muted-foreground">🏆 {b.champion_name}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/brackets/${b.id}`}>
                  <Button size="sm" variant="outline">Gestionar</Button>
                </Link>
                <Button
                  size="sm"
                  variant={b.is_published ? "ghost" : "secondary"}
                  disabled={pending}
                  onClick={() => act(() => setBracketPublished(b.id, !b.is_published), b.is_published ? "Oculto" : "Publicado")}
                >
                  {b.is_published ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  {b.is_published ? "Ocultar" : "Publicar"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`¿Eliminar el bracket "${b.name}"?`)) {
                      act(() => deleteBracket(b.id), "Bracket eliminado");
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Bracket manage page (RSC)**

Create `src/app/admin/brackets/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getBracketAdmin, listConfirmedTeamsForBracket } from "@/actions/brackets";
import { AdminNav } from "@/components/admin/admin-nav";
import { BracketManager } from "@/components/admin/bracket-manager";

export const metadata = {
  title: "Admin — Gestionar bracket",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ManageBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getBracketAdmin(id);
  if (!data) notFound();
  const pickable = await listConfirmedTeamsForBracket(id);

  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <BracketManager
          bracket={data.bracket}
          teams={data.teams}
          matches={data.matches}
          pickable={pickable}
        />
      </div>
    </main>
  );
}
```

Note: Next.js 16 passes `params` as a Promise — it must be awaited (see `node_modules/next/dist/docs/` if unsure).

- [ ] **Step 6: Bracket manager client component**

Create `src/components/admin/bracket-manager.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Trophy } from "lucide-react";
import {
  setBracketTeams,
  reorderSeed,
  generateBracket,
  resetBracket,
  recordResult,
  clearResult,
  type PickableTeam,
} from "@/actions/brackets";
import { roundLabel } from "@/lib/bracket";
import type { Database } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Bracket = Database["public"]["Tables"]["brackets"]["Row"];
type BracketTeam = { team_id: string; team_name: string; seed: number };
type Match = Database["public"]["Tables"]["bracket_matches"]["Row"];

export function BracketManager({
  bracket,
  teams,
  matches,
  pickable,
}: {
  bracket: Bracket;
  teams: BracketTeam[];
  matches: Match[];
  pickable: PickableTeam[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isDraft = bracket.status === "draft";
  const selectedIds = new Set(teams.map((t) => t.team_id));

  function act(fn: () => Promise<void>, okMsg: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(okMsg);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  function toggleTeam(teamId: string) {
    const next = new Set(selectedIds);
    if (next.has(teamId)) next.delete(teamId);
    else next.add(teamId);
    // Preserve current seed order, append new picks at the end.
    const ordered = [
      ...teams.filter((t) => next.has(t.team_id)).map((t) => t.team_id),
      ...[...next].filter((id) => !selectedIds.has(id)),
    ];
    act(() => setBracketTeams(bracket.id, ordered), "Equipos actualizados");
  }

  const totalRounds = matches.length ? Math.max(...matches.map((m) => m.round)) : 0;
  const byRound = matches.reduce<Record<number, Match[]>>((acc, m) => {
    (acc[m.round] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-black uppercase">{bracket.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estado: {bracket.status === "draft" ? "Borrador" : bracket.status === "active" ? "En juego" : "Finalizado"}
          {bracket.champion_name ? ` · 🏆 ${bracket.champion_name}` : ""}
        </p>
      </header>

      {isDraft ? (
        <>
          <section>
            <h2 className="mb-3 font-display text-sm uppercase tracking-[0.3em] text-primary">1 · Elige equipos confirmados</h2>
            {pickable.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay equipos confirmados para esta categoría todavía.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {pickable.map((t) => (
                  <label key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleTeam(t.id)}
                      disabled={pending}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className="text-sm">
                      {t.team_name}
                      {t.age_bracket ? <span className="text-muted-foreground"> · {t.age_bracket}</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {teams.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-sm uppercase tracking-[0.3em] text-primary">2 · Siembra (orden)</h2>
              <ol className="space-y-2">
                {teams.map((t, i) => (
                  <li key={t.team_id} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border font-display text-sm text-primary">
                      {t.seed}
                    </span>
                    <span className="flex-1 text-sm">{t.team_name}</span>
                    <Button size="sm" variant="ghost" disabled={pending || i === 0} onClick={() => act(() => reorderSeed(bracket.id, t.team_id, "up"), "Reordenado")}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pending || i === teams.length - 1} onClick={() => act(() => reorderSeed(bracket.id, t.team_id, "down"), "Reordenado")}>
                      <ArrowDown className="size-4" />
                    </Button>
                  </li>
                ))}
              </ol>
              <Button
                className="mt-5"
                disabled={pending || teams.length < 2}
                onClick={() => act(() => generateBracket(bracket.id), "Bracket generado")}
              >
                Generar bracket ({teams.length} equipos)
              </Button>
              {teams.length < 2 && <p className="mt-2 text-xs text-muted-foreground">Necesitas al menos 2 equipos.</p>}
            </section>
          )}
        </>
      ) : (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm uppercase tracking-[0.3em] text-primary">Partidos</h2>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (confirm("¿Reiniciar el bracket? Se borrarán todos los resultados.")) {
                  act(() => resetBracket(bracket.id), "Bracket reiniciado");
                }
              }}
            >
              Reiniciar
            </Button>
          </div>

          {bracket.status === "completed" && bracket.champion_name && (
            <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-6 py-4 glow-orange">
              <Trophy className="size-7 text-primary" />
              <div>
                <p className="font-display text-xs uppercase tracking-widest text-primary">Campeón</p>
                <p className="font-display text-2xl font-black uppercase">{bracket.champion_name}</p>
              </div>
            </div>
          )}

          {Object.keys(byRound)
            .map(Number)
            .sort((a, b) => a - b)
            .map((round) => (
              <div key={round}>
                <h3 className="mb-3 font-display text-lg font-black uppercase">{roundLabel(round, totalRounds)}</h3>
                <div className="space-y-3">
                  {byRound[round]
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((m) => (
                      <MatchAdminCard key={m.id} match={m} pending={pending} act={act} />
                    ))}
                </div>
              </div>
            ))}
        </section>
      )}
    </div>
  );
}

function MatchAdminCard({
  match,
  pending,
  act,
}: {
  match: Match;
  pending: boolean;
  act: (fn: () => Promise<void>, okMsg: string) => void;
}) {
  const [s1, setS1] = useState(match.score1?.toString() ?? "");
  const [s2, setS2] = useState(match.score2?.toString() ?? "");
  const decided = match.winner_team_id != null;
  const ready = match.team1_id && match.team2_id;

  if (match.is_bye) {
    return (
      <article className="rounded-xl border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
        {match.team1_name ?? match.team2_name} avanza (bye)
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-border bg-card/70 px-4 py-3">
      <div className="grid grid-cols-[1fr_auto] items-center gap-2">
        <span className={`text-sm ${match.winner_team_id === match.team1_id ? "font-bold text-primary" : ""}`}>
          {match.team1_name ?? "Por definir"}
        </span>
        <Input
          inputMode="numeric"
          className="h-9 w-16 text-center"
          value={s1}
          disabled={!ready || pending}
          onChange={(e) => setS1(e.target.value.replace(/\D/g, ""))}
        />
        <span className={`text-sm ${match.winner_team_id === match.team2_id ? "font-bold text-primary" : ""}`}>
          {match.team2_name ?? "Por definir"}
        </span>
        <Input
          inputMode="numeric"
          className="h-9 w-16 text-center"
          value={s2}
          disabled={!ready || pending}
          onChange={(e) => setS2(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={!ready || pending || s1 === "" || s2 === ""}
          onClick={() => act(() => recordResult(match.id, Number(s1), Number(s2)), "Resultado guardado")}
        >
          {decided ? "Actualizar" : "Guardar resultado"}
        </Button>
        {decided && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => clearResult(match.id), "Resultado borrado")}>
            Borrar
          </Button>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 7: Rules editor page (RSC) + client**

Create `src/app/admin/reglas/page.tsx`:

```tsx
import { getRulesBody } from "@/lib/settings";
import { AdminNav } from "@/components/admin/admin-nav";
import { RulesEditor } from "@/components/admin/rules-editor";
import { event } from "@/config/event.config";

export const metadata = {
  title: "Admin — Reglas",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminRulesPage() {
  const body = await getRulesBody();
  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Administración</p>
          <h1 className="mt-1 font-display text-5xl font-black uppercase">{event.tournament.rulesTitle}</h1>
        </header>
        <RulesEditor initial={body} />
      </div>
    </main>
  );
}
```

Create `src/components/admin/rules-editor.tsx`:

```tsx
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
        Una línea por regla. Las líneas que empiezan con “- ” se muestran como lista.
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
```

- [ ] **Step 8: Verify build**

Run: `npm run lint && npm run build`
Expected: lint clean; build succeeds with new routes `/admin/brackets`, `/admin/brackets/[id]`, `/admin/reglas`.

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/admin-nav.tsx src/components/admin/brackets-admin.tsx src/components/admin/bracket-manager.tsx src/components/admin/rules-editor.tsx src/app/admin/brackets src/app/admin/reglas src/app/admin/page.tsx
git commit -m "feat(bracket): admin UI — nav, brackets list/manager, rules editor"
```

---

## Task 7: Public `/torneo` page + bracket view + nav link

**Files:**
- Create: `src/components/torneo/bracket-view.tsx`, `src/app/torneo/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Public bracket view (presentational)**

Create `src/components/torneo/bracket-view.tsx`:

```tsx
import { Trophy } from "lucide-react";
import { roundLabel } from "@/lib/bracket";
import type { PublicBracket, PublicMatch } from "@/lib/brackets-public";

function MatchRow({ name, score, winner }: { name: string | null; score: number | null; winner: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-sm ${winner ? "font-bold text-primary" : "text-foreground"}`}>
        {name ?? "Por definir"}
      </span>
      <span className="font-display tabular-nums text-sm text-muted-foreground">{score ?? "—"}</span>
    </div>
  );
}

function MatchCard({ m }: { m: PublicMatch }) {
  if (m.is_bye) {
    return (
      <article className="rounded-xl border border-border/60 bg-card/40 px-4 py-2.5 text-sm text-muted-foreground">
        {m.team1_name ?? m.team2_name} avanza (bye)
      </article>
    );
  }
  return (
    <article className="space-y-1.5 rounded-xl border border-border bg-card/70 px-4 py-3">
      <MatchRow name={m.team1_name} score={m.score1} winner={!!m.winner_name && m.winner_name === m.team1_name} />
      <div className="border-t border-border/50" />
      <MatchRow name={m.team2_name} score={m.score2} winner={!!m.winner_name && m.winner_name === m.team2_name} />
    </article>
  );
}

export function BracketView({ bracket }: { bracket: PublicBracket }) {
  const totalRounds = bracket.matches.length ? Math.max(...bracket.matches.map((m) => m.round)) : 0;
  const rounds = [...new Set(bracket.matches.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 sm:p-7">
      <h3 className="font-display text-2xl font-black uppercase sm:text-3xl">{bracket.name}</h3>

      {bracket.status === "completed" && bracket.champion_name && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-5 py-3 glow-orange">
          <Trophy className="size-6 text-primary" />
          <div>
            <p className="font-display text-xs uppercase tracking-widest text-primary">Campeón</p>
            <p className="font-display text-xl font-black uppercase">{bracket.champion_name}</p>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-6">
        {rounds.map((round) => (
          <div key={round}>
            <h4 className="mb-2 font-display text-sm uppercase tracking-[0.2em] text-muted-foreground">
              {roundLabel(round, totalRounds)}
            </h4>
            <div className="space-y-2.5">
              {bracket.matches
                .filter((m) => m.round === round)
                .sort((a, b) => a.position - b.position)
                .map((m) => (
                  <MatchCard key={m.id} m={m} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Public tournament page (RSC)**

Create `src/app/torneo/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { event } from "@/config/event.config";
import { getPublishedBrackets } from "@/lib/brackets-public";
import { getRulesBody } from "@/lib/settings";
import { buttonVariants } from "@/components/ui/button";
import { BracketView } from "@/components/torneo/bracket-view";
import { SiteFooter } from "@/components/landing/site-footer";

export const metadata = {
  title: `${event.tournament.pageTitle} — ${event.brand.name}`,
  description: event.tournament.pageIntro,
};

function RulesBlock({ body }: { body: string }) {
  const lines = body.split("\n");
  return (
    <div className="space-y-2 text-muted-foreground">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        if (trimmed.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-primary">•</span>
              <span>{trimmed.slice(2)}</span>
            </div>
          );
        }
        return <p key={i} className="text-foreground">{trimmed}</p>;
      })}
    </div>
  );
}

export default async function TorneoPage() {
  if (!event.tournament.enabled) notFound();
  const [brackets, rules] = await Promise.all([getPublishedBrackets(), getRulesBody()]);

  return (
    <main className="relative pb-20">
      <nav className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="font-display text-lg font-black uppercase tracking-wide">
            {event.brand.name}
          </Link>
          <Link href="/registro" className={buttonVariants({ size: "sm" })}>
            Inscríbete
          </Link>
        </div>
      </nav>

      <section className="px-6 pt-14 text-center">
        <h1 className="font-display text-5xl font-black uppercase sm:text-7xl">{event.tournament.pageTitle}</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{event.tournament.pageIntro}</p>
      </section>

      <section className="px-6 py-12">
        <div className="mx-auto max-w-3xl space-y-6">
          {brackets.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card/50 p-10 text-center text-muted-foreground">
              {event.tournament.bracketsEmptyLabel}
            </p>
          ) : (
            brackets.map((b) => <BracketView key={b.id} bracket={b} />)
          )}
        </div>
      </section>

      {rules.trim() && (
        <section className="px-6 py-12">
          <div className="mx-auto max-w-3xl rounded-2xl border border-primary/30 bg-card/60 p-7 glow-orange">
            <h2 className="mb-5 font-display text-3xl font-black uppercase">{event.tournament.rulesTitle}</h2>
            <RulesBlock body={rules} />
          </div>
        </section>
      )}

      <SiteFooter />
    </main>
  );
}
```

- [ ] **Step 3: Add "Torneo" link to the landing nav**

In `src/app/page.tsx`, inside the nav's `<div className="flex items-center gap-2">`, add the Torneo link before the "Categorías" link (only when enabled):

```tsx
          <div className="flex items-center gap-2">
            {event.tournament.enabled && (
              <Link
                href="/torneo"
                className="hidden font-display text-sm uppercase tracking-widest text-muted-foreground hover:text-foreground sm:inline"
              >
                {event.tournament.navLabel}
              </Link>
            )}
            <Link
              href="#categorias"
              className="hidden font-display text-sm uppercase tracking-widest text-muted-foreground hover:text-foreground sm:inline"
            >
              Categorías
            </Link>
            <Link href="/registro" className={buttonVariants({ size: "sm" })}>
              Inscríbete
            </Link>
          </div>
```

- [ ] **Step 4: Verify build**

Run: `npm run lint && npm run build`
Expected: lint clean; build includes `/torneo`.

- [ ] **Step 5: Commit**

```bash
git add src/components/torneo/bracket-view.tsx src/app/torneo/page.tsx src/app/page.tsx
git commit -m "feat(bracket): public /torneo page with brackets + rules"
```

---

## Task 8: Full verification + manual E2E + docs

**Files:**
- Modify: `pasaloVault/10-projects/ka-basket-pr/ka-basket-pr.md` (vault MOC — NOT git), `pasaloVault/10-projects/ka-basket-pr/Decisions.md`

- [ ] **Step 1: Run all gates**

Run: `npm run lint && npx vitest run && npm run build`
Expected: lint clean; all tests pass (bracket + existing); build succeeds with routes `/`, `/registro`, `/equipos`, `/torneo`, `/admin`, `/admin/brackets`, `/admin/brackets/[id]`, `/admin/reglas`, `/admin/login`.

- [ ] **Step 2: Manual E2E (with `npm run dev`, against live Supabase)**

Verify each — these need at least a few **confirmed** teams (confirm some in `/admin` first):

1. `/admin/brackets` → create "Prueba 5v5" → appears in list as Borrador.
2. Open it → check off 5 confirmed teams → they show in the seed list with seeds 1–5.
3. Reorder a couple with ↑/↓ → seeds update.
4. **Generar bracket** → status flips to "En juego"; expect Cuartos/Semifinal/Final sections; 3 byes pre-advanced (top seeds shown in round 2).
5. Enter scores up the tree (e.g. 21–18) → winners advance; final result sets the 🏆 champion and status "Finalizado".
6. **Borrar** a leaf result → it clears and the downstream slot empties; verify it refuses if the next match already has a result.
7. **Reiniciar** → back to Borrador, matches gone.
8. **Publicar** → visit `/torneo` on a narrow (≈390px) viewport: bracket renders as stacked rounds, champion banner shows; an unpublished bracket does NOT appear.
9. `/admin/reglas` → edit text, Guardar → `/torneo` rules section reflects it; reload persists.

- [ ] **Step 3: Security check**

In the Supabase SQL editor or via REST with the **anon** key, attempt to read `brackets` / `bracket_matches` / `settings` → forbidden/empty (RLS deny confirmed). Confirm no bracket payload on `/torneo` contains captain phone fields (only names + scores).

- [ ] **Step 4: Update the vault (per CLAUDE.md conventions)**

Add a dated entry (newest first) to the **Recent activity** log in `pasaloVault/10-projects/ka-basket-pr/ka-basket-pr.md` describing the bracket + rules feature, move the fase-2 bracket item in **Current focus** to done, and bump `updated:` to the implementation date. Add an ADR to `Decisions.md` (next `D<n>`) capturing: single-elim only, admin-curated team selection (manual age-bracket grouping), name snapshots for resilience, bracket tables RLS deny-all via service-role, rules in a DB `settings` table (not config) for phone-side editing. Verify against the repo before writing.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "docs(bracket): verification notes; feature complete"
```

(Do NOT push — pushes happen only when the user explicitly asks.)

---

## Self-review notes (addressed)

- **Spec coverage:** generator (T1), schema/RLS/triggers/types/seed (T2), shared guard (T3), read layer + actions incl. all spec'd functions `createBracket`/`setBracketTeams`/`reorderSeed`/`generateBracket`/`resetBracket`/`recordResult`/`clearResult`/`setBracketPublished`/`deleteBracket`/`saveRules` (T4), config (T5), admin UI incl. sub-nav/list/manager/rules (T6), public `/torneo` + nav (T7), verification + security + docs (T8). Mobile-first stacked rounds: T6 manager + T7 view. Name snapshots: T2 schema + T4 writes.
- **Type consistency:** `Seed`, `GeneratedMatch`, `PublicBracket`/`PublicMatch`, `AdminBracketRow`, `PickableTeam` defined once and imported where used; `roundLabel(round, totalRounds)` signature identical in lib, manager, and view; action names match between `actions/brackets.ts` and every component import.
- **No placeholders:** every code step contains complete, runnable code; SQL is concrete; commands have expected output.
- **Next 16:** `params` awaited in the dynamic route; `revalidatePath` used on every mutation; service-role-only access preserves the deny-all model.
