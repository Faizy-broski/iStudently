-- =========================================
-- FIX STAFF ROLES - Ensure all staff have correct role values
-- Run this in Supabase SQL Editor
-- =========================================

-- First, let's see what we have
SELECT 
    s.id,
    s.title,
    s.role as staff_role,
    p.role as profile_role,
    p.first_name,
    p.last_name,
    p.email
FROM staff s
LEFT JOIN profiles p ON s.profile_id = p.id
WHERE s.role IS NULL OR s.role NOT IN ('staff', 'librarian', 'teacher', 'admin', 'counselor')
ORDER BY s.created_at DESC;

-- Update staff records where role is NULL or incorrect
-- Set to 'staff' by default unless title indicates librarian
UPDATE staff
SET role = CASE 
    WHEN LOWER(title) LIKE '%librarian%' THEN 'librarian'
    WHEN LOWER(title) LIKE '%teacher%' THEN 'teacher'
    WHEN LOWER(title) LIKE '%admin%' OR LOWER(title) LIKE '%principal%' THEN 'admin'
    ELSE 'staff'
END
WHERE role IS NULL OR role = 'teacher' AND LOWER(title) NOT LIKE '%teacher%';

-- Also sync with profile role if available (for all roles)
UPDATE staff s
SET role = p.role
FROM profiles p
WHERE s.profile_id = p.id
  AND p.role IN ('staff', 'librarian', 'teacher', 'admin')
  AND (s.role IS NULL OR s.role != p.role);

-- Verify the fix
SELECT 
    s.id,
    s.title,
    s.role as staff_role,
    p.role as profile_role,
    p.first_name,
    p.last_name,
    p.email,
    s.created_at
FROM staff s
LEFT JOIN profiles p ON s.profile_id = p.id
ORDER BY s.created_at DESC
LIMIT 50;

-- Count by role
SELECT 
    role,
    COUNT(*) as count
FROM staff
GROUP BY role
ORDER BY count DESC;
