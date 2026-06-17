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
-- team_id is ON DELETE CASCADE (not RESTRICT) on purpose: this is pre-generation
-- scratch, and we must not make the existing deleteTeam admin action fail with an
-- FK error. The durable tree (bracket_matches) carries name snapshots + SET NULL,
-- so deleting a team never corrupts a generated bracket.
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
  "position" int not null,            -- 0-based within round ("position" is a SQL keyword)
  team1_id uuid references public.teams(id) on delete set null,
  team2_id uuid references public.teams(id) on delete set null,
  team1_name text,                    -- snapshot; null = empty/bye slot
  team2_name text,
  score1 int,
  score2 int,
  winner_team_id uuid references public.teams(id) on delete set null,
  winner_name text,
  next_match_id uuid references public.bracket_matches(id) on delete set null,
  next_slot int check (next_slot in (1, 2)), -- which side of next_match
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

create index idx_bracket_matches_bracket on public.bracket_matches(bracket_id, round, "position");
create index idx_bracket_teams_bracket on public.bracket_teams(bracket_id);
create index idx_brackets_published on public.brackets(is_published);
