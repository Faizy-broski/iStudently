-- Restrict school-level reads of billing_records to the school's admins.
--
-- Before: policy "School Admin View Own Records" let ANY profile whose school_id matched read that
-- school's invoices (students, parents, teachers included) despite its name: it had no role check.
-- After: only role 'admin' of that school can read them. Super admins keep full access through
-- "Super Admin Manage Records" (unchanged). Writes were already super-admin only (unchanged).
--
-- Safe to re-run. Written 2026-10-06 for review; run it yourself in the Supabase SQL editor.

begin;

drop policy if exists "School Admin View Own Records" on public.billing_records;

create policy "School Admin View Own Records"
  on public.billing_records
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'::user_role
        and profiles.school_id = billing_records.school_id
    )
  );

commit;

-- Check afterwards:
--   select policyname, cmd, qual from pg_policies where tablename = 'billing_records';
