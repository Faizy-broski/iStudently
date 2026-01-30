-- Fix campus-specific filtering for academics during student onboarding
-- This ensures grade levels and sections are properly filtered by campus

-- =============================================
-- UPDATE RLS POLICIES TO ENFORCE CAMPUS FILTERING
-- =============================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS grade_levels_select_policy ON grade_levels;
DROP POLICY IF EXISTS sections_select_policy ON sections;
DROP POLICY IF EXISTS subjects_select_policy ON subjects;

-- Create campus-aware SELECT policies for grade levels
CREATE POLICY "grade_levels_select_policy" ON grade_levels
FOR SELECT TO authenticated
USING (
    -- Always allow super_admin
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    OR
    -- Allow if user belongs to the same campus or parent school
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher', 'staff')
        AND
        (
            campus_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
            OR
            school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
            OR
            campus_id IN (SELECT id FROM schools WHERE parent_school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()))
        )
    )
);

-- Create campus-aware SELECT policies for sections
CREATE POLICY "sections_select_policy" ON sections
FOR SELECT TO authenticated
USING (
    -- Always allow super_admin
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    OR
    -- Allow if user belongs to the same campus or parent school
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher', 'staff')
        AND
        (
            campus_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
            OR
            school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
            OR
            campus_id IN (SELECT id FROM schools WHERE parent_school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()))
        )
    )
);

-- Create campus-aware SELECT policies for subjects
CREATE POLICY "subjects_select_policy" ON subjects
FOR SELECT TO authenticated
USING (
    -- Always allow super_admin
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    OR
    -- Allow if user belongs to the same campus or parent school
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher', 'staff')
        AND
        (
            campus_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
            OR
            school_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
            OR
            campus_id IN (SELECT id FROM schools WHERE parent_school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()))
        )
    )
);

-- =============================================
-- UPDATE THE FUNCTIONS TO PROPERLY FILTER
-- =============================================

-- Update get_grade_with_stats to respect campus filtering even more strictly
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
    -- Get user info
    SELECT p.school_id, p.role INTO user_school_id, user_role
    FROM profiles p
    WHERE p.id = auth.uid();

    -- If p_campus_id is provided, only return grades for that specific campus
    -- This ensures campus-specific filtering during student onboarding
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
        g.is_active = true AND
        -- Strict campus filtering when campus_id is provided
        (
            (p_campus_id IS NOT NULL AND g.campus_id = p_campus_id) OR
            (p_campus_id IS NULL AND p_school_id IS NOT NULL AND g.school_id = p_school_id) OR
            (p_campus_id IS NULL AND p_school_id IS NULL)
        ) AND
        -- Access control check
        (
            user_role = 'super_admin' OR
            g.campus_id = user_school_id OR
            g.school_id = user_school_id OR
            EXISTS (
                SELECT 1 FROM schools s 
                WHERE s.id = g.campus_id AND s.parent_school_id = user_school_id
            )
        )
    GROUP BY g.id, g.campus_id, g.school_id, g.name, g.order_index, g.base_fee, g.is_active
    ORDER BY g.order_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update get_sections_by_grade for better campus filtering
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
        s.is_active = true AND
        -- Strict campus filtering when campus_id is provided
        (p_campus_id IS NULL OR s.campus_id = p_campus_id) AND
        -- Access control
        (
            user_role = 'super_admin' OR
            s.campus_id = user_school_id OR
            EXISTS (
                SELECT 1 FROM schools sc 
                WHERE sc.id = s.campus_id AND sc.parent_school_id = user_school_id
            )
        )
    ORDER BY s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_grade_with_stats(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sections_by_grade(UUID, UUID) TO authenticated;

DO $$ BEGIN
    RAISE NOTICE '✅ Campus-specific filtering fix applied successfully';
    RAISE NOTICE '   - Updated RLS policies to enforce campus filtering';
    RAISE NOTICE '   - Enhanced get_grade_with_stats to respect campus boundaries';
    RAISE NOTICE '   - Enhanced get_sections_by_grade for proper campus filtering';
    RAISE NOTICE '   - Student onboarding will now show only campus-specific grades and sections';
END $$;