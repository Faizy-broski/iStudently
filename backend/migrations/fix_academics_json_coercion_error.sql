-- =============================================
-- FIX JSON COERCION ISSUES FOR ACADEMICS UPDATES
-- This migration ensures proper RLS policies for academics updates
-- =============================================

-- Make sure service role can bypass RLS for functions
ALTER DEFAULT PRIVILEGES FOR ROLE service_role GRANT ALL ON FUNCTIONS TO service_role;

-- Drop all existing policies first
DROP POLICY IF EXISTS grade_levels_select_policy ON grade_levels;
DROP POLICY IF EXISTS grade_levels_insert_policy ON grade_levels;
DROP POLICY IF EXISTS grade_levels_update_policy ON grade_levels;
DROP POLICY IF EXISTS grade_levels_delete_policy ON grade_levels;
DROP POLICY IF EXISTS sections_select_policy ON sections;
DROP POLICY IF EXISTS sections_insert_policy ON sections;
DROP POLICY IF EXISTS sections_update_policy ON sections;
DROP POLICY IF EXISTS sections_delete_policy ON sections;
DROP POLICY IF EXISTS subjects_select_policy ON subjects;
DROP POLICY IF EXISTS subjects_insert_policy ON subjects;
DROP POLICY IF EXISTS subjects_update_policy ON subjects;
DROP POLICY IF EXISTS subjects_delete_policy ON subjects;

-- Ensure RLS is enabled
ALTER TABLE grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- =============================================
-- GRADE LEVELS POLICIES (MORE PERMISSIVE)
-- =============================================

-- Allow authenticated users to select grade levels
CREATE POLICY "grade_levels_select_policy" ON grade_levels
FOR SELECT TO authenticated
USING (
    -- Always allow super_admin
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    OR
    -- Allow if user has admin role and belongs to related campus/school
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher', 'staff')
        AND
        (
            campus_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
            OR
            school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
            OR
            campus_id IN (SELECT id FROM schools WHERE parent_school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()))
            OR
            school_id IN (SELECT id FROM schools WHERE parent_school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()))
        )
    )
);

-- Allow authenticated admins to insert grade levels
CREATE POLICY "grade_levels_insert_policy" ON grade_levels
FOR INSERT TO authenticated
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
);

-- Allow authenticated admins to update grade levels (MORE PERMISSIVE)
CREATE POLICY "grade_levels_update_policy" ON grade_levels
FOR UPDATE TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
)
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
);

-- Allow authenticated admins to delete grade levels
CREATE POLICY "grade_levels_delete_policy" ON grade_levels
FOR DELETE TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
);

-- =============================================
-- SECTIONS POLICIES (SIMPLIFIED)
-- =============================================

-- =============================================
-- SECTIONS POLICIES (MORE PERMISSIVE)
-- =============================================

-- Allow authenticated users to select sections
CREATE POLICY "sections_select_policy" ON sections
FOR SELECT TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher', 'staff')
);

-- Allow authenticated admins to insert sections
CREATE POLICY "sections_insert_policy" ON sections
FOR INSERT TO authenticated
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
);

-- Allow authenticated admins to update sections (MORE PERMISSIVE)
CREATE POLICY "sections_update_policy" ON sections
FOR UPDATE TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
)
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
);

-- Allow authenticated admins to delete sections
CREATE POLICY "sections_delete_policy" ON sections
FOR DELETE TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
);

-- =============================================
-- SUBJECTS POLICIES (SIMPLIFIED)
-- =============================================

-- =============================================
-- SUBJECTS POLICIES (MORE PERMISSIVE)
-- =============================================

-- Allow authenticated users to select subjects
CREATE POLICY "subjects_select_policy" ON subjects
FOR SELECT TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher', 'staff')
);

-- Allow authenticated admins to insert subjects
CREATE POLICY "subjects_insert_policy" ON subjects
FOR INSERT TO authenticated
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
);

-- Allow authenticated admins to update subjects (MORE PERMISSIVE)
CREATE POLICY "subjects_update_policy" ON subjects
FOR UPDATE TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
)
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
);

-- Allow authenticated admins to delete subjects
CREATE POLICY "subjects_delete_policy" ON subjects
FOR DELETE TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
);

-- =============================================
-- GRANT NECESSARY PERMISSIONS
-- =============================================

-- Ensure service_role has full access to bypass RLS when needed
GRANT ALL ON grade_levels TO service_role;
GRANT ALL ON sections TO service_role;
GRANT ALL ON subjects TO service_role;

-- Ensure authenticated users can access the tables
GRANT SELECT, INSERT, UPDATE, DELETE ON grade_levels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON subjects TO authenticated;

-- Also grant usage on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

DO $$ BEGIN
    RAISE NOTICE '✅ Academics JSON coercion fix migration completed successfully';
    RAISE NOTICE '   - Applied optimized permissive RLS policies for all academics tables';
    RAISE NOTICE '   - Removed campus restrictions from UPDATE policies for admins';
    RAISE NOTICE '   - Granted necessary permissions to service_role and authenticated users';
END $$;