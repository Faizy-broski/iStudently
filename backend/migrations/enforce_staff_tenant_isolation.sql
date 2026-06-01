-- =========================================
-- ENFORCE STRICT TENANT ISOLATION FOR STAFF TABLE
-- Critical Security Fix - Run this in Supabase SQL Editor
-- =========================================

-- Drop existing policies that might be too permissive
DROP POLICY IF EXISTS "Users can view staff from their school" ON staff;
DROP POLICY IF EXISTS "Admins can manage staff" ON staff;

-- Enable RLS on staff table
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Policy 1: Super admins can see all staff (for platform management)
CREATE POLICY "Super admins can view all staff"
  ON staff
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Policy 2: School admins and teachers can only view staff from THEIR school
CREATE POLICY "Users can view staff from their own school only"
  ON staff
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.school_id = staff.school_id
      AND profiles.role IN ('admin', 'teacher')
    )
  );

-- Policy 3: Super admins can manage all staff
CREATE POLICY "Super admins can manage all staff"
  ON staff
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Policy 4: School admins can only manage staff from THEIR school
CREATE POLICY "Admins can manage staff in their own school only"
  ON staff
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.school_id = staff.school_id
      AND profiles.role = 'admin'
    )
  );

-- Ensure grade_levels and sections also enforce school isolation
ALTER TABLE grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

-- Add indexes for performance on security queries
CREATE INDEX IF NOT EXISTS idx_staff_school_isolation ON staff(school_id, id);
CREATE INDEX IF NOT EXISTS idx_profiles_school_role ON profiles(school_id, role);

-- Verify policies are active
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'staff'
ORDER BY policyname;

-- Add constraint to prevent accidental school_id changes
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_immutable_school;
ALTER TABLE staff ADD CONSTRAINT staff_immutable_school 
  CHECK (school_id IS NOT NULL);

COMMENT ON CONSTRAINT staff_immutable_school ON staff IS 
  'Ensures school_id is never null - critical for tenant isolation';
