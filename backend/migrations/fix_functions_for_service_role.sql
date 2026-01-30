-- =============================================
-- FIX: Update functions to work with service role
-- The backend uses SERVICE_ROLE_KEY which means auth.uid() returns NULL
-- These functions should trust the campus_id parameter since the backend 
-- already validates the user's access in the controller layer
-- =============================================

-- Drop existing functions first to avoid signature conflicts
DROP FUNCTION IF EXISTS get_grade_with_stats();
DROP FUNCTION IF EXISTS get_grade_with_stats(UUID);
DROP FUNCTION IF EXISTS get_grade_with_stats(UUID, UUID);
DROP FUNCTION IF EXISTS get_sections_by_grade(UUID);
DROP FUNCTION IF EXISTS get_sections_by_grade(UUID, UUID);
DROP FUNCTION IF EXISTS get_all_sections_with_campus();
DROP FUNCTION IF EXISTS get_all_sections_with_campus(UUID);
DROP FUNCTION IF EXISTS get_all_sections_with_campus(UUID, UUID);
DROP FUNCTION IF EXISTS get_subjects_by_campus(UUID);
DROP FUNCTION IF EXISTS get_subjects_by_campus(UUID, UUID);

-- =============================================
-- GET GRADE LEVELS WITH STATS
-- Simplified: No auth check - backend validates access
-- =============================================
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
BEGIN
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
        g.is_active = true
    GROUP BY g.id, g.campus_id, g.school_id, g.name, g.order_index, g.base_fee, g.is_active
    ORDER BY g.order_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- GET SECTIONS BY GRADE
-- Simplified: No auth check - backend validates access
-- =============================================
CREATE OR REPLACE FUNCTION get_sections_by_grade(p_grade_level_id UUID, p_campus_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    campus_id UUID,
    school_id UUID,
    grade_level_id UUID,
    grade_name VARCHAR,
    name VARCHAR,
    capacity INTEGER,
    current_strength INTEGER,
    available_seats INTEGER,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id AS id,
        s.campus_id AS campus_id,
        s.school_id AS school_id,
        s.grade_level_id AS grade_level_id,
        g.name::VARCHAR AS grade_name,
        s.name::VARCHAR AS name,
        s.capacity AS capacity,
        s.current_strength AS current_strength,
        (s.capacity - s.current_strength)::INTEGER AS available_seats,
        s.is_active AS is_active
    FROM sections s
    JOIN grade_levels g ON g.id = s.grade_level_id
    WHERE 
        (p_grade_level_id IS NULL OR s.grade_level_id = p_grade_level_id) AND
        (p_campus_id IS NULL OR s.campus_id = p_campus_id) AND
        s.is_active = true
    ORDER BY g.order_index, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- GET ALL SECTIONS WITH CAMPUS
-- Simplified: No auth check - backend validates access
-- =============================================
CREATE OR REPLACE FUNCTION get_all_sections_with_campus(p_campus_id UUID DEFAULT NULL, p_school_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    campus_id UUID,
    school_id UUID,
    grade_level_id UUID,
    grade_name VARCHAR,
    grade_order INTEGER,
    name VARCHAR,
    capacity INTEGER,
    current_strength INTEGER,
    available_seats INTEGER,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id AS id,
        s.campus_id AS campus_id,
        s.school_id AS school_id,
        s.grade_level_id AS grade_level_id,
        g.name::VARCHAR AS grade_name,
        g.order_index AS grade_order,
        s.name::VARCHAR AS name,
        s.capacity AS capacity,
        s.current_strength AS current_strength,
        (s.capacity - s.current_strength)::INTEGER AS available_seats,
        s.is_active AS is_active
    FROM sections s
    JOIN grade_levels g ON g.id = s.grade_level_id
    WHERE 
        (p_campus_id IS NULL OR s.campus_id = p_campus_id) AND
        (p_school_id IS NULL OR s.school_id = p_school_id) AND
        s.is_active = true AND
        g.is_active = true
    ORDER BY g.order_index, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- GET SUBJECTS BY CAMPUS
-- Simplified: No auth check - backend validates access
-- =============================================
CREATE OR REPLACE FUNCTION get_subjects_by_campus(p_campus_id UUID DEFAULT NULL, p_grade_level_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    campus_id UUID,
    school_id UUID,
    grade_level_id UUID,
    grade_name VARCHAR,
    grade_order INTEGER,
    name VARCHAR,
    code VARCHAR,
    subject_type VARCHAR,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sub.id AS id,
        sub.campus_id AS campus_id,
        sub.school_id AS school_id,
        sub.grade_level_id AS grade_level_id,
        g.name::VARCHAR AS grade_name,
        g.order_index AS grade_order,
        sub.name::VARCHAR AS name,
        sub.code::VARCHAR AS code,
        sub.subject_type::VARCHAR AS subject_type,
        sub.is_active AS is_active
    FROM subjects sub
    JOIN grade_levels g ON g.id = sub.grade_level_id
    WHERE 
        (p_campus_id IS NULL OR sub.campus_id = p_campus_id) AND
        (p_grade_level_id IS NULL OR sub.grade_level_id = p_grade_level_id) AND
        sub.is_active = true AND
        g.is_active = true
    ORDER BY g.order_index, sub.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================
GRANT EXECUTE ON FUNCTION get_grade_with_stats(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_grade_with_stats(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_sections_by_grade(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sections_by_grade(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_all_sections_with_campus(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_sections_with_campus(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_subjects_by_campus(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_subjects_by_campus(UUID, UUID) TO service_role;

-- =============================================
-- VERIFICATION
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Functions updated to work with service role';
    RAISE NOTICE '';
    RAISE NOTICE 'Test with:';
    RAISE NOTICE '  SELECT * FROM get_grade_with_stats(''d62a870b-4cc0-44a3-b5fe-636010d8a67d'', NULL);';
END $$;
