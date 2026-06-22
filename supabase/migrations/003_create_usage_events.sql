create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  source_type text null,
  source_mode text null,
  source_name text null,
  broadcast_id uuid null,
  broadcast_slug text null,
  status text null,
  error_code text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint usage_events_event_name_check check (
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
      'maintenance_banner_seen'
    )
  ),
  constraint usage_events_source_type_check check (
    source_type is null or source_type in ('reddit', 'x')
  ),
  constraint usage_events_source_mode_check check (
    source_mode is null or source_mode in ('subreddit', 'x_username', 'x_keyword')
  )
);

create index if not exists usage_events_created_at_idx on public.usage_events (created_at desc);
create index if not exists usage_events_event_name_idx on public.usage_events (event_name);
create index if not exists usage_events_source_type_idx on public.usage_events (source_type);
create index if not exists usage_events_broadcast_slug_idx on public.usage_events (broadcast_slug);

alter table public.usage_events enable row level security;

revoke all on table public.usage_events from anon;
revoke all on table public.usage_events from authenticated;
