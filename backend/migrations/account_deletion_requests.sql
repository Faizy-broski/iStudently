-- In-app account deletion (App Store 5.1.1(v), Google Play account deletion policy).
-- A user deleting their account from the app creates a request here; their sign-in is turned off
-- at once (profiles.is_active = false, auth user banned) and the school / platform team erases or
-- anonymises the data within the stated period, keeping only what the school must retain by law.
-- Idempotent: safe to run more than once.

create table if not exists public.account_deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  school_id     uuid references public.schools(id) on delete set null,
  role          text not null,
  reason        text,
  status        text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  requested_at  timestamptz not null default now(),
  processed_at  timestamptz,
  processed_by  uuid references public.profiles(id) on delete set null,
  notes         text
);

-- One open request per account.
create unique index if not exists account_deletion_requests_one_pending
  on public.account_deletion_requests (profile_id) where status = 'pending';
create index if not exists account_deletion_requests_school_status
  on public.account_deletion_requests (school_id, status);

-- API only (service role); no direct client access.
alter table public.account_deletion_requests enable row level security;
