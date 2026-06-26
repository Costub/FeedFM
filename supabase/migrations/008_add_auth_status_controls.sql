update public.app_config
set value =
  coalesce(value, '{}'::jsonb)
  || jsonb_build_object(
    'disableXHome',
    coalesce((value ->> 'disableXHome')::boolean, false),
    'disableAuth',
    coalesce((value ->> 'disableAuth')::boolean, false)
  ),
  updated_at = now()
where key = 'app_status';
