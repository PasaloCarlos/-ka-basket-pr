-- Reuse public.update_updated_at() defined in 003_triggers.sql.
create trigger on_bracket_update
  before update on public.brackets
  for each row execute function public.update_updated_at();

create trigger on_bracket_match_update
  before update on public.bracket_matches
  for each row execute function public.update_updated_at();

create trigger on_setting_update
  before update on public.settings
  for each row execute function public.update_updated_at();
