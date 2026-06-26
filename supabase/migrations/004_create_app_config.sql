create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  constraint app_config_app_status_severity_check check (
    key <> 'app_status'
    or coalesce(value->>'severity', 'info') in ('info', 'warning', 'error')
  )
);

insert into public.app_config (key, value)
values (
  'app_status',
  '{
    "maintenanceEnabled": false,
    "disableGeneration": false,
    "disableReddit": false,
    "disableX": false,
    "disableXHome": false,
    "disableAuth": false,
    "disableSharing": false,
    "messageTitle": "",
    "messageBody": "",
    "severity": "info",
    "showBanner": false
  }'::jsonb
)
on conflict (key) do nothing;

alter table public.app_config enable row level security;

revoke all on table public.app_config from anon;
revoke all on table public.app_config from authenticated;
