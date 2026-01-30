-- =========================================
-- TARGETED FIX FOR TEACHER SHOWING IN STAFF LIST
-- The teacher has staff_role='staff' when it should be 'teacher'
-- Run this in Supabase SQL Editor
-- =========================================

-- First, let's see the current state
SELECT 
    s.id,
    s.employee_number,
    s.title,
    s.role as staff_role,
    p.role as profile_role,
    p.first_name,
    p.last_name,
    CASE 
        WHEN s.role != p.role THEN '❌ MISMATCH'
        ELSE '✅ CORRECT'
    END as status
FROM staff s
JOIN profiles p ON s.profile_id = p.id
WHERE s.is_active = true
ORDER BY s.created_at DESC;

-- Fix: Sync staff.role with profile.role for ALL records
UPDATE staff s
SET role = p.role
FROM profiles p
WHERE s.profile_id = p.id
  AND s.role != p.role;

-- Verify the fix - should show teacher with staff_role='teacher' now
SELECT 
    s.id,
    s.employee_number,
    s.title,
    s.role as staff_role,
    p.role as profile_role,
    p.first_name,
    p.last_name,
    CASE 
        WHEN s.role != p.role THEN '❌ STILL MISMATCH'
        ELSE '✅ FIXED'
    END as status
FROM staff s
JOIN profiles p ON s.profile_id = p.id
WHERE s.is_active = true
ORDER BY s.created_at DESC;

-- Final verification: Show what will appear in staff page (excluding teachers)
SELECT 
    s.id,
    s.employee_number,
    s.title,
    s.role as staff_role,
    p.first_name,
    p.last_name
FROM staff s
JOIN profiles p ON s.profile_id = p.id
WHERE s.is_active = true
  AND s.role IN ('staff', 'librarian', 'admin', 'counselor')
ORDER BY s.created_at DESC;
