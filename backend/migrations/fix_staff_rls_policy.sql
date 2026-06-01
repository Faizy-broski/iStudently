-- Migration: Allow staff to read their own record
-- This is needed for the teacher dashboard to load staff_id

-- Enable RLS on staff table
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "staff_read_own" ON staff;
DROP POLICY IF EXISTS "staff_select_policy" ON staff;
DROP POLICY IF EXISTS "Users can view staff in their school" ON staff;

-- Create a permissive policy for reading staff records
CREATE POLICY "staff_read_own" ON staff
FOR SELECT USING (
    -- Staff can read their own record
    profile_id = auth.uid()
    OR
    -- Any authenticated user from the same school can read staff
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND (p.school_id = staff.school_id OR p.role = 'super_admin')
    )
);

-- Grant select permission to authenticated users
GRANT SELECT ON staff TO authenticated;
