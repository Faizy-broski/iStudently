-- =========================================
-- FIX CAMPUS-SPECIFIC ACADEMICS RLS POLICIES (COMPLETE)
-- This migration fixes all RLS issues for the campus-specific academic system
-- Run this AFTER make_academics_campus_specific.sql
-- =========================================

-- =============================================
-- STEP 1: DROP ALL EXISTING ACADEMICS POLICIES
-- =============================================

-- Grade Levels - drop all possible policy names
DROP POLICY IF EXISTS grade_levels_campus_policy ON grade_levels;
DROP POLICY IF EXISTS grade_levels_policy ON grade_levels;
DROP POLICY IF EXISTS grade_levels_admin_all ON grade_levels;
DROP POLICY IF EXISTS grade_levels_teacher_read ON grade_levels;
DROP POLICY IF EXISTS grade_levels_select ON grade_levels;
DROP POLICY IF EXISTS grade_levels_insert ON grade_levels;
DROP POLICY IF EXISTS grade_levels_update ON grade_levels;
DROP POLICY IF EXISTS grade_levels_delete ON grade_levels;

-- Sections - drop all possible policy names
DROP POLICY IF EXISTS sections_campus_policy ON sections;
DROP POLICY IF EXISTS sections_policy ON sections;
DROP POLICY IF EXISTS sections_admin_all ON sections;
DROP POLICY IF EXISTS sections_teacher_read ON sections;
DROP POLICY IF EXISTS sections_select ON sections;
DROP POLICY IF EXISTS sections_insert ON sections;
DROP POLICY IF EXISTS sections_update ON sections;
DROP POLICY IF EXISTS sections_delete ON sections;

-- Subjects - drop all possible policy names
DROP POLICY IF EXISTS subjects_campus_policy ON subjects;
DROP POLICY IF EXISTS subjects_policy ON subjects;
DROP POLICY IF EXISTS subjects_admin_all ON subjects;
DROP POLICY IF EXISTS subjects_teacher_read ON subjects;
DROP POLICY IF EXISTS subjects_select ON subjects;
DROP POLICY IF EXISTS subjects_insert ON subjects;
DROP POLICY IF EXISTS subjects_update ON subjects;
DROP POLICY IF EXISTS subjects_delete ON subjects;

-- Teacher Subject Assignments
DROP POLICY IF EXISTS teacher_subject_assignments_policy ON teacher_subject_assignments;
DROP POLICY IF EXISTS teacher_subject_assignments_campus_policy ON teacher_subject_assignments;

-- Timetable Entries
DROP POLICY IF EXISTS timetable_entries_policy ON timetable_entries;
DROP POLICY IF EXISTS timetable_entries_campus_policy ON timetable_entries;

-- Periods
DROP POLICY IF EXISTS periods_policy ON periods;
DROP POLICY IF EXISTS periods_campus_policy ON periods;

-- =============================================
-- STEP 2: CREATE HELPER FUNCTION FOR CAMPUS ACCESS CHECK
-- =============================================

