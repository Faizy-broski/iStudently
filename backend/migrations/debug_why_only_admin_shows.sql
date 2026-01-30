-- =========================================
-- DEBUG: Why only Admin shows, not Staff and Librarian
-- Check school_id and is_active status
-- Run this in Supabase SQL Editor
-- =========================================

-- Check all staff with their school_id and is_active status
SELECT 
    s.id,
    s.employee_number,
    s.title,
    s.role as staff_role,
    s.is_active,
    s.school_id as staff_school_id,
    p.role as profile_role,
    p.school_id as profile_school_id,
    p.first_name,
    p.last_name,
    p.email,
    CASE 
        WHEN s.is_active = false THEN '❌ INACTIVE'
        WHEN s.school_id != p.school_id THEN '❌ SCHOOL_ID MISMATCH'
        WHEN s.role NOT IN ('staff', 'librarian', 'admin', 'counselor') THEN '❌ WRONG ROLE'
        ELSE '✅ SHOULD SHOW'
    END as visibility_status
FROM staff s
JOIN profiles p ON s.profile_id = p.id
ORDER BY s.created_at DESC;

-- Check if school_ids are consistent
SELECT 
    s.school_id,
    COUNT(*) as total_staff,
    COUNT(*) FILTER (WHERE s.is_active = true) as active_staff,
    COUNT(*) FILTER (WHERE s.role = 'staff') as staff_count,
    COUNT(*) FILTER (WHERE s.role = 'librarian') as librarian_count,
    COUNT(*) FILTER (WHERE s.role = 'admin') as admin_count,
    COUNT(*) FILTER (WHERE s.role = 'teacher') as teacher_count
FROM staff s
GROUP BY s.school_id;

-- Show which records SHOULD appear in staff list
SELECT 
    s.id,
    s.employee_number,
    s.title,
    s.role,
    s.is_active,
    p.first_name,
    p.last_name
FROM staff s
JOIN profiles p ON s.profile_id = p.id
WHERE s.is_active = true
  AND s.role IN ('staff', 'librarian', 'admin', 'counselor')
ORDER BY s.created_at DESC;
