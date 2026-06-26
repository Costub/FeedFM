alter table public.broadcasts
  alter column slug drop not null,
  add column if not exists user_id uuid null references auth.users(id) on delete cascade,
  add column if not exists visibility text not null default 'unlisted',
  add column if not exists audio_bucket text not null default 'feedfm-broadcast-audio';

alter table public.broadcasts
  drop constraint if exists broadcasts_source_type_check,
  drop constraint if exists broadcasts_source_mode_check,
  drop constraint if exists broadcasts_visibility_check;

alter table public.broadcasts
  add constraint broadcasts_source_type_check
    check (source_type in ('reddit', 'x', 'x_home')),
  add constraint broadcasts_source_mode_check
    check (
      source_mode is null
      or source_mode in ('subreddit', 'x_username', 'x_keyword', 'x_home')
    ),
  add constraint broadcasts_visibility_check
    check (visibility in ('public', 'private', 'unlisted'));

create index if not exists broadcasts_user_id_idx
on public.broadcasts (user_id);

create index if not exists broadcasts_visibility_slug_idx
on public.broadcasts (visibility, slug)
where slug is not null;

drop policy if exists "Public can read shared broadcasts" on public.broadcasts;
create policy "Public can read shared broadcasts"
on public.broadcasts
for select
to anon, authenticated
using (
  slug is not null
  and visibility in ('public', 'unlisted')
);

insert into storage.buckets (id, name, public)
values ('feedfm-private-broadcast-audio', 'feedfm-private-broadcast-audio', false)
on conflict (id) do update set public = false;

alter table public.usage_events
  drop constraint if exists usage_events_event_name_check,
  drop constraint if exists usage_events_source_type_check,
  drop constraint if exists usage_events_source_mode_check;

alter table public.usage_events
  add constraint usage_events_event_name_check check (
    event_name in (
      'app_loaded',
      'generate_started',
      'generate_succeeded',
      'generate_failed',
      'feed_fetch_started',
      'feed_fetch_succeeded',
      'feed_fetch_failed',
      'script_generation_succeeded',
      'script_generation_failed',
      'audio_generation_succeeded',
      'audio_generation_failed',
      'broadcast_saved',
      'broadcast_save_failed',
      'share_page_viewed',
      'copy_link_clicked',
      'native_share_clicked',
      'share_on_x_clicked',
      'source_link_clicked',
      'maintenance_banner_seen',
      'x_home_generation_started',
      'x_home_generation_succeeded',
      'x_home_generation_failed'
    )
  ),
  add constraint usage_events_source_type_check check (
    source_type is null or source_type in ('reddit', 'x', 'x_home')
  ),
  add constraint usage_events_source_mode_check check (
    source_mode is null
    or source_mode in ('subreddit', 'x_username', 'x_keyword', 'x_home')
  );

create table if not exists public.x_home_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  generation_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date),
  constraint x_home_daily_usage_count_check
    check (generation_count >= 0 and generation_count <= 2)
);

alter table public.x_home_daily_usage enable row level security;
revoke all on table public.x_home_daily_usage from anon;
revoke all on table public.x_home_daily_usage from authenticated;

create or replace function public.reserve_x_home_generation(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  reserved_count integer;
  today_utc date := (timezone('utc', now()))::date;
begin
  insert into public.x_home_daily_usage (
    user_id,
    usage_date,
    generation_count,
    updated_at
  )
  values (target_user_id, today_utc, 1, now())
  on conflict (user_id, usage_date)
  do update
    set generation_count = public.x_home_daily_usage.generation_count + 1,
        updated_at = now()
    where public.x_home_daily_usage.generation_count < 2
  returning generation_count into reserved_count;

  return reserved_count is not null;
end;
$$;

revoke all on function public.reserve_x_home_generation(uuid) from public;
revoke all on function public.reserve_x_home_generation(uuid) from anon;
revoke all on function public.reserve_x_home_generation(uuid) from authenticated;
grant execute on function public.reserve_x_home_generation(uuid) to service_role;

create or replace function public.release_x_home_generation(target_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.x_home_daily_usage
  set generation_count = greatest(generation_count - 1, 0),
      updated_at = now()
  where user_id = target_user_id
    and usage_date = (timezone('utc', now()))::date;
$$;

revoke all on function public.release_x_home_generation(uuid) from public;
revoke all on function public.release_x_home_generation(uuid) from anon;
revoke all on function public.release_x_home_generation(uuid) from authenticated;
grant execute on function public.release_x_home_generation(uuid) to service_role;
