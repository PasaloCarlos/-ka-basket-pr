-- Seed tournament categories. Keep slugs/formats in sync with
-- src/config/event.config.ts. Categories start CLOSED (is_open=false) because
-- the real lineup is still TBD; the admin opens them once confirmed.
--
-- Run this AFTER the migrations, in the Supabase SQL editor.

insert into public.tournaments (slug, name, format, roster_min, roster_max, division, age_bracket, sort_order, is_open)
values
  ('1v1-female', 'Torneo 1 vs 1 - Femenino', '1v1', 1, 1, 'female', 'Abierta', 10, false),
  ('2v2-female', 'Torneo 2 vs 2 - Femenino', '2v2', 2, 3, 'female', 'Abierta', 20, false),
  ('5v5-female', 'Torneo 5 vs 5 - Femenino', '5v5', 5, 8, 'female', 'Abierta', 30, false),
  ('1v1-male',   'Torneo 1 vs 1 - Masculino', '1v1', 1, 1, 'male',   'Abierta', 40, false),
  ('2v2-male',   'Torneo 2 vs 2 - Masculino', '2v2', 2, 3, 'male',   'Abierta', 50, false),
  ('5v5-male',   'Torneo 5 vs 5 - Masculino', '5v5', 5, 8, 'male',   'Abierta', 60, false)
on conflict (slug) do nothing;

-- Initial rules-of-play placeholder (admin edits this from /admin/reglas).
insert into public.settings (key, value)
values ('rules_body', e'Reglas por confirmar.\n\n- 1v1: a 11 puntos (gana por 2)\n- 5v5: 2 periodos de 10 minutos\n- La decisión de los árbitros es final')
on conflict (key) do nothing;
