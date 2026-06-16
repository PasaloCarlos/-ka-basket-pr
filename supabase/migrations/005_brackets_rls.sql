-- Deny-all to anon, exactly like teams/players (see 002_rls_policies.sql).
-- RLS enabled + zero policies = no anon read/write. The service-role client
-- in Server Actions bypasses RLS and is the only access path.
alter table public.brackets enable row level security;
alter table public.bracket_teams enable row level security;
alter table public.bracket_matches enable row level security;
alter table public.settings enable row level security;
-- (intentionally NO policies)
