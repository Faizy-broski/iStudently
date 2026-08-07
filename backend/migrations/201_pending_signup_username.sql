-- ============================================================
-- Migration 201: pending_signups.username
-- Run in Supabase SQL Editor
-- ============================================================
-- NOTE: Public self-signup forms can now optionally collect a
-- username (per signup-link config, see standard_fields.username
-- in signup_links.meta). When the applicant chooses one, it's
-- carried through to profiles.username on approval instead of the
-- backend auto-generating a random one — see approvePendingSignup
-- in backend/src/services/pending-signups.service.ts.
-- Username uniqueness (like profiles.username) is enforced at the
-- application layer (see isUsernameAlreadyUsed), matching how
-- profiles.username itself has no DB-level global unique index
-- enforced through this table.
-- ============================================================

-- Step 1: Add nullable username column
ALTER TABLE public.pending_signups ADD COLUMN IF NOT EXISTS username TEXT;

-- Step 2: Verify
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pending_signups'
  AND column_name = 'username';
