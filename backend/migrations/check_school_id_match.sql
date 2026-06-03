-- Check school_id matching between admin profile and staff records
-- This is the critical check to see why only admin shows

-- First, get the admin's school_id (the one logged in)
SELECT 
    id as profile_id,
    email,
    role,
    school_id as admin_school_id,
    first_name,
    last_name
FROM profiles
WHERE role = 'admin'
  AND email LIKE '%admin%'; 

-- Then check if staff records have the SAME school_id
SELECT 
    s.id as staff_id,
    s.employee_number,
    s.title,
    s.role,
    s.school_id as staff_school_id,
    p.id as profile_id,
    p.first_name,
    p.last_name,
    p.school_id as profile_school_id,
    CASE 
        WHEN s.school_id IS NULL THEN '❌ STAFF SCHOOL_ID IS NULL'
        WHEN p.school_id IS NULL THEN '❌ PROFILE SCHOOL_ID IS NULL'
        WHEN s.school_id != p.school_id THEN '⚠️ SCHOOL_ID MISMATCH BETWEEN STAFF AND PROFILE'
        ELSE '✅ SCHOOL_IDs MATCH'
    END as school_id_status
FROM staff s
JOIN profiles p ON s.profile_id = p.id
WHERE s.role IN ('staff', 'librarian', 'admin', 'counselor')
  AND s.is_active = true
ORDER BY s.created_at DESC;

-- Show which school_id each staff belongs to
SELECT 
    s.school_id,
    s.role,
    s.title,
    p.first_name,
    p.last_name
FROM staff s
JOIN profiles p ON s.profile_id = p.id
WHERE s.role IN ('staff', 'librarian', 'admin', 'counselor')
  AND s.is_active = true;
