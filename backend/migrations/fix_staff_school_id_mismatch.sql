-- =========================================
-- FIX SCHOOL_ID MISMATCH FOR STAFF RECORDS
-- Sync staff.school_id with profile.school_id
-- Run this in Supabase SQL Editor
-- =========================================

-- First, check current mismatches
SELECT 
    s.id as staff_id,
    s.title,
    s.role,
    s.school_id as staff_school_id,
    p.school_id as profile_school_id,
    p.first_name,
    p.last_name,
    CASE 
        WHEN s.school_id != p.school_id THEN '❌ MISMATCH - WILL FIX'
        ELSE '✅ ALREADY CORRECT'
    END as status
FROM staff s
JOIN profiles p ON s.profile_id = p.id
WHERE s.role IN ('staff', 'librarian', 'admin', 'counselor')
  AND s.is_active = true;

-- Fix: Update all staff records to use their profile's school_id
UPDATE staff s
SET school_id = p.school_id
FROM profiles p
WHERE s.profile_id = p.id
  AND s.school_id != p.school_id;

-- Verify the fix
SELECT 
    s.id as staff_id,
    s.title,
    s.role,
    s.school_id as staff_school_id,
    p.school_id as profile_school_id,
    p.first_name,
    p.last_name,
    CASE 
        WHEN s.school_id != p.school_id THEN '❌ STILL MISMATCH'
        ELSE '✅ FIXED'
    END as status
FROM staff s
JOIN profiles p ON s.profile_id = p.id
WHERE s.role IN ('staff', 'librarian', 'admin', 'counselor')
  AND s.is_active = true;

-- Final check: Show all staff that will now appear in the list
SELECT 
    s.id,
    s.employee_number,
    s.title,
    s.role,
    s.school_id,
    p.first_name,
    p.last_name
FROM staff s
JOIN profiles p ON s.profile_id = p.id
WHERE s.role IN ('staff', 'librarian', 'admin', 'counselor')
  AND s.is_active = true
ORDER BY s.created_at DESC;
