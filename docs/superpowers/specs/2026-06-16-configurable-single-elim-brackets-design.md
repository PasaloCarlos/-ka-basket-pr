# Configurable single-elimination brackets + admin-editable rules

**Date:** 2026-06-16
**Project:** ka-basket-pr
**Status:** Approved design — ready for implementation plan

## Summary

Add a tournament feature to the KA Basket PR event site with two parts:

1. **Configurable single-elimination brackets** — the admin curates a bracket from
   confirmed teams, the app auto-seeds a knockout tree (with byes), the admin reorders
   seeds, locks it, and records match results (winner + final score) courtside; winners
   advance automatically. The public sees published brackets live, read-only.
2. **Admin-editable rules of play** — a rules-of-play text block stored in the DB and
   edited from `/admin` (no redeploy), shown publicly alongside the brackets.

This is the "fase-2" feature parked earlier; it is built now because the user wants it
configurable with rules they enter.

### Decisions locked during brainstorming

- **Scope:** both a bracket of matchups AND an editable rules-of-play section.
- **Format:** single-elimination only (no round-robin, no pools). YAGNI for v1.
- **Admin workflow:** auto-seed + tap-to-advance. Admin picks which confirmed teams go
  in each bracket (so the admin controls age-bracket grouping by hand), generates the
  tree, can reorder seeds before locking, then records results during the event.
- **Rules storage:** admin-editable in the browser (DB-backed), not the config file.
- **Match results:** winner **and** final score (e.g. 21–18); winner inferred from scores.

## Non-goals (explicit YAGNI cuts)

- No round-robin, no pools/group stage, no double-elimination.
- No third-place (consolation) match — single champion per bracket.
- No drag-and-drop seeding — up/down reordering only.
- No live score clock, no per-quarter scoring — one final score per match.
- No public bracket editing or comments.

## Architecture

The feature mirrors the existing app's security and content conventions:

- **All bracket + settings data is RLS deny-all to the anon key** (exactly like `teams`
  and `players`). Every read and write goes through the **service-role client** in
  Server Actions and server components (`src/lib/supabase/admin.ts`). There is **no new
  public RLS surface**. The public `/torneo` page is a server component that calls
  server-only read functions which filter to published brackets and return only
  non-sensitive fields.
- **Captain phone numbers never leave the `teams` table.** Brackets store only a
  **snapshot of `team_name`**, so the public bracket view exposes nothing sensitive and
  survives a team being renamed or deleted mid-tournament.
- **Editable copy lives in `event.config.ts`** (page title, nav label, rules section
  title, feature `enabled` toggle). **Dynamic tournament data lives in the DB.** Rules
  *body text* is the one exception to "content in config" — it is DB-backed because the
  user must edit it from a phone during the event without a redeploy.

### Data model — new migration `supabase/migrations/004_brackets.sql`

New enum:

```sql
create type bracket_status as enum ('draft', 'active', 'completed');
```

**`brackets`** — one curated bracket (e.g. one age group of one format/division):

| column | type | notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `name` | text not null | admin-entered, e.g. "5v5 Femenino Abierta" |
| `tournament_id` | uuid null → tournaments(id) on delete set null | optional; scopes the team picker |
| `status` | bracket_status not null default 'draft' | draft → active → completed |
| `is_published` | boolean not null default false | public visibility, independent of status |
| `champion_team_id` | uuid null → teams(id) on delete set null | set when final is decided |
| `champion_name` | text null | snapshot of the champion's name |
| `sort_order` | int default 0 | ordering on public + admin lists |
| `created_at` | timestamptz default now() | |
| `updated_at` | timestamptz default now() | bumped by trigger |

**`bracket_teams`** — the seeding scratchpad (the curated, ordered participant list):

| column | type | notes |
|---|---|---|
| `bracket_id` | uuid not null → brackets(id) on delete cascade | |
| `team_id` | uuid not null → teams(id) on delete cascade | |
| `team_name` | text not null | snapshot at the time of adding |
| `seed` | int not null | 1-based seed order; reorder updates this |
| | | PK `(bracket_id, team_id)` |

