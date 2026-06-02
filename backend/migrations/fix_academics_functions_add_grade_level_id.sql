-- Fix academics functions to include grade_level_id in return types
-- This is needed for proper filtering in the teacher workload assignment UI

-- Drop existing functions first
DROP FUNCTION IF EXISTS get_sections_by_grade(UUID, UUID);
DROP FUNCTION IF EXISTS get_subjects_by_grade(UUID, UUID);

-- Recreate get_sections_by_grade with grade_level_id included
CREATE OR REPLACE FUNCTION get_sections_by_grade(
    p_school_id UUID,
    p_grade_level_id UUID
)
RETURNS TABLE (
    id UUID,
    grade_level_id UUID,
    name VARCHAR(100),
    capacity INTEGER,
    current_strength INTEGER,
    available_seats INTEGER,
    is_active BOOLEAN,
    grade_name VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.grade_level_id,
        s.name,
        s.capacity,
        s.current_strength,
        (s.capacity - s.current_strength) AS available_seats,
        s.is_active,
        gl.name AS grade_name
    FROM sections s
    INNER JOIN grade_levels gl ON s.grade_level_id = gl.id
    WHERE s.school_id = p_school_id
        AND (p_grade_level_id IS NULL OR s.grade_level_id = p_grade_level_id)
        AND s.is_active = true
    ORDER BY gl.order_index, s.name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Recreate get_subjects_by_grade with grade_level_id included
CREATE OR REPLACE FUNCTION get_subjects_by_grade(
    p_school_id UUID,
    p_grade_level_id UUID
)
RETURNS TABLE (
    id UUID,
    grade_level_id UUID,
    name VARCHAR(100),
    code VARCHAR(50),
    subject_type VARCHAR(20),
    is_active BOOLEAN,
    grade_name VARCHAR(100),
    grade_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        subj.id,
        subj.grade_level_id,
        subj.name,
        subj.code,
        subj.subject_type,
        subj.is_active,
        gl.name AS grade_name,
        gl.order_index AS grade_order
    FROM subjects subj
    INNER JOIN grade_levels gl ON subj.grade_level_id = gl.id
    WHERE subj.school_id = p_school_id
        AND (p_grade_level_id IS NULL OR subj.grade_level_id = p_grade_level_id)
        AND subj.is_active = true
    ORDER BY gl.order_index, subj.name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
