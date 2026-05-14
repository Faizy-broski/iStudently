-- Migration: Make Timetable System Fully Campus-Specific
-- This migration updates timetable_entries to use campus school_id
-- and ensures academic_years exist for each campus

-- ============================================================================
-- STEP 1: Create academic years for campuses that don't have them
-- Copy academic years from main school to campuses
-- ============================================================================

-- Insert academic years for campuses based on main school's academic years
INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_current, created_at)
SELECT 
    gen_random_uuid(),
    s.id as school_id,
    ay.name,
    ay.start_date,
    ay.end_date,
    ay.is_current,
    NOW()
FROM schools s
CROSS JOIN academic_years ay
WHERE s.parent_school_id IS NOT NULL  -- Only campuses
AND ay.school_id = s.parent_school_id  -- Academic years from parent school
AND NOT EXISTS (
    -- Don't insert if campus already has this academic year
    SELECT 1 FROM academic_years existing 
    WHERE existing.school_id = s.id 
    AND existing.name = ay.name
);

-- ============================================================================
-- STEP 2: Update timetable_entries to use campus school_id
-- The campus school_id can be derived from the section's school_id
-- ============================================================================

-- Update timetable_entries school_id to match the section's school_id (campus)
UPDATE timetable_entries te
SET school_id = sec.school_id
FROM sections sec
WHERE te.section_id = sec.id
AND te.school_id != sec.school_id;

-- ============================================================================
-- STEP 3: Update academic_year_id in timetable_entries to use campus academic year
-- ============================================================================

-- Update timetable_entries to use the campus's academic year
UPDATE timetable_entries te
SET academic_year_id = campus_ay.id
FROM sections sec
INNER JOIN academic_years main_ay ON te.academic_year_id = main_ay.id
INNER JOIN academic_years campus_ay ON campus_ay.school_id = sec.school_id 
    AND campus_ay.name = main_ay.name
WHERE te.section_id = sec.id
AND te.academic_year_id != campus_ay.id;

-- ============================================================================
-- STEP 4: Update attendance_records to use campus school_id
-- ============================================================================

-- Update attendance_records school_id to match timetable_entry's school_id
UPDATE attendance_records ar
SET school_id = te.school_id
FROM timetable_entries te
WHERE ar.timetable_entry_id = te.id
AND ar.school_id != te.school_id;

-- ============================================================================
-- STEP 5: Update RLS policies for timetable_entries
-- Allow access when user's school_id matches OR user is from parent school
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "timetable_entries_select_policy" ON timetable_entries;
DROP POLICY IF EXISTS "timetable_entries_insert_policy" ON timetable_entries;
DROP POLICY IF EXISTS "timetable_entries_update_policy" ON timetable_entries;
DROP POLICY IF EXISTS "timetable_entries_delete_policy" ON timetable_entries;
DROP POLICY IF EXISTS "Users can view timetable entries" ON timetable_entries;
DROP POLICY IF EXISTS "Users can manage timetable entries" ON timetable_entries;