**`bracket_matches`** — the generated knockout tree:

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `bracket_id` | uuid not null → brackets(id) on delete cascade | |
| `round` | int not null | 1 = first round; increases toward the final |
| `position` | int not null | 0-based slot within the round (top → bottom) |
| `team1_id` | uuid null → teams(id) on delete set null | |
| `team2_id` | uuid null → teams(id) on delete set null | |
| `team1_name` | text null | snapshot; null = empty/bye slot |
| `team2_name` | text null | snapshot; null = empty/bye slot |
| `score1` | int null | |
| `score2` | int null | |
| `winner_team_id` | uuid null → teams(id) on delete set null | |
| `winner_name` | text null | snapshot |
| `next_match_id` | uuid null → bracket_matches(id) on delete set null | where the winner flows |
| `next_slot` | int null | 1 or 2 — which side of `next_match` |
| `is_bye` | boolean not null default false | round-1 match with one team only |
| `created_at` | timestamptz default now() | |
| `updated_at` | timestamptz default now() | |

Indexes: `bracket_matches(bracket_id, round, position)`, `bracket_teams(bracket_id)`,
`brackets(is_published)`.

**`settings`** — generic key/value for admin-editable site text:

| column | type | notes |
|---|---|---|
| `key` | text pk | e.g. `rules_body` |
| `value` | text | |
| `updated_at` | timestamptz default now() | |

**Migration `005_brackets_rls.sql`:** enable RLS on all four tables with **no anon
policies** (deny-all), matching `002_rls_policies.sql`. **`006_brackets_triggers.sql`:**
reuse the existing `update_updated_at` trigger shape on `brackets` and `bracket_matches`.

**Seed (`seed.sql` addition):** insert one `settings` row `('rules_body', '<placeholder
Spanish rules>')` so the editor and public page have initial content.

## Components and units

### `src/lib/bracket.ts` — pure generator + advance logic (unit-tested)

No DB, no I/O. The testable heart of the feature.

- **`generateSingleElim(seeds: Seed[]): GeneratedMatch[]`**
  - `Seed = { teamId: string; teamName: string }`, ordered by seed (index 0 = seed 1).
  - Requires `seeds.length >= 2`; throws otherwise (caller surfaces a Spanish error).
  - `size = nextPowerOfTwo(n)`; `byes = size - n`.
  - Distributes seeds to round-1 positions using **standard bracket seeding order** so
    top seeds get the byes and seed 1 cannot meet seed 2 before the final.
  - Builds every round (`log2(size)` rounds), assigns `next_match`/`next_slot` links.
  - Round-1 matches with exactly one team are flagged `is_bye` with that team pre-set as
    the winner; the bye winner is propagated into round 2.
  - Returns a structure the action layer persists verbatim (rounds, positions, names,
    links, byes, pre-advanced byes).
- **`applyResult(match, score1, score2)`** helper: validates non-equal scores (no ties
  in knockout), returns the winning side. Used by the action to set the winner and
  decide what to write into the next match slot.
- Helpers: `nextPowerOfTwo(n)`, `seedOrder(size)` (the recursive 1, size, ... sequence),
  `roundLabel(round, totalRounds)` → Spanish ("Final", "Semifinal", "Cuartos", "Octavos",
  otherwise "Ronda N").

### `src/lib/brackets.ts` — server-only read layer (service-role)

- `getPublishedBrackets()` → published brackets ordered by `sort_order`, each with its
  matches (names + scores only). For the public page.
- `getBracketAdmin(id)` → full bracket incl. `bracket_teams` and matches. For admin.
- `listBracketsAdmin()` → all brackets for the admin list.
- `listConfirmedTeamsForBracket(bracketId)` → confirmed (`status='confirmed'`) teams,
  optionally filtered by the bracket's `tournament_id`, with which are already added.

### `src/lib/settings.ts` — server-only settings read

- `getRulesBody(): Promise<string>` → the `rules_body` value (empty string if unset).

### `src/actions/brackets.ts` — admin Server Actions (each calls `requireAdmin()`)

- `createBracket(name, tournamentId?)`
- `setBracketTeams(bracketId, teamIds[])` — replaces the participant set; assigns seeds
  in the given order; only allowed while `status='draft'`.
- `reorderSeed(bracketId, teamId, direction)` — swaps seed with neighbor (up/down).
- `generateBracket(bracketId)` — reads `bracket_teams`, calls `generateSingleElim`,
  writes matches in a clean slate, sets `status='active'`. Re-running first wipes
  existing matches (guarded: warns if results already exist).
- `resetBracket(bracketId)` — wipes matches, clears champion, `status='draft'`.
- `recordResult(matchId, score1, score2)` — validates, sets winner + scores, writes the
  winner into `next_match`'s `team1`/`team2` (id + name snapshot) per `next_slot`; if no
  `next_match` (final), sets `champion_*` and `status='completed'`.
- `clearResult(matchId)` — undo: clears this match's winner/scores and the downstream
  slot it fed (only if the downstream match has no recorded result yet).
