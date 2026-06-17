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
