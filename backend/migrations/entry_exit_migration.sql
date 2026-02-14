-- ============================================================================
-- Entry & Exit Module - Database Migration
-- ============================================================================
-- Run this in Supabase SQL Editor
-- ============================================================================
-- 1. Checkpoints table
CREATE TABLE IF NOT EXISTS checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'both' CHECK (mode IN ('entry', 'exit', 'both')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);
CREATE INDEX IF NOT EXISTS idx_checkpoints_school ON checkpoints(school_id);
-- 2. Checkpoint authorized times
CREATE TABLE IF NOT EXISTS checkpoint_authorized_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (
    day_of_week BETWEEN 0 AND 6
  ),
  -- 0=Sun, 6=Sat
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cat_checkpoint ON checkpoint_authorized_times(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_cat_day ON checkpoint_authorized_times(checkpoint_id, day_of_week);
-- 3. Entry/Exit records
CREATE TABLE IF NOT EXISTS entry_exit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  person_id UUID NOT NULL,
  -- references profiles.id
  person_type TEXT NOT NULL CHECK (person_type IN ('STUDENT', 'STAFF')),
  record_type TEXT NOT NULL CHECK (record_type IN ('ENTRY', 'EXIT')),
  status TEXT NOT NULL DEFAULT 'authorized' CHECK (status IN ('authorized', 'late', 'unauthorized')),
  description TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_eer_school ON entry_exit_records(school_id);
CREATE INDEX IF NOT EXISTS idx_eer_checkpoint ON entry_exit_records(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_eer_person ON entry_exit_records(person_id);
CREATE INDEX IF NOT EXISTS idx_eer_recorded ON entry_exit_records(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_eer_school_date ON entry_exit_records(school_id, recorded_at DESC);
-- 4. Evening leaves
CREATE TABLE IF NOT EXISTS evening_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  -- references students.id
  checkpoint_id UUID REFERENCES checkpoints(id) ON DELETE
  SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_of_week INTEGER [] NOT NULL DEFAULT '{}',
    -- e.g. {1,3} for Mon/Wed
    authorized_return_time TIME NOT NULL,
    reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);
CREATE INDEX IF NOT EXISTS idx_el_school ON evening_leaves(school_id);
CREATE INDEX IF NOT EXISTS idx_el_student ON evening_leaves(student_id);
CREATE INDEX IF NOT EXISTS idx_el_active ON evening_leaves(school_id, is_active, start_date, end_date);
-- 5. Package deliveries
CREATE TABLE IF NOT EXISTS package_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  -- references students.id
  description TEXT,
  sender TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'collected')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pd_school ON package_deliveries(school_id);
CREATE INDEX IF NOT EXISTS idx_pd_student ON package_deliveries(student_id);
CREATE INDEX IF NOT EXISTS idx_pd_pending ON package_deliveries(school_id, status)
WHERE status = 'pending';
-- 6. Student checkpoint notes (private notes about students)
CREATE TABLE IF NOT EXISTS student_checkpoint_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  UNIQUE(school_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_scn_student ON student_checkpoint_notes(school_id, student_id);
-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_entry_exit_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DO $$ BEGIN IF NOT EXISTS (
  SELECT 1
  FROM pg_trigger
  WHERE tgname = 'checkpoints_updated_at'
) THEN CREATE TRIGGER checkpoints_updated_at BEFORE
UPDATE ON checkpoints FOR EACH ROW EXECUTE FUNCTION update_entry_exit_updated_at();
END IF;
IF NOT EXISTS (
  SELECT 1
  FROM pg_trigger
  WHERE tgname = 'evening_leaves_updated_at'
) THEN CREATE TRIGGER evening_leaves_updated_at BEFORE
UPDATE ON evening_leaves FOR EACH ROW EXECUTE FUNCTION update_entry_exit_updated_at();
END IF;
IF NOT EXISTS (
  SELECT 1
  FROM pg_trigger
  WHERE tgname = 'student_checkpoint_notes_updated_at'
) THEN CREATE TRIGGER student_checkpoint_notes_updated_at BEFORE
UPDATE ON student_checkpoint_notes FOR EACH ROW EXECUTE FUNCTION update_entry_exit_updated_at();
END IF;
END $$;
-- Enable RLS
ALTER TABLE checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoint_authorized_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_exit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE evening_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_checkpoint_notes ENABLE ROW LEVEL SECURITY;
-- Service role policies (bypass RLS for backend service role)
-- Drop if exists, then create fresh
DO $$
DECLARE tbl TEXT;
policy_name TEXT;
BEGIN FOREACH tbl IN ARRAY ARRAY ['checkpoints','checkpoint_authorized_times','entry_exit_records','evening_leaves','package_deliveries','student_checkpoint_notes'] LOOP policy_name := 'service_role_all_' || tbl;
-- Drop the policy if it already exists (safe re-run)
BEGIN EXECUTE format('DROP POLICY %I ON %I', policy_name, tbl);
EXCEPTION
WHEN undefined_object THEN -- Policy doesn't exist, that's fine
NULL;
END;
-- Create the policy
EXECUTE format(
  'CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
  policy_name,
  tbl
);
END LOOP;
END $$;