-- ============================================================
-- ENUMS
-- ============================================================
create type registration_status as enum ('pending', 'confirmed', 'cancelled');
create type division_type as enum ('female', 'male');

-- ============================================================
-- TOURNAMENTS / CATEGORIES
-- One row per format x division. Mirrors src/config/event.config.ts,
-- and is the FK anchor for teams. Non-sensitive -> publicly readable.
-- ============================================================
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                 -- e.g. '1v1-female'
  name text not null,                        -- e.g. 'Torneo 1 vs 1 - Femenino'
  format text not null,                      -- '1v1' | '2v2' | '5v5'
  roster_min int not null default 1,
  roster_max int not null default 1,
  division division_type not null,
  age_bracket text,                          -- e.g. 'Sub-12', 'Abierta'
  sort_order int default 0,
  is_open boolean default true,              -- toggle registration per category
  created_at timestamptz default now()
);

-- ============================================================
-- TEAMS (one registration = one team in one tournament category)
-- ============================================================
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete restrict,
  team_name text not null,
  division division_type not null,
  age_bracket text,
  captain_name text not null,
  captain_phone text not null,
  captain_email text,
  notes text,
  status registration_status not null default 'pending',
  paid boolean not null default false,       -- marked at the door by admin
  paid_at timestamptz,
  -- short human-friendly code the registrant uses to look up status
  lookup_code text unique not null default upper(substr(md5(random()::text), 1, 6)),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- PLAYERS (roster)
-- ============================================================
create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  jersey_number int,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_teams_tournament on public.teams(tournament_id);
create index idx_teams_status on public.teams(status);
create index idx_teams_lookup on public.teams(lookup_code);
create index idx_players_team on public.players(team_id);
