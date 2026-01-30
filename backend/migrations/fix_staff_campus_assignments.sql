-- =========================================
-- FIX STAFF CAMPUS ASSIGNMENTS
-- This fixes staff members showing up in wrong campuses
-- Run this in Supabase SQL Editor
-- =========================================

-- STEP 1: Understand the structure
-- Show schools and their campuses
SELECT 
    s.id,
    s.name,
    s.parent_school_id,
    CASE 
        WHEN s.parent_school_id IS NULL THEN '🏫 PARENT SCHOOL'
        ELSE '🏢 CAMPUS'
    END as type
FROM schools s
ORDER BY s.parent_school_id NULLS FIRST, s.name;

-- STEP 2: Show current staff distribution
SELECT 
    s.school_id,
    sc.name as school_name,
    sc.parent_school_id,
    st.role,
    COUNT(*) as staff_count
FROM staff st
JOIN schools sc ON st.school_id = sc.id
WHERE st.is_active = true
  AND st.role IN ('staff', 'librarian', 'admin', 'counselor')
GROUP BY s.school_id, sc.name, sc.parent_school_id, st.role
ORDER BY sc.name, st.role;

-- STEP 3: Show which staff are in which campus
SELECT 
    st.id as staff_id,
    st.employee_number,
    st.title,
    st.role,
    st.school_id,
    sc.name as campus_name,
    sc.parent_school_id,
    p.first_name,
    p.last_name,
    p.email
FROM staff st
JOIN schools sc ON st.school_id = sc.id
JOIN profiles p ON st.profile_id = p.id
WHERE st.is_active = true
  AND st.role IN ('staff', 'librarian', 'admin', 'counselor')
ORDER BY sc.name, st.created_at DESC;

-- STEP 4: OPTIONAL - Move all staff to a specific campus
-- Uncomment and run this if you want to move staff to a different campus
-- Replace 'YOUR_CAMPUS_ID' with the actual campus ID

/*
UPDATE staff
SET school_id = 'YOUR_CAMPUS_ID'
WHERE role IN ('staff', 'librarian', 'admin', 'counselor')
  AND is_active = true;
  
-- Verify the move
SELECT 
    st.id,
    st.title,
    st.role,
    sc.name as campus_name,
    p.first_name,
    p.last_name
FROM staff st
JOIN schools sc ON st.school_id = sc.id
JOIN profiles p ON st.profile_id = p.id
WHERE st.role IN ('staff', 'librarian', 'admin', 'counselor')
  AND st.is_active = true;
*/
