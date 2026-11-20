-- Versión 2.5: datos nuevos en los ajustes y listas de compras compartidas en tiempo real.
-- Es exactamente lo aplicado en el proyecto (migración "extras_and_shared_lists"), escrito para poder repetirse.

-- Despensa, precios, historial, sobras y preferencias de cada persona
alter table public.user_settings add column if not exists extra jsonb not null default '{}'::jsonb;

-- Listas compartidas
create table if not exists public.shared_lists (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'Lista compartida',
  data jsonb not null default '{}'::jsonb,   -- { name, items: [...con u], dels: { id: ms } }
  version integer not null default 0,        -- actualización optimista: update ... where version = leída
  updated_at timestamptz not null default now()
);
create table if not exists public.shared_list_members (
  list_id uuid not null references public.shared_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index if not exists shared_list_members_user_idx on public.shared_list_members(user_id);
create index if not exists shared_lists_owner_idx on public.shared_lists(owner);

alter table public.shared_lists enable row level security;
alter table public.shared_list_members enable row level security;

-- ¿La persona actual es miembro? (security definer para evitar recursión de RLS en las políticas)
create or replace function public.is_list_member(p_list uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shared_list_members m where m.list_id = p_list and m.user_id = (select auth.uid()));
$$;
revoke all on function public.is_list_member(uuid) from public, anon;
grant execute on function public.is_list_member(uuid) to authenticated;

drop policy if exists "miembros leen" on public.shared_lists;
create policy "miembros leen" on public.shared_lists for select to authenticated using ((select public.is_list_member(id)) or owner = (select auth.uid()));
drop policy if exists "dueño crea" on public.shared_lists;
create policy "dueño crea" on public.shared_lists for insert to authenticated with check (owner = (select auth.uid()));
drop policy if exists "miembros editan" on public.shared_lists;
create policy "miembros editan" on public.shared_lists for update to authenticated using ((select public.is_list_member(id))) with check ((select public.is_list_member(id)));
drop policy if exists "dueño borra" on public.shared_lists;
create policy "dueño borra" on public.shared_lists for delete to authenticated using (owner = (select auth.uid()));

-- Los miembros solo se añaden por el trigger del dueño o por join_shared_list; cada quien puede salir.
drop policy if exists "ver miembros" on public.shared_list_members;
create policy "ver miembros" on public.shared_list_members for select to authenticated using ((select public.is_list_member(list_id)));
drop policy if exists "salir" on public.shared_list_members;
create policy "salir" on public.shared_list_members for delete to authenticated using (user_id = (select auth.uid()));

-- El dueño queda como miembro al crear la lista
create or replace function public.shared_list_add_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.shared_list_members(list_id, user_id) values (new.id, new.owner) on conflict do nothing;
  return new;
end $$;
revoke all on function public.shared_list_add_owner() from public, anon, authenticated;
drop trigger if exists shared_lists_owner on public.shared_lists;
create trigger shared_lists_owner after insert on public.shared_lists for each row execute function public.shared_list_add_owner();

-- updated_at lo pone el servidor (public.touch_updated_at ya existe desde la primera migración)
drop trigger if exists shared_lists_touch on public.shared_lists;
create trigger shared_lists_touch before update on public.shared_lists for each row execute function public.touch_updated_at();

-- Unirse con el código: la única forma de entrar a una lista ajena
create or replace function public.join_shared_list(p_code text)
returns public.shared_lists language plpgsql security definer set search_path = '' as $$
declare l public.shared_lists;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  select * into l from public.shared_lists where code = upper(trim(p_code));
  if not found then raise exception 'code_not_found'; end if;
  insert into public.shared_list_members(list_id, user_id) values (l.id, (select auth.uid())) on conflict do nothing;
  return l;
end $$;
revoke all on function public.join_shared_list(text) from public, anon;
grant execute on function public.join_shared_list(text) to authenticated;

grant select, insert, update, delete on public.shared_lists to authenticated;
grant select, delete on public.shared_list_members to authenticated;

-- Tiempo real (cambios de shared_lists, filtrados por RLS)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shared_lists') then
    alter publication supabase_realtime add table public.shared_lists;
  end if;
end $$;
