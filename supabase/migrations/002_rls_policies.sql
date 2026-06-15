-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Registrants are anonymous (no accounts), so we cannot key RLS on auth.uid()
-- like salidas-2026 does. Instead:
--   * tournaments  -> public SELECT (no sensitive data; landing page lists them)
--   * teams/players -> RLS enabled with NO anon policies (deny-all).
--
-- The anon key can neither read nor write teams/players. All writes and all
-- sensitive reads go through Server Actions using the service-role client
-- (src/lib/supabase/admin.ts), which bypasses RLS. This protects captain phone
-- numbers and rosters even if the public anon key leaks.
-- ============================================================

alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;

-- Tournaments: public read only.
create policy "Anyone can view tournaments"
  on public.tournaments for select
  using (true);

-- teams / players: intentionally NO policies for the anon/public role.
-- (RLS enabled + zero policies = deny-all to anon. Service role bypasses RLS.)
