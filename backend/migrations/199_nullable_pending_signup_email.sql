-- ============================================================
-- Migration 199: Nullable pending_signups.email
-- Run in Supabase SQL Editor
-- ============================================================
-- NOTE: Public self-signup no longer requires an email address.
-- When no email is provided, a synthetic placeholder
-- (firstname.lastname.xxxx@temp.local) is generated at approval
-- time by the backend (see backend/src/utils/email.util.ts) and
-- used only to satisfy Supabase Auth — it is never stored on the
-- pending_signups row itself when the applicant left email blank.
-- This migration simply allows pending_signups.email to be NULL.
-- ============================================================

-- Step 1: Drop NOT NULL constraint on email
ALTER TABLE public.pending_signups ALTER COLUMN email DROP NOT NULL;

-- Step 2: Verify
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pending_signups'
  AND column_name = 'email';
