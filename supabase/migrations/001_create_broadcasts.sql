create extension if not exists pgcrypto;

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  summary text not null,
  script text not null,
  main_themes jsonb not null default '[]'::jsonb,
  source_map jsonb not null default '[]'::jsonb,
  quality_notes jsonb not null default '{}'::jsonb,
  source_type text not null,
  source_mode text null,
  source_name text not null,
  tone text not null,
  voice_style text not null,
  broadcast_length text not null,
  audio_url text null,
  audio_storage_path text null,
  audio_size_bytes bigint null,
  audio_deleted_at timestamptz null,
  audio_delete_reason text null,
  storage_status text not null default 'active',
  source_items jsonb not null default '[]'::jsonb,
  share_text text null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  view_count integer not null default 0,
  constraint broadcasts_source_type_check check (source_type in ('reddit', 'x')),
  constraint broadcasts_source_mode_check check (
    source_mode is null
    or source_mode in ('subreddit', 'x_username', 'x_keyword')
  ),
  constraint broadcasts_storage_status_check check (
    storage_status in ('active', 'audio_deleted', 'save_failed')
  ),
  constraint broadcasts_audio_size_bytes_check check (
    audio_size_bytes is null or audio_size_bytes >= 0
  ),
  constraint broadcasts_view_count_check check (view_count >= 0)
);

create index if not exists broadcasts_slug_idx on public.broadcasts (slug);
create index if not exists broadcasts_created_at_idx on public.broadcasts (created_at desc);
create index if not exists broadcasts_source_idx on public.broadcasts (source_type, source_name);
create index if not exists broadcasts_storage_status_idx on public.broadcasts (storage_status);
create index if not exists broadcasts_active_audio_created_at_idx
on public.broadcasts (created_at asc)
where storage_status = 'active' and audio_storage_path is not null;

alter table public.broadcasts enable row level security;

drop policy if exists "Public can read shared broadcasts" on public.broadcasts;
create policy "Public can read shared broadcasts"
on public.broadcasts
for select
to anon
using (slug is not null);

insert into storage.buckets (id, name, public)
values ('feedfm-broadcast-audio', 'feedfm-broadcast-audio', true)
on conflict (id) do update set public = excluded.public;
