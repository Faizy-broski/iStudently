-- Debug why librarian doesn't see academic years
-- Run this to check school_id mismatch

-- 1. Check all academic years and their schools
SELECT 
    ay.id,
    ay.name,
    ay.is_current,
    ay.school_id,
    s.name as school_name
FROM academic_years ay
LEFT JOIN schools s ON s.id = ay.school_id
ORDER BY ay.created_at DESC;

-- 2. Check librarian's profile and school_id
SELECT 
    p.id as profile_id,
    p.email,
    p.role,
    st.school_id,
    s.name as school_name,
    st.employee_number
FROM profiles p
LEFT JOIN staff st ON st.profile_id = p.id
LEFT JOIN schools s ON s.id = st.school_id
WHERE p.role = 'librarian';

-- 3. Check admin's profile and school_id
SELECT 
    p.id as profile_id,
    p.email,
    p.role,
    st.school_id,
    s.name as school_name,
    st.employee_number
FROM profiles p
LEFT JOIN staff st ON st.profile_id = p.id
LEFT JOIN schools s ON s.id = st.school_id
WHERE p.role = 'admin'
ORDER BY p.created_at DESC
LIMIT 5;

-- 4. Check if there are any academic years at all
SELECT 
    COUNT(*) as total_academic_years,
    COUNT(DISTINCT school_id) as distinct_schools
FROM academic_years;

-- 5. Show school_id mismatch if any
SELECT 
    'Librarian School' as type,
    st.school_id,
    s.name as school_name
FROM profiles p
LEFT JOIN staff st ON st.profile_id = p.id
LEFT JOIN schools s ON s.id = st.school_id
WHERE p.role = 'librarian'
UNION ALL
SELECT 
    'Academic Years School' as type,
    ay.school_id,
    s.name as school_name
FROM academic_years ay
LEFT JOIN schools s ON s.id = ay.school_id
LIMIT 10;
