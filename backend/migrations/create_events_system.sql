-- =====================================================
-- School Events System Migration
-- =====================================================
-- Description: Creates event categories and school events table
--              for managing academic calendar, holidays, exams, etc.
-- Author: System
-- Date: 2026-01-13
-- =====================================================

-- 1. Define Event Categories (Drop and recreate if exists)
DROP TYPE IF EXISTS event_category CASCADE;
CREATE TYPE event_category AS ENUM (
  'academic',      -- Start/End of Term, Quarter dates
  'holiday',       -- Public & Religious Holidays (Off days)
  'exam',          -- Midterms, Finals
  'meeting',       -- PTA meetings, Staff meetings
  'activity',      -- Sports day, Field trips
  'reminder'       -- General reminders (e.g. "Fee deadline")
);

-- 2. The Master Events Table (Drop if exists)
DROP TABLE IF EXISTS school_events CASCADE;
CREATE TABLE school_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  
  -- Basic Info
  title TEXT NOT NULL,
  description TEXT,
  category event_category NOT NULL DEFAULT 'activity',
  
  -- Timing (Always store in Standard UTC/Gregorian)
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  
  -- Visibility & Targeting
  -- Which roles can see this? (e.g., Teachers only for "Staff Meeting")
  visible_to_roles user_role[] DEFAULT '{student, parent, teacher, admin}'::user_role[],
  
  -- Optional: Target specific Grade Levels (e.g., "Grade 12 Only" for Finals)
  target_grades TEXT[], 

  -- Color Coding for UI (Optional)
  color_code TEXT DEFAULT '#3b82f6', -- Blue default

  -- Notification Settings
  send_reminder BOOLEAN DEFAULT false,
  reminder_sent BOOLEAN DEFAULT false, -- Internal flag
  
  -- Hijri Calendar Adjustment (global offset in days for moon sighting corrections)
  hijri_offset INTEGER DEFAULT 0,
  
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Index for fast calendar rendering
CREATE INDEX idx_events_school_dates ON school_events (school_id, start_at);
CREATE INDEX idx_events_category ON school_events (school_id, category);
CREATE INDEX idx_events_visibility ON school_events USING GIN (visible_to_roles);

-- 4. RLS Policies for tenant isolation
ALTER TABLE school_events ENABLE ROW LEVEL SECURITY;

-- Admin can do everything for their school
CREATE POLICY "Admin can manage school events" 
  ON school_events
  FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Teachers can view events visible to them
CREATE POLICY "Teachers can view their school events" 
  ON school_events
  FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM profiles 
      WHERE id = auth.uid() AND role = 'teacher'
    )
    AND 'teacher' = ANY(visible_to_roles)
  );

-- Students can view events visible to them (optionally filtered by grade)
CREATE POLICY "Students can view their events" 
  ON school_events
  FOR SELECT
  USING (
    school_id IN (
      SELECT s.school_id FROM students s
      JOIN profiles p ON s.profile_id = p.id
      WHERE p.id = auth.uid()
    )
    AND 'student' = ANY(visible_to_roles)
    AND (
      target_grades IS NULL 
      OR EXISTS (
        SELECT 1 FROM students s
        JOIN profiles p ON s.profile_id = p.id
        WHERE p.id = auth.uid() 
        AND s.grade_level = ANY(target_grades)
      )
    )
  );

-- Parents can view events visible to them
CREATE POLICY "Parents can view their children's events" 
  ON school_events
  FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM parents 
      WHERE profile_id = auth.uid()
    )
    AND 'parent' = ANY(visible_to_roles)
  );

-- 5. Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_school_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER school_events_updated_at
  BEFORE UPDATE ON school_events
  FOR EACH ROW
  EXECUTE FUNCTION update_school_events_updated_at();

-- 6. Function to get events for a date range with Hijri support
CREATE OR REPLACE FUNCTION get_school_events_for_range(
  p_school_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_category event_category DEFAULT NULL,
  p_user_role user_role DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  category event_category,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  is_all_day BOOLEAN,
  color_code TEXT,
  target_grades TEXT[],
  hijri_offset INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.description,
    e.category,
    e.start_at,
    e.end_at,
    e.is_all_day,
    e.color_code,
    e.target_grades,
    e.hijri_offset
  FROM school_events e
  WHERE e.school_id = p_school_id
    AND e.start_at >= p_start_date
    AND e.end_at <= p_end_date
    AND (p_category IS NULL OR e.category = p_category)
    AND (p_user_role IS NULL OR p_user_role = ANY(e.visible_to_roles))
  ORDER BY e.start_at ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Rollback Instructions
-- =====================================================
-- To rollback this migration, run:
-- DROP FUNCTION IF EXISTS get_school_events_for_range(UUID, TIMESTAMPTZ, TIMESTAMPTZ, event_category, user_role);
-- DROP TRIGGER IF EXISTS school_events_updated_at ON school_events;
-- DROP FUNCTION IF EXISTS update_school_events_updated_at();
-- DROP TABLE IF EXISTS school_events;
-- DROP TYPE IF EXISTS event_category;
