-- Auto-update teams.updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_team_update
  before update on public.teams
  for each row execute function public.update_updated_at();

-- Stamp paid_at whenever paid flips to true; clear it when unset.
create or replace function public.stamp_paid_at()
returns trigger as $$
begin
  if new.paid = true and (old.paid is distinct from true) then
    new.paid_at = now();
  elsif new.paid = false then
    new.paid_at = null;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger on_team_paid
  before update on public.teams
  for each row execute function public.stamp_paid_at();
