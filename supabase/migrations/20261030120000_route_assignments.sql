-- Planificación de Coordinación: qué conductor y qué bus cubren cada ruta cada día de la semana.
-- Se corre una vez en Supabase → SQL Editor (o con `supabase db push`).

create table if not exists public.route_assignments (
  route_id   uuid        not null references public.routes (id)   on delete cascade,
  weekday    smallint    not null check (weekday between 0 and 6),   -- 0 = lunes … 6 = domingo
  driver_id  uuid        not null references public.profiles (id) on delete cascade,
  bus_id     uuid        not null references public.buses (id)    on delete cascade,
  updated_by uuid                 default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (route_id, weekday),
  -- Reglas del planificador, garantizadas por la base: el mismo día nadie se repite.
  constraint route_assignments_driver_once_per_day unique (weekday, driver_id),
  constraint route_assignments_bus_once_per_day    unique (weekday, bus_id)
);

alter table public.route_assignments enable row level security;

-- Todos los usuarios con sesión la leen (el conductor ve su ruta, el estudiante ve quién maneja hoy).
drop policy if exists "asignaciones: lectura" on public.route_assignments;
create policy "asignaciones: lectura" on public.route_assignments
  for select to authenticated using (true);

-- Sólo Coordinación (admin) la modifica.
drop policy if exists "asignaciones: coordinación gestiona" on public.route_assignments;
create policy "asignaciones: coordinación gestiona" on public.route_assignments
  for all to authenticated
  using (public.is_admin_or_service())
  with check (public.is_admin_or_service());

-- Guarda el plan de uno o varios días en una sola transacción (o todo o nada).
-- p_days: [{ "weekday": 0, "items": [{ "route_id": "...", "driver_id": "...", "bus_id": "..." }] }, ...]
create or replace function public.save_route_plan(p_days jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  d  jsonb;
  wd smallint;
begin
  if not public.is_admin_or_service() then
    raise exception 'Sólo Coordinación puede planificar rutas' using errcode = '42501';
  end if;

  for d in select value from jsonb_array_elements(p_days) loop
    wd := (d ->> 'weekday')::smallint;
    delete from public.route_assignments where weekday = wd;
    insert into public.route_assignments (route_id, weekday, driver_id, bus_id)
    select (i ->> 'route_id')::uuid, wd, (i ->> 'driver_id')::uuid, (i ->> 'bus_id')::uuid
    from jsonb_array_elements(coalesce(d -> 'items', '[]'::jsonb)) as i;
  end loop;
end;
$$;

revoke all on function public.save_route_plan(jsonb) from public, anon;
grant execute on function public.save_route_plan(jsonb) to authenticated;
