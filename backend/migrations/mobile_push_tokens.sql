-- Phone push notifications for the iStudent app (Expo push tokens). Every notification the backend
-- already sends as web push (push-notifications.service.ts sendToProfile/Role/School) also goes to
-- the user's registered phones. Idempotent: safe to run more than once.

create table if not exists public.mobile_push_tokens (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  school_id     uuid references public.schools(id) on delete set null,
  token         text not null unique,          -- ExponentPushToken[...]
  platform      text not null check (platform in ('ios', 'android')),
  device_name   text,
  app_version   text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now()
);

create index if not exists mobile_push_tokens_profile_active on public.mobile_push_tokens (profile_id) where is_active;

-- API only (service role); no direct client access.
alter table public.mobile_push_tokens enable row level security;
