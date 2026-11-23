-- ============================================================================
-- VLaby concurrent-device limit
-- The super admin sets, per school, how many devices one user may open VLaby on.
-- Run once in the Supabase SQL editor. Safe to run again.
-- ============================================================================

-- Per-school limit (null = unlimited). Set by the super admin only.
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS vlaby_device_limit integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'school_settings_vlaby_device_limit_check'
      AND conrelid = 'public.school_settings'::regclass
  ) THEN
    ALTER TABLE school_settings
      ADD CONSTRAINT school_settings_vlaby_device_limit_check
      CHECK (vlaby_device_limit IS NULL OR (vlaby_device_limit BETWEEN 1 AND 20));
  END IF;
END $$;

COMMENT ON COLUMN school_settings.vlaby_device_limit IS
  'Max devices one user may use for VLaby virtual labs (1-20). NULL = unlimited. Set by the super admin.';

-- Devices a user has opened VLaby on (one row per user + device).
CREATE TABLE IF NOT EXISTS vlaby_devices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id     text NOT NULL,
  platform      text,
  label         text,
  user_agent    text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_vlaby_devices_school ON vlaby_devices (school_id);

-- Service role only: the API is the single way in (no policies = no client access).
ALTER TABLE vlaby_devices ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE vlaby_devices IS 'Devices registered per user for the VLaby device limit.';
