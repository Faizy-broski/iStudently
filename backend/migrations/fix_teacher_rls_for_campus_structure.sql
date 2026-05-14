-- Migration: Fix RLS policies for campus structure
-- Teachers at campuses need to access timetable/attendance at main school level
-- This updates policies to check parent_school_id relationship

-- ============================================================================
-- STEP 1: Fix timetable_entries RLS
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view timetable from their school" ON timetable_entries;
DROP POLICY IF EXISTS "Admins can manage timetable" ON timetable_entries;
DROP POLICY IF EXISTS "Teachers can view their timetable" ON timetable_entries;

-- Create new policy: Users can view timetable from their school OR parent school
CREATE POLICY "Users can view timetable from their school or parent" 
ON timetable_entries FOR SELECT
USING (
    -- Direct school match
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Campus users can see timetable entries at parent school
    school_id IN (
        SELECT sch.parent_school_id 
        FROM profiles p
        JOIN schools sch ON p.school_id = sch.id
        WHERE p.id = auth.uid() AND sch.parent_school_id IS NOT NULL
    )
    OR
    -- Parent school users can see campus timetable entries
    school_id IN (
        SELECT sch.id 
        FROM schools sch
        WHERE sch.parent_school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    )
    OR
    -- Teachers can always see their own entries
    teacher_id IN (SELECT id FROM staff WHERE profile_id = auth.uid())
);

-- Admins can manage timetable at their school OR parent school
CREATE POLICY "Admins can manage timetable for school hierarchy"
ON timetable_entries FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() 
        AND p.role IN ('admin', 'super_admin')
        AND (
            p.school_id = timetable_entries.school_id
            OR p.school_id IN (
                SELECT sch.parent_school_id FROM schools sch WHERE sch.id = timetable_entries.school_id
            )
            OR p.school_id IN (
                SELECT sch.id FROM schools sch WHERE sch.parent_school_id = timetable_entries.school_id
            )
        )
    )
);

-- ============================================================================
-- STEP 2: Fix attendance_records RLS
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view attendance from their school" ON attendance_records;
DROP POLICY IF EXISTS "Teachers can mark attendance for their classes" ON attendance_records;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON attendance_records;

-- Users can view attendance from their school or parent school
CREATE POLICY "Users can view attendance from school hierarchy"
ON attendance_records FOR SELECT
USING (
    -- Direct school match
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Campus users can see attendance at parent school
    school_id IN (
        SELECT sch.parent_school_id 
        FROM profiles p
        JOIN schools sch ON p.school_id = sch.id
        WHERE p.id = auth.uid() AND sch.parent_school_id IS NOT NULL
    )
    OR
    -- Teachers can see attendance for their classes
    timetable_entry_id IN (
        SELECT id FROM timetable_entries WHERE teacher_id IN (
            SELECT id FROM staff WHERE profile_id = auth.uid()
        )
    )
);

-- Teachers can mark attendance for their classes
CREATE POLICY "Teachers can manage attendance for their classes"
ON attendance_records FOR UPDATE
USING (
    timetable_entry_id IN (
        SELECT id FROM timetable_entries 
        WHERE teacher_id IN (SELECT id FROM staff WHERE profile_id = auth.uid())
    )
);

-- Teachers can insert attendance records for their classes
CREATE POLICY "Teachers can insert attendance for their classes"
ON attendance_records FOR INSERT
WITH CHECK (
    timetable_entry_id IN (
        SELECT id FROM timetable_entries 
        WHERE teacher_id IN (SELECT id FROM staff WHERE profile_id = auth.uid())
    )
);

-- Admins can manage all attendance in school hierarchy
CREATE POLICY "Admins can manage attendance for school hierarchy"
ON attendance_records FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() 
        AND p.role IN ('admin', 'super_admin')
        AND (
            p.school_id = attendance_records.school_id
            OR p.school_id IN (
                SELECT sch.parent_school_id FROM schools sch WHERE sch.id = attendance_records.school_id
            )
            OR p.school_id IN (
                SELECT sch.id FROM schools sch WHERE sch.parent_school_id = attendance_records.school_id
            )
        )
    )
);

