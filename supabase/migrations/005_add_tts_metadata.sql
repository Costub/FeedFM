alter table public.broadcasts
  add column if not exists tts_provider text null,
  add column if not exists tts_model text null,
  add column if not exists tts_voice_id text null;

create index if not exists broadcasts_tts_provider_idx
on public.broadcasts (tts_provider);

create index if not exists broadcasts_tts_model_idx
on public.broadcasts (tts_model);
