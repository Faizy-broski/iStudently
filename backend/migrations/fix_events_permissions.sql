-- =====================================================
-- Fix School Events Table Permissions
-- =====================================================
-- This grants the necessary permissions and recreates policies
-- =====================================================

-- Grant permissions to authenticated users
GRANT ALL ON school_events TO authenticated;
GRANT ALL ON school_events TO service_role;

-- Grant usage on the sequence (for UUID generation)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Ensure RLS is enabled
ALTER TABLE school_events ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies first
DROP POLICY IF EXISTS "Admin can manage school events" ON school_events;
DROP POLICY IF EXISTS "Teachers can view their school events" ON school_events;
DROP POLICY IF EXISTS "Students can view their events" ON school_events;
DROP POLICY IF EXISTS "Parents can view their children's events" ON school_events;

-- Recreate policies with proper permissions
CREATE POLICY "Admin can manage school events" 
  ON school_events
  FOR ALL
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Teachers can view their school events" 
  ON school_events
  FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM profiles 
      WHERE id = auth.uid() AND role = 'teacher'
    )
    AND 'teacher' = ANY(visible_to_roles)
  );

CREATE POLICY "Students can view their events" 
  ON school_events
  FOR SELECT
  TO authenticated
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

CREATE POLICY "Parents can view their children's events" 
  ON school_events
  FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM parents 
      WHERE profile_id = auth.uid()
    )
    AND 'parent' = ANY(visible_to_roles)
  );