-- ============================================================================
-- STEP 3: Fix students RLS for teachers to see students
-- ============================================================================

-- Drop existing student view policies if they block teacher access
DROP POLICY IF EXISTS "Users can view students from their school" ON students;
DROP POLICY IF EXISTS "Teachers can view students in their sections" ON students;

-- Teachers can view students in sections they teach
CREATE POLICY "Users can view students from school hierarchy"
ON students FOR SELECT
USING (
    -- Direct school match
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Campus users can see students at parent school
    school_id IN (
        SELECT sch.parent_school_id 
        FROM profiles p
        JOIN schools sch ON p.school_id = sch.id
        WHERE p.id = auth.uid() AND sch.parent_school_id IS NOT NULL
    )
    OR
    -- Teachers can see students in sections they teach
    section_id IN (
        SELECT DISTINCT section_id 
        FROM timetable_entries 
        WHERE teacher_id IN (SELECT id FROM staff WHERE profile_id = auth.uid())
    )
);

-- ============================================================================
-- STEP 4: Fix sections RLS for teachers
-- ============================================================================

DROP POLICY IF EXISTS "Users can view sections from their school" ON sections;
DROP POLICY IF EXISTS "Teachers can view their sections" ON sections;

-- Users can view sections from school hierarchy
CREATE POLICY "Users can view sections from school hierarchy"
ON sections FOR SELECT
USING (
    -- Direct school match
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Campus users can see sections at parent school
    school_id IN (
        SELECT sch.parent_school_id 
        FROM profiles p
        JOIN schools sch ON p.school_id = sch.id
        WHERE p.id = auth.uid() AND sch.parent_school_id IS NOT NULL
    )
    OR
    -- Teachers can see sections they teach
    id IN (
        SELECT DISTINCT section_id 
        FROM timetable_entries 
        WHERE teacher_id IN (SELECT id FROM staff WHERE profile_id = auth.uid())
    )
);

-- ============================================================================
-- STEP 5: Fix subjects RLS for teachers
-- ============================================================================

DROP POLICY IF EXISTS "Users can view subjects from their school" ON subjects;

-- Users can view subjects from school hierarchy
CREATE POLICY "Users can view subjects from school hierarchy"
ON subjects FOR SELECT
USING (
    -- Direct school match
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Campus users can see subjects at parent school
    school_id IN (
        SELECT sch.parent_school_id 
        FROM profiles p
        JOIN schools sch ON p.school_id = sch.id
        WHERE p.id = auth.uid() AND sch.parent_school_id IS NOT NULL
    )
    OR
    -- Teachers can see subjects they are assigned to teach
    id IN (
        SELECT DISTINCT subject_id 
        FROM timetable_entries 
        WHERE teacher_id IN (SELECT id FROM staff WHERE profile_id = auth.uid())
    )
);

-- ============================================================================
-- STEP 6: Fix periods RLS for teachers
-- ============================================================================

DROP POLICY IF EXISTS "Users can view periods from their school" ON periods;

-- Users can view periods from school hierarchy
CREATE POLICY "Users can view periods from school hierarchy"
ON periods FOR SELECT
USING (
    -- Direct school match
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Campus users can see periods at parent school
    school_id IN (
        SELECT sch.parent_school_id 
        FROM profiles p
        JOIN schools sch ON p.school_id = sch.id
        WHERE p.id = auth.uid() AND sch.parent_school_id IS NOT NULL
    )
);

-- ============================================================================
-- STEP 7: Fix academic_years RLS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view academic years from their school" ON academic_years;

-- Users can view academic years from school hierarchy  
CREATE POLICY "Users can view academic years from school hierarchy"
ON academic_years FOR SELECT
USING (
    -- Direct school match
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Campus users can see academic years at parent school
    school_id IN (
        SELECT sch.parent_school_id 
        FROM profiles p
        JOIN schools sch ON p.school_id = sch.id
        WHERE p.id = auth.uid() AND sch.parent_school_id IS NOT NULL
    )
);
