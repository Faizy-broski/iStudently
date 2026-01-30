-- =========================================
-- COMPREHENSIVE FIX FOR STAFF ROLES
-- This ensures the role column exists and is populated correctly
-- Run this in Supabase SQL Editor
-- =========================================

-- Step 1: Ensure role column exists in staff table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='staff' AND column_name='role'
    ) THEN
        ALTER TABLE staff ADD COLUMN role VARCHAR(50) DEFAULT 'staff' 
            CHECK (role IN ('teacher', 'admin', 'librarian', 'counselor', 'staff'));
        CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
    END IF;
END $$;

-- Step 2: Update ALL staff records to sync role from profile
UPDATE staff s
SET role = p.role
FROM profiles p
WHERE s.profile_id = p.id
  AND p.role IN ('staff', 'librarian', 'teacher', 'admin', 'counselor')
  AND (s.role IS NULL OR s.role != p.role);

-- Step 3: For any remaining NULL roles, set based on title
UPDATE staff
SET role = CASE 
    WHEN LOWER(title) LIKE '%librarian%' THEN 'librarian'
    WHEN LOWER(title) LIKE '%teacher%' THEN 'teacher'
    WHEN LOWER(title) LIKE '%admin%' OR LOWER(title) LIKE '%principal%' OR LOWER(title) LIKE '%director%' THEN 'admin'
    WHEN LOWER(title) LIKE '%counselor%' THEN 'counselor'
    ELSE 'staff'
END
WHERE role IS NULL;

-- Step 4: Verify the results
SELECT 
    s.id,
    s.employee_number,
    s.title,
    s.role as staff_role,
    s.is_active,
    p.role as profile_role,
    p.first_name,
    p.last_name,
    p.email
FROM staff s
LEFT JOIN profiles p ON s.profile_id = p.id
WHERE s.is_active = true
ORDER BY s.created_at DESC;

-- Step 5: Count by role
SELECT 
    role,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE is_active = true) as active_count
FROM staff
GROUP BY role
ORDER BY count DESC;
