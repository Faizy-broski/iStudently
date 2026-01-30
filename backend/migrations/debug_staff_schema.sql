-- Deep analysis of staff table structure and data
-- Run this in Supabase SQL Editor

-- 1. Check table structure
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'staff'
ORDER BY ordinal_position;

-- 2. Check if role column exists and has data
SELECT 
    s.id,
    s.employee_number,
    s.title,
    s.role as staff_role,
    s.is_active,
    p.id as profile_id,
    p.role as profile_role,
    p.first_name,
    p.last_name,
    p.email
FROM staff s
LEFT JOIN profiles p ON s.profile_id = p.id
ORDER BY s.created_at DESC;

-- 3. Count staff by role (including NULL)
SELECT 
    COALESCE(role, 'NULL') as role,
    COUNT(*) as count
FROM staff
GROUP BY role
ORDER BY count DESC;

-- 4. Check profiles linked to staff
SELECT 
    p.id,
    p.role as profile_role,
    p.first_name,
    p.last_name,
    s.id as staff_id,
    s.role as staff_role,
    s.title
FROM profiles p
LEFT JOIN staff s ON s.profile_id = p.id
WHERE p.role IN ('staff', 'librarian', 'teacher', 'admin')
ORDER BY p.created_at DESC;