-- Function to check if user can access a campus
CREATE OR REPLACE FUNCTION can_access_campus(p_campus_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_school_id UUID;
    user_role TEXT;
    campus_parent_id UUID;
    user_parent_id UUID;
BEGIN
    -- Handle NULL input
    IF p_campus_id IS NULL THEN
        RETURN TRUE; -- Allow access if no campus filter
    END IF;

    -- Get user's school_id and role
    SELECT school_id, role INTO user_school_id, user_role
    FROM profiles
    WHERE id = auth.uid();
    
    -- If no user found, deny access
    IF user_school_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Super admin can access everything
    IF user_role = 'super_admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Direct match: user's school_id equals the campus_id
    IF user_school_id = p_campus_id THEN
        RETURN TRUE;
    END IF;
    
    -- Get campus's parent school
    SELECT parent_school_id INTO campus_parent_id
    FROM schools
    WHERE id = p_campus_id;
    
    -- Check if user's school is the parent of this campus
    IF campus_parent_id IS NOT NULL AND user_school_id = campus_parent_id THEN
        RETURN TRUE;
    END IF;
    
    -- Get user's school's parent (in case user is at a campus)
    SELECT parent_school_id INTO user_parent_id
    FROM schools
    WHERE id = user_school_id;
    
    -- Check if user is at a sibling campus (same parent)
    IF user_parent_id IS NOT NULL AND campus_parent_id IS NOT NULL AND user_parent_id = campus_parent_id THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user is at a campus and this is the parent school
    IF user_parent_id IS NOT NULL AND user_parent_id = p_campus_id THEN
        RETURN TRUE;
    END IF;
    
    -- Admin users should be able to access their school and all its campuses
    IF user_role = 'admin' THEN
        -- Check if p_campus_id is a campus of user's school
        IF EXISTS (
            SELECT 1 FROM schools 
            WHERE id = p_campus_id AND parent_school_id = user_school_id
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is admin for a campus
CREATE OR REPLACE FUNCTION is_campus_admin(p_campus_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    user_school_id UUID;
    user_role TEXT;
BEGIN
    SELECT school_id, role INTO user_school_id, user_role
    FROM profiles
    WHERE id = auth.uid();
    
    -- Super admin or admin role required
    IF user_role NOT IN ('admin', 'super_admin') THEN
        RETURN FALSE;
    END IF;
    
    -- Super admin can access everything
    IF user_role = 'super_admin' THEN
        RETURN TRUE;
    END IF;
    
    -- If no campus specified, just check role
    IF p_campus_id IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Check campus access
    RETURN can_access_campus(p_campus_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- STEP 3: CREATE NEW CAMPUS-AWARE RLS POLICIES
-- =============================================

-- ==================
-- GRADE LEVELS
-- ==================

-- SELECT: Allow reading if user can access the campus
CREATE POLICY grade_levels_select ON grade_levels
    FOR SELECT
    USING (can_access_campus(campus_id));

-- INSERT: Allow admin/super_admin to insert for their campus
CREATE POLICY grade_levels_insert ON grade_levels
    FOR INSERT
    WITH CHECK (is_campus_admin(campus_id));

-- UPDATE: Allow admin/super_admin to update for their campus  
CREATE POLICY grade_levels_update ON grade_levels
    FOR UPDATE
    USING (is_campus_admin(campus_id))
    WITH CHECK (is_campus_admin(campus_id));

-- DELETE: Allow admin/super_admin to delete for their campus
CREATE POLICY grade_levels_delete ON grade_levels
    FOR DELETE
    USING (is_campus_admin(campus_id));

-- ==================
-- SECTIONS
-- ==================

-- SELECT: Allow reading if user can access the campus
CREATE POLICY sections_select ON sections
    FOR SELECT
    USING (can_access_campus(campus_id));

-- INSERT: Allow admin/super_admin to insert for their campus
CREATE POLICY sections_insert ON sections
    FOR INSERT
    WITH CHECK (is_campus_admin(campus_id));

-- UPDATE: Allow admin/super_admin to update for their campus
CREATE POLICY sections_update ON sections
    FOR UPDATE
    USING (is_campus_admin(campus_id))
    WITH CHECK (is_campus_admin(campus_id));

-- DELETE: Allow admin/super_admin to delete for their campus
CREATE POLICY sections_delete ON sections
    FOR DELETE
    USING (is_campus_admin(campus_id));

-- ==================
-- SUBJECTS
-- ==================

-- SELECT: Allow reading if user can access the campus
CREATE POLICY subjects_select ON subjects
    FOR SELECT
    USING (can_access_campus(campus_id));

-- INSERT: Allow admin/super_admin to insert for their campus
CREATE POLICY subjects_insert ON subjects
    FOR INSERT
    WITH CHECK (is_campus_admin(campus_id));

-- UPDATE: Allow admin/super_admin to update for their campus
CREATE POLICY subjects_update ON subjects
    FOR UPDATE
    USING (is_campus_admin(campus_id))
    WITH CHECK (is_campus_admin(campus_id));

-- DELETE: Allow admin/super_admin to delete for their campus
CREATE POLICY subjects_delete ON subjects
    FOR DELETE
    USING (is_campus_admin(campus_id));

-- ==================
-- TEACHER SUBJECT ASSIGNMENTS (if table exists)
-- ==================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_subject_assignments') THEN
        -- Enable RLS if not already enabled
        ALTER TABLE teacher_subject_assignments ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies first
        DROP POLICY IF EXISTS teacher_subject_assignments_select ON teacher_subject_assignments;
        DROP POLICY IF EXISTS teacher_subject_assignments_insert ON teacher_subject_assignments;
        DROP POLICY IF EXISTS teacher_subject_assignments_update ON teacher_subject_assignments;
        DROP POLICY IF EXISTS teacher_subject_assignments_delete ON teacher_subject_assignments;
        
        -- SELECT
        CREATE POLICY teacher_subject_assignments_select ON teacher_subject_assignments
            FOR SELECT
            USING (can_access_campus(campus_id));
        
        -- INSERT
        CREATE POLICY teacher_subject_assignments_insert ON teacher_subject_assignments
            FOR INSERT
            WITH CHECK (is_campus_admin(campus_id));
        
        -- UPDATE
        CREATE POLICY teacher_subject_assignments_update ON teacher_subject_assignments
            FOR UPDATE
            USING (is_campus_admin(campus_id))
            WITH CHECK (is_campus_admin(campus_id));
        
        -- DELETE
        CREATE POLICY teacher_subject_assignments_delete ON teacher_subject_assignments
            FOR DELETE
            USING (is_campus_admin(campus_id));
    END IF;
END $$;

-- ==================
-- TIMETABLE ENTRIES (if table exists)
-- ==================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'timetable_entries') THEN
        -- Enable RLS if not already enabled
        ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies first
        DROP POLICY IF EXISTS timetable_entries_select ON timetable_entries;
        DROP POLICY IF EXISTS timetable_entries_insert ON timetable_entries;
        DROP POLICY IF EXISTS timetable_entries_update ON timetable_entries;
        DROP POLICY IF EXISTS timetable_entries_delete ON timetable_entries;
        
        -- SELECT
        CREATE POLICY timetable_entries_select ON timetable_entries
            FOR SELECT
            USING (can_access_campus(campus_id));
        
        -- INSERT
        CREATE POLICY timetable_entries_insert ON timetable_entries
            FOR INSERT
            WITH CHECK (is_campus_admin(campus_id));
        
        -- UPDATE
        CREATE POLICY timetable_entries_update ON timetable_entries
            FOR UPDATE
            USING (is_campus_admin(campus_id))
            WITH CHECK (is_campus_admin(campus_id));
        
        -- DELETE
        CREATE POLICY timetable_entries_delete ON timetable_entries
            FOR DELETE
            USING (is_campus_admin(campus_id));
    END IF;
END $$;

-- ==================
-- PERIODS (if table exists)
-- ==================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'periods') THEN
        -- Enable RLS if not already enabled
        ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies first
        DROP POLICY IF EXISTS periods_select ON periods;
        DROP POLICY IF EXISTS periods_insert ON periods;
        DROP POLICY IF EXISTS periods_update ON periods;
        DROP POLICY IF EXISTS periods_delete ON periods;
        
        -- SELECT
        CREATE POLICY periods_select ON periods
            FOR SELECT
            USING (can_access_campus(campus_id));
        
        -- INSERT
        CREATE POLICY periods_insert ON periods
            FOR INSERT
            WITH CHECK (is_campus_admin(campus_id));
        
        -- UPDATE
        CREATE POLICY periods_update ON periods
            FOR UPDATE
            USING (is_campus_admin(campus_id))
            WITH CHECK (is_campus_admin(campus_id));
        
        -- DELETE
        CREATE POLICY periods_delete ON periods
            FOR DELETE
            USING (is_campus_admin(campus_id));
    END IF;
END $$;

-- =============================================
-- STEP 4: UPDATE HELPER FUNCTIONS WITH SECURITY DEFINER
-- =============================================

-- Drop existing functions first to avoid signature conflicts
DROP FUNCTION IF EXISTS get_grade_with_stats();
DROP FUNCTION IF EXISTS get_grade_with_stats(UUID);
DROP FUNCTION IF EXISTS get_grade_with_stats(UUID, UUID);
DROP FUNCTION IF EXISTS get_sections_by_grade(UUID);
DROP FUNCTION IF EXISTS get_sections_by_grade(UUID, UUID);
DROP FUNCTION IF EXISTS get_sections_by_grade(p_grade_level_id UUID);
DROP FUNCTION IF EXISTS get_sections_by_grade(p_grade_level_id UUID, p_school_id UUID);
DROP FUNCTION IF EXISTS get_sections_by_grade(p_grade_level_id UUID, p_campus_id UUID);
DROP FUNCTION IF EXISTS get_all_sections_with_campus();
DROP FUNCTION IF EXISTS get_all_sections_with_campus(UUID);
DROP FUNCTION IF EXISTS get_all_sections_with_campus(UUID, UUID);
DROP FUNCTION IF EXISTS get_subjects_by_campus(UUID);
DROP FUNCTION IF EXISTS get_subjects_by_campus(UUID, UUID);

-- Get grade levels with stats (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION get_grade_with_stats(p_campus_id UUID DEFAULT NULL, p_school_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    campus_id UUID,
    school_id UUID,
    name VARCHAR,
    order_index INTEGER,
    base_fee DECIMAL,
    is_active BOOLEAN,
    sections_count BIGINT,
    subjects_count BIGINT,
    students_count BIGINT
) AS $$
DECLARE
    user_school_id UUID;
    user_role TEXT;
BEGIN
    -- Get user info for logging/debugging
    SELECT p.school_id, p.role INTO user_school_id, user_role
    FROM profiles p
    WHERE p.id = auth.uid();

    -- Return grade levels - the filtering handles access control
    -- We check campus access inline instead of returning empty
    RETURN QUERY
    SELECT 
        g.id AS id,
        g.campus_id AS campus_id,
        g.school_id AS school_id,
        g.name::VARCHAR AS name,
        g.order_index AS order_index,
        g.base_fee AS base_fee,
        g.is_active AS is_active,
        COUNT(DISTINCT sec.id) AS sections_count,
        COUNT(DISTINCT sub.id) AS subjects_count,
        COALESCE(SUM(sec.current_strength), 0) AS students_count
    FROM grade_levels g
    LEFT JOIN sections sec ON sec.grade_level_id = g.id AND sec.is_active = true
    LEFT JOIN subjects sub ON sub.grade_level_id = g.id AND sub.is_active = true
    WHERE 
        (p_campus_id IS NULL OR g.campus_id = p_campus_id) AND
        (p_school_id IS NULL OR g.school_id = p_school_id) AND
        g.is_active = true AND
        -- Inline access check: user can access if they match, or are admin of parent, or super_admin
        (
            user_role = 'super_admin' OR
            g.campus_id = user_school_id OR
            g.school_id = user_school_id OR
            EXISTS (
                SELECT 1 FROM schools s 
                WHERE s.id = g.campus_id AND s.parent_school_id = user_school_id
            ) OR
            EXISTS (
                SELECT 1 FROM schools s 
                WHERE s.id = user_school_id AND s.parent_school_id = g.campus_id
            )
        )
    GROUP BY g.id, g.campus_id, g.school_id, g.name, g.order_index, g.base_fee, g.is_active
    ORDER BY g.order_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get sections by grade (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION get_sections_by_grade(p_grade_level_id UUID, p_campus_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    campus_id UUID,
    school_id UUID,
    grade_level_id UUID,
    grade_name VARCHAR,
    section_name VARCHAR,
    capacity INTEGER,
    current_strength INTEGER,
    available_seats INTEGER,
    is_active BOOLEAN
) AS $$
DECLARE
    user_school_id UUID;
    user_role TEXT;
BEGIN
    -- Get user info
    SELECT p.school_id, p.role INTO user_school_id, user_role
    FROM profiles p
    WHERE p.id = auth.uid();

    RETURN QUERY
    SELECT 
        s.id AS id,
        s.campus_id AS campus_id,
        s.school_id AS school_id,
        s.grade_level_id AS grade_level_id,
        g.name::VARCHAR AS grade_name,
        s.name::VARCHAR AS section_name,
        s.capacity AS capacity,
        s.current_strength AS current_strength,
        (s.capacity - s.current_strength)::INTEGER AS available_seats,
        s.is_active AS is_active
    FROM sections s
    JOIN grade_levels g ON g.id = s.grade_level_id
    WHERE 
        s.grade_level_id = p_grade_level_id AND
        (p_campus_id IS NULL OR s.campus_id = p_campus_id) AND
        s.is_active = true AND
        -- Inline access check
        (
            user_role = 'super_admin' OR
            s.campus_id = user_school_id OR
            EXISTS (
                SELECT 1 FROM schools sc 
                WHERE sc.id = s.campus_id AND sc.parent_school_id = user_school_id
            ) OR
            EXISTS (
                SELECT 1 FROM schools sc 
                WHERE sc.id = user_school_id AND sc.parent_school_id = s.campus_id
            )
        )
    ORDER BY s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get all sections with campus info (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION get_all_sections_with_campus(p_campus_id UUID DEFAULT NULL, p_school_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    campus_id UUID,
    campus_name VARCHAR,
    school_id UUID,
    grade_level_id UUID,
    grade VARCHAR,
    section VARCHAR,
    capacity INTEGER,
    current_strength INTEGER,
    available_seats INTEGER,
    is_active BOOLEAN
) AS $$
DECLARE
    user_school_id UUID;
    user_role TEXT;
BEGIN
    -- Get user info
    SELECT p.school_id, p.role INTO user_school_id, user_role
    FROM profiles p
    WHERE p.id = auth.uid();

    RETURN QUERY
    SELECT 
        s.id AS id,
        s.campus_id AS campus_id,
        c.name::VARCHAR AS campus_name,
        s.school_id AS school_id,
        s.grade_level_id AS grade_level_id,
        g.name::VARCHAR AS grade,
        s.name::VARCHAR AS section,
        s.capacity AS capacity,
        s.current_strength AS current_strength,
        (s.capacity - s.current_strength)::INTEGER AS available_seats,
        s.is_active AS is_active
    FROM sections s
    JOIN grade_levels g ON g.id = s.grade_level_id
    JOIN schools c ON c.id = s.campus_id
    WHERE 
        (p_campus_id IS NULL OR s.campus_id = p_campus_id) AND
        (p_school_id IS NULL OR s.school_id = p_school_id) AND
        s.is_active = true AND
        -- Inline access check
        (
            user_role = 'super_admin' OR
            s.campus_id = user_school_id OR
            EXISTS (
                SELECT 1 FROM schools sc 
                WHERE sc.id = s.campus_id AND sc.parent_school_id = user_school_id
            ) OR
            EXISTS (
                SELECT 1 FROM schools sc 
                WHERE sc.id = user_school_id AND sc.parent_school_id = s.campus_id
            )
        )
    ORDER BY c.name, g.order_index, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get subjects by campus (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION get_subjects_by_campus(p_campus_id UUID, p_grade_level_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    campus_id UUID,
    school_id UUID,
    grade_level_id UUID,
    grade_name VARCHAR,
    subject_name VARCHAR,
    code VARCHAR,
    subject_type VARCHAR,
    is_active BOOLEAN,
    assigned_teachers_count BIGINT
) AS $$
DECLARE
    user_school_id UUID;
    user_role TEXT;
BEGIN
    -- Get user info
    SELECT p.school_id, p.role INTO user_school_id, user_role
    FROM profiles p
    WHERE p.id = auth.uid();

    RETURN QUERY
    SELECT 
        sub.id AS id,
        sub.campus_id AS campus_id,
        sub.school_id AS school_id,
        sub.grade_level_id AS grade_level_id,
        g.name::VARCHAR AS grade_name,
        sub.name::VARCHAR AS subject_name,
        sub.code::VARCHAR AS code,
        sub.subject_type::VARCHAR AS subject_type,
        sub.is_active AS is_active,
        COALESCE(COUNT(DISTINCT tsa.teacher_id), 0) AS assigned_teachers_count
    FROM subjects sub
    JOIN grade_levels g ON g.id = sub.grade_level_id
    LEFT JOIN teacher_subject_assignments tsa ON tsa.subject_id = sub.id
    WHERE 
        sub.campus_id = p_campus_id AND
        (p_grade_level_id IS NULL OR sub.grade_level_id = p_grade_level_id) AND
        sub.is_active = true AND
        -- Inline access check
        (
            user_role = 'super_admin' OR
            sub.campus_id = user_school_id OR
            EXISTS (
                SELECT 1 FROM schools sc 
                WHERE sc.id = sub.campus_id AND sc.parent_school_id = user_school_id
            ) OR
            EXISTS (
                SELECT 1 FROM schools sc 
                WHERE sc.id = user_school_id AND sc.parent_school_id = sub.campus_id
            )
        )
    GROUP BY sub.id, sub.campus_id, sub.school_id, sub.grade_level_id, g.name, g.order_index, sub.name, sub.code, sub.subject_type, sub.is_active
    ORDER BY g.order_index, sub.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- STEP 5: GRANT EXECUTE PERMISSIONS
-- =============================================

GRANT EXECUTE ON FUNCTION can_access_campus(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_campus_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_grade_with_stats(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sections_by_grade(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_sections_with_campus(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_subjects_by_campus(UUID, UUID) TO authenticated;

-- =============================================
-- STEP 6: VERIFICATION QUERIES (for debugging)
-- =============================================

-- Check current policies
DO $$
BEGIN
    RAISE NOTICE '✅ Campus-specific RLS policies created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables with new policies:';
    RAISE NOTICE '  - grade_levels (select, insert, update, delete)';
    RAISE NOTICE '  - sections (select, insert, update, delete)';
    RAISE NOTICE '  - subjects (select, insert, update, delete)';
    RAISE NOTICE '  - teacher_subject_assignments (select, insert, update, delete)';
    RAISE NOTICE '  - timetable_entries (select, insert, update, delete)';
    RAISE NOTICE '  - periods (select, insert, update, delete)';
    RAISE NOTICE '';
    RAISE NOTICE 'Helper functions updated with SECURITY DEFINER:';
    RAISE NOTICE '  - get_grade_with_stats()';
    RAISE NOTICE '  - get_sections_by_grade()';
    RAISE NOTICE '  - get_all_sections_with_campus()';
    RAISE NOTICE '  - get_subjects_by_campus()';
    RAISE NOTICE '';
    RAISE NOTICE 'New access control functions:';
    RAISE NOTICE '  - can_access_campus(campus_id)';
    RAISE NOTICE '  - is_campus_admin(campus_id)';
END $$;
