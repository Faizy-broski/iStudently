-- Add prefill_data JSONB column to signup_links so admins can pre-specify
-- field values (e.g. grade_level for students) when generating invite links.
ALTER TABLE signup_links
  ADD COLUMN IF NOT EXISTS prefill_data JSONB NOT NULL DEFAULT '{}';
