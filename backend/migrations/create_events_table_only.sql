-- =====================================================
-- School Events Table Creation (Safe Version)
-- =====================================================
-- Run this if the table was dropped but not created
-- =====================================================

-- First, ensure the enum type exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_category') THEN
        CREATE TYPE event_category AS ENUM (
          'academic',
          'holiday',
          'exam',
          'meeting',
          'activity',
          'reminder'
        );
    END IF;
END $$;

-- Create the table
CREATE TABLE IF NOT EXISTS school_events (
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
  visible_to_roles user_role[] DEFAULT '{student, parent, teacher, admin}'::user_role[],
  
  -- Optional: Target specific Grade Levels
  target_grades TEXT[], 

  -- Color Coding for UI
  color_code TEXT DEFAULT '#3b82f6',

  -- Notification Settings
  send_reminder BOOLEAN DEFAULT false,
  reminder_sent BOOLEAN DEFAULT false,
  
  -- Hijri Calendar Adjustment
  hijri_offset INTEGER DEFAULT 0,
  
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_events_school_dates') THEN
        CREATE INDEX idx_events_school_dates ON school_events (school_id, start_at);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_events_category') THEN
        CREATE INDEX idx_events_category ON school_events (school_id, category);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_events_visibility') THEN
        CREATE INDEX idx_events_visibility ON school_events USING GIN (visible_to_roles);
    END IF;
END $$;

-- Enable RLS
ALTER TABLE school_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Admin can manage school events" ON school_events;
CREATE POLICY "Admin can manage school events" 
  ON school_events
  FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Teachers can view their school events" ON school_events;
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

DROP POLICY IF EXISTS "Students can view their events" ON school_events;
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

DROP POLICY IF EXISTS "Parents can view their children's events" ON school_events;
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

-- Create trigger function
CREATE OR REPLACE FUNCTION update_school_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS school_events_updated_at ON school_events;
CREATE TRIGGER school_events_updated_at
  BEFORE UPDATE ON school_events
  FOR EACH ROW
  EXECUTE FUNCTION update_school_events_updated_at();

-- Create helper function
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