- `setBracketPublished(bracketId, published)`
- `deleteBracket(bracketId)` — cascade removes teams + matches.
- `saveRules(body)` — upsert `settings('rules_body', body)`.

All mutating actions `revalidatePath('/admin/brackets')`, the specific bracket path, and
`revalidatePath('/torneo')`.

### Routes

| Route | Auth | Purpose |
|---|---|---|
| `/torneo` | public | Published brackets (rounds as stacked sections) + rules-of-play. |
| `/admin/brackets` | protected | List brackets; create new; publish/delete. |
| `/admin/brackets/[id]` | protected | Pick teams, reorder seeds, generate, record results. |
| `/admin/reglas` | protected | Edit rules-of-play textarea. |

`/admin` gains a small sub-nav linking Equipos · Brackets · Reglas. The existing
`src/proxy.ts` matcher `["/admin/:path*"]` already protects the new admin sub-routes.

### Public bracket rendering (mobile-first)

Each published bracket renders as **vertically stacked, labeled round sections** (Ronda 1
· Cuartos · Semifinal · Final), each a list of match cards showing both team names and
scores, the winner emphasized. The champion is highlighted in a banner at the top when
`status='completed'`. No SVG connector lines (fragile on phones); rounds-as-sections is
robust and scrollable on a 4–5" screen. Respects `prefers-reduced-motion`. Horizontal
connector polish is a noted future enhancement, not v1.

### Config additions — `src/config/event.config.ts`

```ts
tournament: {
  enabled: true,            // shows /torneo + nav link
  navLabel: "Torneo",
  pageTitle: "El Torneo",
  pageIntro: "Brackets en vivo y reglas del torneo.",
  rulesTitle: "Reglas del torneo",
  bracketsEmptyLabel: "Los brackets se publicarán pronto.",
},
```

## Data flow

1. **Setup:** admin creates a bracket, names it, checks off confirmed teams → rows in
   `bracket_teams` with seeds 1..n.
2. **Seed:** admin nudges seeds up/down (draft only) → `seed` updates.
3. **Generate:** `generateBracket` → `generateSingleElim` → `bracket_matches` rows;
   byes auto-advanced; `status='active'`.
4. **Run:** admin taps a match, enters scores → `recordResult` sets the winner and writes
   it into the next match slot; the final sets the champion + `completed`.
5. **Publish:** admin toggles `is_published`; `/torneo` (revalidated) shows it live.
6. **Rules:** admin edits the textarea → `saveRules` upserts `settings.rules_body`;
   `/torneo` reflects it.

## Error handling

- `generateSingleElim` throws on `< 2` seeds → action returns Spanish error
  ("Necesitas al menos 2 equipos para generar el bracket.").
- `recordResult` rejects equal scores ("No puede haber empate en eliminación sencilla.")
  and rejects results on a match whose teams aren't both set yet.
- `setBracketTeams`/`reorderSeed` reject when `status != 'draft'`
  ("Reinicia el bracket para cambiar los equipos.").
- Re-`generateBracket` on a bracket with recorded results requires `resetBracket` first.
- All admin actions go through `requireAdmin()`; the public read layer never returns
  unpublished brackets or sensitive columns.

## Testing

**Unit (vitest):**
- `bracket.test.ts` — `nextPowerOfTwo`; `generateSingleElim` for n = 2, 3, 4, 5, 6, 8:
  correct round count, correct bye count, byes assigned to top seeds, seed 1 vs seed 2
  separated until the final, `next_match` links valid, bye winners pre-advanced.
- `applyResult` — picks the higher score; throws on a tie.
- `roundLabel` — Final/Semifinal/Cuartos/Octavos/Ronda N.

**Manual E2E (local vs Supabase):**
1. Create a bracket, add 5 confirmed teams → generate → expect 3 rounds, 3 byes, top
   seeds idle in round 1.
2. Record results up the tree → champion set, `status='completed'`.
3. `clearResult` on a leaf undoes and clears the downstream slot.
4. Publish → `/torneo` shows the bracket on a narrow viewport; unpublished brackets
   are absent.
5. Edit rules → `/torneo` reflects the new text; reload persists.
6. Security: bracket tables return forbidden/empty with the anon key (RLS deny
   confirmed); team phones never appear in any bracket payload.

**Gates:** `npm run lint`, `npm run test`, `npm run build` clean before commit.

## Open / future

- Horizontal bracket with SVG connector lines (desktop polish).
- Third-place match, double-elim, round-robin/pools — only if a future event needs them.
- Per-format rules sections if one free-text block proves too coarse.
