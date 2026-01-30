-- Debug query to check campus structure and grade levels
-- Run this in Supabase SQL Editor

-- 1. Check schools structure (main school and campuses)
SELECT 
    s.id,
    s.name,
    s.parent_school_id,
    ps.name as parent_name,
    CASE 
        WHEN s.parent_school_id IS NULL THEN 'MAIN SCHOOL'
        ELSE 'CAMPUS'
    END as type
FROM schools s
LEFT JOIN schools ps ON ps.id = s.parent_school_id
ORDER BY s.parent_school_id NULLS FIRST, s.name;

-- 1a. CRITICAL CHECK: Verify Bay Area campus parent relationship
SELECT 
    'Bay Area Campus Check' as check_type,
    s.id as campus_id,
    s.name as campus_name,
    s.parent_school_id,
    (s.parent_school_id = 'fb9eeb8f-8d32-4b0b-b502-1602106ac1d6') as has_correct_parent
FROM schools s
WHERE s.id = 'd62a870b-4cc0-44a3-b5fe-636010d8a67d';

-- 1b. Check all campuses that belong to main school
SELECT 
    'Campuses under main school' as check_type,
    s.id,
    s.name,
    s.parent_school_id
FROM schools s
WHERE s.parent_school_id = 'fb9eeb8f-8d32-4b0b-b502-1602106ac1d6';

-- 2. Check user's profile
SELECT 
    p.id as profile_id,
    p.school_id as user_school_id,
    p.role,
    s.name as school_name,
    s.parent_school_id,
    CASE 
        WHEN s.parent_school_id IS NULL THEN 'AT MAIN SCHOOL'
        ELSE 'AT CAMPUS'
    END as user_location
FROM profiles p
JOIN schools s ON s.id = p.school_id
WHERE p.role = 'admin'
LIMIT 5;

-- 3. Check grade levels and their campus assignments
SELECT 
    g.id,
    g.name as grade_name,
    g.campus_id,
    g.school_id,
    c.name as campus_name,
    c.parent_school_id,
    g.is_active
FROM grade_levels g
LEFT JOIN schools c ON c.id = g.campus_id
ORDER BY g.created_at DESC
LIMIT 20;

-- 3a. Direct check for Bay Area campus grades
SELECT 
    'Grades for Bay Area' as check_type,
    g.id,
    g.name,
    g.campus_id,
    g.is_active
FROM grade_levels g
WHERE g.campus_id = 'd62a870b-4cc0-44a3-b5fe-636010d8a67d';

-- 4. Test the access function for a specific campus
-- Replace the UUIDs with your actual values:
-- SELECT can_access_campus('d62a870b-4cc0-44a3-b5fe-636010d8a67d');

-- 5. TEST the get_grade_with_stats function directly
SELECT * FROM get_grade_with_stats('d62a870b-4cc0-44a3-b5fe-636010d8a67d', NULL);

-- 5. Test getting grade levels directly (bypassing RPC)
SELECT * FROM grade_levels 
WHERE is_active = true 
ORDER BY created_at DESC 
LIMIT 10;
