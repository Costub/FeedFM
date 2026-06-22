alter table public.broadcasts
  add column if not exists audio_size_bytes bigint null,
  add column if not exists audio_deleted_at timestamptz null,
  add column if not exists audio_delete_reason text null,
  add column if not exists storage_status text not null default 'active';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'broadcasts_storage_status_check'
      and conrelid = 'public.broadcasts'::regclass
  ) then
    alter table public.broadcasts
      add constraint broadcasts_storage_status_check
      check (storage_status in ('active', 'audio_deleted', 'save_failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'broadcasts_audio_size_bytes_check'
      and conrelid = 'public.broadcasts'::regclass
  ) then
    alter table public.broadcasts
      add constraint broadcasts_audio_size_bytes_check
      check (audio_size_bytes is null or audio_size_bytes >= 0);
  end if;
end $$;

create index if not exists broadcasts_created_at_idx on public.broadcasts (created_at desc);
create index if not exists broadcasts_storage_status_idx on public.broadcasts (storage_status);
create index if not exists broadcasts_active_audio_created_at_idx
on public.broadcasts (created_at asc)
where storage_status = 'active' and audio_storage_path is not null;
