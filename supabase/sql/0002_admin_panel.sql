-- =====================================================================
-- StudCards · Panel de administración + límites de IA
-- Ejecuta este SQL TÚ MISMO en el editor SQL de tu Supabase.
-- No modifica ninguna tabla ni dato existente: sólo agrega objetos nuevos.
-- Sustituye 'TU_CORREO@EJEMPLO.COM' por el mismo correo que guardaste
-- en el secreto admin_email.
-- =====================================================================

-- ---------- 1. Administradores ----------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

grant select on public.app_admins to authenticated;
grant all on public.app_admins to service_role;

alter table public.app_admins enable row level security;

drop policy if exists "admins read self" on public.app_admins;
create policy "admins read self" on public.app_admins
  for select to authenticated using (user_id = auth.uid());

-- Da acceso de administrador a tu cuenta (idempotente).
insert into public.app_admins (user_id)
select id from auth.users where lower(email) = lower('TU_CORREO@EJEMPLO.COM')
on conflict (user_id) do nothing;

create or replace function public.is_admin(_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins a where a.user_id = _user_id);
$$;

grant execute on function public.is_admin(uuid) to authenticated;

-- ---------- 2. Límites de IA por usuario ----------
create table if not exists public.ai_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ai_enabled boolean not null default true,
  daily_limit integer,               -- null = sin límite
  updated_at timestamptz not null default now()
);

grant select on public.ai_limits to authenticated;
grant all on public.ai_limits to service_role;

alter table public.ai_limits enable row level security;

drop policy if exists "users read own ai limits" on public.ai_limits;
create policy "users read own ai limits" on public.ai_limits
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------- 3. Registro de uso de IA ----------
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cards_generated integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);

grant select on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;

alter table public.ai_usage enable row level security;

drop policy if exists "users read own ai usage" on public.ai_usage;
create policy "users read own ai usage" on public.ai_usage
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ---------- 4. Consumo de cupo de IA (usado por la app antes de llamar a la IA) ----------
create or replace function public.consume_ai_quota(_cards integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _enabled boolean;
  _limit integer;
  _used integer;
begin
  if _uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'Sesión no válida');
  end if;

  select ai_enabled, daily_limit into _enabled, _limit
  from public.ai_limits where user_id = _uid;

  if _enabled is null then
    _enabled := true;   -- sin registro = permitido, sin límite
  end if;

  if not _enabled then
    return jsonb_build_object('allowed', false,
      'reason', 'Tu acceso a la IA está desactivado por el administrador.');
  end if;

  if _limit is not null then
    select coalesce(sum(cards_generated), 0) into _used
    from public.ai_usage
    where user_id = _uid
      and created_at >= (date_trunc('day', now() at time zone 'America/Bogota')
                         at time zone 'America/Bogota');

    if _used + _cards > _limit then
      return jsonb_build_object('allowed', false,
        'reason', format('Límite diario de IA alcanzado (%s de %s cartas hoy).', _used, _limit));
    end if;
  end if;

  insert into public.ai_usage (user_id, cards_generated) values (_uid, _cards);
  return jsonb_build_object('allowed', true);
end;
$$;

grant execute on function public.consume_ai_quota(integer) to authenticated;

-- ---------- 5. Vista general para el administrador ----------
create or replace function public.admin_user_overview()
returns table (
  user_id uuid,
  email text,
  username text,
  streak_days integer,
  learning_count integer,
  learned_count integer,
  ai_cards_today integer,
  ai_cards_total integer,
  ai_enabled boolean,
  daily_limit integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  return query
  with days as (
    select s.user_id,
           (s.completed_at at time zone 'America/Bogota')::date as d
    from public.study_sessions s
    where s.completed_at is not null
    group by 1, 2
  ),
  streak_calc as (
    select user_id, count(*)::int as streak_days
    from (
      select user_id,
             d,
             (d + ((row_number() over (partition by user_id order by d desc)) || ' days')::interval)::date as grp,
             max(d) over (partition by user_id) as last_d
      from days
    ) x
    where x.last_d >= ((now() at time zone 'America/Bogota')::date - 1)
      and x.grp = (x.last_d + interval '1 day')::date
    group by user_id
  ),

  cards as (
    select f.user_id,
           count(*) filter (where f.is_learned)::int as learned_count,
           count(*) filter (
             where not f.is_learned
               and exists (select 1 from public.card_review_history h where h.flashcard_id = f.id)
           )::int as learning_count
    from public.flashcards f
    group by f.user_id
  ),
  usage as (
    select u.user_id,
           coalesce(sum(u.cards_generated), 0)::int as total,
           coalesce(sum(u.cards_generated) filter (
             where u.created_at >= (date_trunc('day', now() at time zone 'America/Bogota')
                                    at time zone 'America/Bogota')
           ), 0)::int as today
    from public.ai_usage u
    group by u.user_id
  )
  select au.id,
         au.email::text,
         p.username,
         coalesce(sc.streak_days, 0),
         coalesce(c.learning_count, 0),
         coalesce(c.learned_count, 0),
         coalesce(us.today, 0),
         coalesce(us.total, 0),
         coalesce(l.ai_enabled, true),
         l.daily_limit
  from auth.users au
  left join public.profiles p on p.user_id = au.id
  left join streak_calc sc on sc.user_id = au.id
  left join cards c on c.user_id = au.id
  left join usage us on us.user_id = au.id
  left join public.ai_limits l on l.user_id = au.id
  order by au.created_at;
end;
$$;

grant execute on function public.admin_user_overview() to authenticated;

-- ---------- 6. Cambiar límites (sólo administrador) ----------
create or replace function public.admin_set_ai_limit(
  _user_id uuid,
  _ai_enabled boolean,
  _daily_limit integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  insert into public.ai_limits (user_id, ai_enabled, daily_limit, updated_at)
  values (_user_id, _ai_enabled, _daily_limit, now())
  on conflict (user_id) do update
    set ai_enabled = excluded.ai_enabled,
        daily_limit = excluded.daily_limit,
        updated_at = now();
end;
$$;

grant execute on function public.admin_set_ai_limit(uuid, boolean, integer) to authenticated;
