-- Library-related discipline referrals (e.g. a damaged or lost book). Librarians may read and
-- create only these; admins and teachers can mark any referral as library-related.
alter table public.discipline_referrals
  add column if not exists library_related boolean not null default false;

create index if not exists discipline_referrals_library_idx
  on public.discipline_referrals (school_id, incident_date desc)
  where library_related;
