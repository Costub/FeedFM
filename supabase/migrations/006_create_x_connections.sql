create table if not exists public.x_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  x_user_id text null,
  x_username text null,
  x_display_name text null,
  access_token_encrypted text null,
  refresh_token_encrypted text null,
  expires_at timestamptz null,
  scopes text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists x_connections_user_id_idx
on public.x_connections (user_id);

create index if not exists x_connections_x_user_id_idx
on public.x_connections (x_user_id)
where x_user_id is not null;

create or replace function public.set_x_connections_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_x_connections_updated_at on public.x_connections;
create trigger set_x_connections_updated_at
before update on public.x_connections
for each row execute function public.set_x_connections_updated_at();

alter table public.x_connections enable row level security;

drop policy if exists "Users can read their own X connection metadata"
on public.x_connections;

create policy "Users can read their own X connection metadata"
on public.x_connections
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.x_connections from anon;
revoke all on table public.x_connections from authenticated;

grant select (
  user_id,
  x_user_id,
  x_username,
  x_display_name,
  scopes,
  created_at,
  updated_at
) on table public.x_connections to authenticated;

revoke all on function public.set_x_connections_updated_at() from public;
