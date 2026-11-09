-- Modulul 1 VEMI: profiluri și roluri pentru utilizatorii Supabase Auth.
-- Rulați această migrare în Supabase SQL Editor înaintea testelor end-to-end.

create type public.app_role as enum ('user', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format check (username ~ '^[a-z0-9._-]{3,30}$')
);

create unique index profiles_username_lower_unique
  on public.profiles (lower(username));

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = check_user_id
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy "roles_select_own_or_admin"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

revoke all on table public.profiles from anon;
revoke all on table public.user_roles from anon;
revoke insert, update, delete on table public.profiles from authenticated;
revoke insert, update, delete on table public.user_roles from authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.user_roles to authenticated;

create or replace function public.handle_new_vemi_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_username text;
begin
  normalized_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));

  if normalized_username !~ '^[a-z0-9._-]{3,30}$' then
    raise exception 'invalid profile data';
  end if;

  insert into public.profiles (id, username)
  values (new.id, normalized_username);

  insert into public.user_roles (user_id, role)
  values (new.id, 'user');

  return new;
end;
$$;

revoke all on function public.handle_new_vemi_user() from public;

create trigger on_auth_user_created_create_vemi_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_vemi_user();

comment on table public.profiles is 'Profilul public minim al utilizatorului VEMI. E-mailul rămâne în auth.users.';
comment on table public.user_roles is 'Roluri separate; utilizatorii nu își pot modifica propriul rol.';