-- Create new RLS policies that support campus structure
CREATE POLICY "timetable_entries_select_policy" ON timetable_entries
FOR SELECT USING (
    -- User can view if they belong to the same school (campus)
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- User can view if they belong to the parent school
    school_id IN (
        SELECT s.id FROM schools s 
        INNER JOIN profiles p ON p.id = auth.uid()
        WHERE s.parent_school_id = p.school_id
    )
    OR
    -- User can view if their school is a campus of the entry's school
    EXISTS (
        SELECT 1 FROM schools s
        INNER JOIN profiles p ON p.id = auth.uid()
        WHERE s.id = p.school_id
        AND s.parent_school_id = timetable_entries.school_id
    )
    OR
    -- Super admin can view all
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "timetable_entries_insert_policy" ON timetable_entries
FOR INSERT WITH CHECK (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    school_id IN (
        SELECT s.id FROM schools s 
        INNER JOIN profiles p ON p.id = auth.uid()
        WHERE s.parent_school_id = p.school_id
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "timetable_entries_update_policy" ON timetable_entries
FOR UPDATE USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    school_id IN (
        SELECT s.id FROM schools s 
        INNER JOIN profiles p ON p.id = auth.uid()
        WHERE s.parent_school_id = p.school_id
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "timetable_entries_delete_policy" ON timetable_entries
FOR DELETE USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    school_id IN (
        SELECT s.id FROM schools s 
        INNER JOIN profiles p ON p.id = auth.uid()
        WHERE s.parent_school_id = p.school_id
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- ============================================================================
-- STEP 6: Update RLS policies for attendance_records
-- ============================================================================

DROP POLICY IF EXISTS "attendance_records_select_policy" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_insert_policy" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_update_policy" ON attendance_records;
DROP POLICY IF EXISTS "Users can view attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Users can manage attendance records" ON attendance_records;

CREATE POLICY "attendance_records_select_policy" ON attendance_records
FOR SELECT USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    school_id IN (
        SELECT s.id FROM schools s 
        INNER JOIN profiles p ON p.id = auth.uid()
        WHERE s.parent_school_id = p.school_id
    )
    OR
    EXISTS (
        SELECT 1 FROM schools s
        INNER JOIN profiles p ON p.id = auth.uid()
        WHERE s.id = p.school_id
        AND s.parent_school_id = attendance_records.school_id
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "attendance_records_insert_policy" ON attendance_records
FOR INSERT WITH CHECK (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    school_id IN (
        SELECT s.id FROM schools s 
        INNER JOIN profiles p ON p.id = auth.uid()
        WHERE s.parent_school_id = p.school_id
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "attendance_records_update_policy" ON attendance_records
FOR UPDATE USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    school_id IN (
        SELECT s.id FROM schools s 
        INNER JOIN profiles p ON p.id = auth.uid()
        WHERE s.parent_school_id = p.school_id
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- ============================================================================
-- STEP 7: Update RLS policies for academic_years
-- ============================================================================

DROP POLICY IF EXISTS "academic_years_select_policy" ON academic_years;
DROP POLICY IF EXISTS "Users can view academic years" ON academic_years;

CREATE POLICY "academic_years_select_policy" ON academic_years
FOR SELECT USING (
    -- Direct match
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- User from parent school can see campus academic years
    school_id IN (
        SELECT s.id FROM schools s 
        INNER JOIN profiles p ON p.id = auth.uid()
        WHERE s.parent_school_id = p.school_id
    )
    OR
    -- Campus user can see parent school academic years
    EXISTS (
        SELECT 1 FROM schools s
        INNER JOIN profiles p ON p.id = auth.uid()
        WHERE s.id = p.school_id
        AND s.parent_school_id = academic_years.school_id
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- ============================================================================
-- STEP 8: Update RLS policies for periods (campus-specific)
-- ============================================================================

DROP POLICY IF EXISTS "periods_select_policy" ON periods;
DROP POLICY IF EXISTS "Users can view periods" ON periods;

CREATE POLICY "periods_select_policy" ON periods
FOR SELECT USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Campus user can see if campus_id matches their school_id
    campus_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    school_id IN (
        SELECT s.id FROM schools s 
        INNER JOIN profiles p ON p.id = auth.uid()
        WHERE s.parent_school_id = p.school_id
    )
    OR
    EXISTS (
        SELECT 1 FROM schools s
        INNER JOIN profiles p ON p.id = auth.uid()
        WHERE s.id = p.school_id
        AND s.parent_school_id = periods.school_id
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- ============================================================================
-- STEP 9: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON timetable_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON attendance_records TO authenticated;
GRANT SELECT ON academic_years TO authenticated;
GRANT SELECT ON periods TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (run manually to verify)
-- ============================================================================

-- Check timetable_entries now have campus school_id:
-- SELECT te.id, te.school_id as entry_school_id, sec.school_id as section_school_id 
-- FROM timetable_entries te 
-- JOIN sections sec ON te.section_id = sec.id
-- WHERE te.school_id != sec.school_id;

-- Check academic years exist for campuses:
-- SELECT s.name as school_name, s.id as school_id, ay.name as academic_year
-- FROM schools s
-- LEFT JOIN academic_years ay ON ay.school_id = s.id
-- ORDER BY s.parent_school_id NULLS FIRST, s.name;
