-- ============================================================================
-- Optimized SQL Functions for Teacher Base Salary Management
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Function to get teacher with salary in a single optimized query
CREATE OR REPLACE FUNCTION get_teacher_with_salary(
  p_teacher_id UUID,
  p_school_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  profile_id UUID,
  school_id UUID,
  employee_number VARCHAR,
  title VARCHAR,
  department VARCHAR,
  qualifications TEXT,
  specialization VARCHAR,
  date_of_joining DATE,
  employment_type VARCHAR,
  is_active BOOLEAN,
  permissions JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  base_salary DECIMAL,
  profile JSONB,
  grade_level JSONB,
  section JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.profile_id,
    s.school_id,
    s.employee_number,
    s.title,
    s.department,
    s.qualifications,
    s.specialization,
    s.date_of_joining,
    s.employment_type,
    s.is_active,
    s.permissions,
    s.created_at,
    s.updated_at,
    s.created_by,
    COALESCE(ss.base_salary, 0) as base_salary,
    jsonb_build_object(
      'id', p.id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'email', p.email,
      'phone', p.phone,
      'role', p.role,
      'username', p.username
    ) as profile,
    CASE WHEN gl.id IS NOT NULL THEN
      jsonb_build_object(
        'id', gl.id,
        'name', gl.name
      )
    ELSE NULL END as grade_level,
    CASE WHEN sec.id IS NOT NULL THEN
      jsonb_build_object(
        'id', sec.id,
        'name', sec.name,
        'capacity', sec.capacity
      )
    ELSE NULL END as section
  FROM staff s
  JOIN profiles p ON s.profile_id = p.id
  LEFT JOIN salary_structures ss ON ss.staff_id = s.id AND ss.is_current = true
  LEFT JOIN grade_levels gl ON s.grade_level_id = gl.id
  LEFT JOIN sections sec ON s.section_id = sec.id
  WHERE s.id = p_teacher_id
    AND (p_school_id IS NULL OR s.school_id = p_school_id);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_teacher_with_salary TO authenticated;
GRANT EXECUTE ON FUNCTION get_teacher_with_salary TO service_role;


-- ============================================================================
-- Verify the function works
-- ============================================================================

-- Test with a teacher ID (replace with actual ID from your database)
-- SELECT * FROM get_teacher_with_salary('YOUR_TEACHER_ID_HERE');

-- Or test with school_id filter
-- SELECT * FROM get_teacher_with_salary('YOUR_TEACHER_ID_HERE', 'YOUR_SCHOOL_ID_HERE');


-- ============================================================================
-- Performance Optimization: Add index if not exists
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_salary_structures_staff_current 
ON salary_structures(staff_id, is_current) 
WHERE is_current = true;

COMMENT ON INDEX idx_salary_structures_staff_current IS 
'Optimizes lookup of current salary for a staff member';


-- ============================================================================
-- NOTES
-- ============================================================================
-- This function provides optimal performance by:
-- 1. Single query with LEFT JOINs (no N+1 problem)
-- 2. Uses COALESCE for default base_salary = 0
-- 3. Returns JSONB for nested objects (profile, grade_level, section)
-- 4. Index on (staff_id, is_current) for fast salary lookup
