-- Migration: Add campus_id to timetable_entries for campus-specific timetables
-- school_id = main school (for organization/billing)
-- campus_id = specific campus where the class happens (for teachers/students)

-- ============================================================================
-- STEP 1: Add campus_id column to timetable_entries
-- ============================================================================

ALTER TABLE timetable_entries 
ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES schools(id);

-- Create index for campus_id queries
CREATE INDEX IF NOT EXISTS idx_timetable_entries_campus_id ON timetable_entries(campus_id);

-- ============================================================================
-- STEP 2: Backfill campus_id from section's school_id
-- ============================================================================

UPDATE timetable_entries te
SET campus_id = s.school_id
FROM sections s
WHERE te.section_id = s.id
AND te.campus_id IS NULL;

-- ============================================================================
-- STEP 3: Add campus_id to attendance_records
-- ============================================================================

ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES schools(id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_campus_id ON attendance_records(campus_id);

-- Backfill attendance campus_id from timetable entry
UPDATE attendance_records ar
SET campus_id = te.campus_id
FROM timetable_entries te
WHERE ar.timetable_entry_id = te.id
AND ar.campus_id IS NULL;

-- ============================================================================
-- STEP 4: Update RLS policies for timetable_entries
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view timetable from their school" ON timetable_entries;
DROP POLICY IF EXISTS "Users can view timetable from their school or parent" ON timetable_entries;
DROP POLICY IF EXISTS "Admins can manage timetable" ON timetable_entries;
DROP POLICY IF EXISTS "Admins can manage timetable for school hierarchy" ON timetable_entries;
DROP POLICY IF EXISTS "Teachers can view their timetable" ON timetable_entries;

-- New policy: Users can view timetable for their campus or school
CREATE POLICY "Users can view timetable for their campus or school" 
ON timetable_entries FOR SELECT
USING (
    -- Direct school match
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Campus match
    campus_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Teachers can always see their own entries
    teacher_id IN (SELECT id FROM staff WHERE profile_id = auth.uid())
);

-- Admins can manage timetable
CREATE POLICY "Admins can manage timetable"
ON timetable_entries FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() 
        AND p.role IN ('admin', 'super_admin')
        AND (
            p.school_id = timetable_entries.school_id
            OR p.school_id = timetable_entries.campus_id
        )
    )
);

-- ============================================================================
-- STEP 5: Update RLS policies for attendance_records
-- ============================================================================

DROP POLICY IF EXISTS "Users can view attendance from their school" ON attendance_records;
DROP POLICY IF EXISTS "Users can view attendance from school hierarchy" ON attendance_records;
DROP POLICY IF EXISTS "Teachers can mark attendance for their classes" ON attendance_records;
DROP POLICY IF EXISTS "Teachers can manage attendance for their classes" ON attendance_records;
DROP POLICY IF EXISTS "Teachers can insert attendance for their classes" ON attendance_records;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON attendance_records;
DROP POLICY IF EXISTS "Admins can manage attendance for school hierarchy" ON attendance_records;

-- Users can view attendance for their campus or school
CREATE POLICY "Users can view attendance for their campus or school"
ON attendance_records FOR SELECT
USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    campus_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    timetable_entry_id IN (
        SELECT id FROM timetable_entries WHERE teacher_id IN (
            SELECT id FROM staff WHERE profile_id = auth.uid()
        )
    )
);

-- Teachers can update attendance for their classes
CREATE POLICY "Teachers can update attendance for their classes"
ON attendance_records FOR UPDATE
USING (
    timetable_entry_id IN (
        SELECT id FROM timetable_entries 
        WHERE teacher_id IN (SELECT id FROM staff WHERE profile_id = auth.uid())
    )
);

-- Teachers can insert attendance for their classes
CREATE POLICY "Teachers can insert attendance for their classes"
ON attendance_records FOR INSERT
WITH CHECK (
    timetable_entry_id IN (
        SELECT id FROM timetable_entries 
        WHERE teacher_id IN (SELECT id FROM staff WHERE profile_id = auth.uid())
    )
);

-- Admins can manage all attendance
CREATE POLICY "Admins can manage all attendance"
ON attendance_records FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() 
        AND p.role IN ('admin', 'super_admin')
        AND (
            p.school_id = attendance_records.school_id
            OR p.school_id = attendance_records.campus_id
        )
    )
);

-- ============================================================================
-- STEP 6: Update get_teacher_schedule function to include campus_id
-- ============================================================================

-- Drop all versions of the function
DROP FUNCTION IF EXISTS get_teacher_schedule(UUID);
DROP FUNCTION IF EXISTS get_teacher_schedule(UUID, UUID);
DROP FUNCTION IF EXISTS get_teacher_schedule(p_teacher_id UUID);

CREATE OR REPLACE FUNCTION get_teacher_schedule(
    p_teacher_id UUID
)
RETURNS TABLE(
    id UUID,
    period_number INTEGER,
    period_name VARCHAR,
    start_time TIME,
    end_time TIME,
    subject_name VARCHAR,
    section_name VARCHAR,
    grade_name VARCHAR,
    room_number VARCHAR,
    is_break BOOLEAN,
    section_id UUID,
    subject_id UUID,
    campus_id UUID,
    day_of_week INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        te.id,
        p.period_number,
        p.period_name,
        p.start_time,
        p.end_time,
        subj.name as subject_name,
        sec.name as section_name,
        gl.name as grade_name,
        te.room_number,
        p.is_break,
        te.section_id,
        te.subject_id,
        te.campus_id,
        te.day_of_week
    FROM timetable_entries te
    INNER JOIN periods p ON te.period_id = p.id
    INNER JOIN subjects subj ON te.subject_id = subj.id
    INNER JOIN sections sec ON te.section_id = sec.id
    INNER JOIN grade_levels gl ON sec.grade_level_id = gl.id
    WHERE te.teacher_id = p_teacher_id
    AND te.is_active = true
    ORDER BY te.day_of_week, p.period_number;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_teacher_schedule TO authenticated;

-- ============================================================================
-- STEP 7: Update generate_class_attendance to include campus_id
-- ============================================================================

DROP FUNCTION IF EXISTS generate_class_attendance(UUID, DATE);

CREATE OR REPLACE FUNCTION generate_class_attendance(
    p_timetable_entry_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    generated_count INTEGER
) AS $$
DECLARE
    v_school_id UUID;
    v_campus_id UUID;
    v_count INTEGER := 0;
BEGIN
    -- Get school_id and campus_id from timetable entry
    SELECT school_id, campus_id INTO v_school_id, v_campus_id
    FROM timetable_entries 
    WHERE id = p_timetable_entry_id;
    
    -- Insert attendance records for all students in the section
    INSERT INTO attendance_records (
        id,
        school_id,
        campus_id,
        student_id,
        timetable_entry_id,
        attendance_date,
        status,
        auto_generated
    )
    SELECT 
        gen_random_uuid(),
        v_school_id,
        v_campus_id,
        s.id,
        p_timetable_entry_id,
        p_date,
        'present',
        true
    FROM students s
    INNER JOIN timetable_entries te ON s.section_id = te.section_id
    WHERE te.id = p_timetable_entry_id
    AND NOT EXISTS (
        SELECT 1 FROM attendance_records ar
        WHERE ar.student_id = s.id
        AND ar.timetable_entry_id = p_timetable_entry_id
        AND ar.attendance_date = p_date
    );
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION generate_class_attendance TO authenticated;

-- ============================================================================
-- STEP 8: Update get_students_for_timetable_entry function
-- ============================================================================

DROP FUNCTION IF EXISTS get_students_for_timetable_entry(UUID);

CREATE OR REPLACE FUNCTION get_students_for_timetable_entry(
    p_timetable_entry_id UUID
)
RETURNS TABLE(
    student_id UUID,
    student_number VARCHAR,
    first_name VARCHAR,
    last_name VARCHAR,
    full_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as student_id,
        s.student_number,
        pf.first_name,
        pf.last_name,
        CONCAT(pf.first_name, ' ', pf.last_name) as full_name
    FROM students s
    INNER JOIN profiles pf ON s.profile_id = pf.id
    INNER JOIN timetable_entries te ON s.section_id = te.section_id
    WHERE te.id = p_timetable_entry_id
    ORDER BY s.student_number;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_students_for_timetable_entry TO authenticated;

-- ============================================================================
-- STEP 9: Update generate_daily_attendance to include campus_id
-- ============================================================================

DROP FUNCTION IF EXISTS generate_daily_attendance(DATE);

CREATE OR REPLACE FUNCTION generate_daily_attendance(
    target_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    generated_count INTEGER,
    timetable_entries_processed INTEGER
) AS $$
DECLARE
    v_count INTEGER := 0;
    v_entries INTEGER := 0;
    v_day_of_week INTEGER;
BEGIN
    -- Get day of week (0=Sunday in PostgreSQL, we use 0=Monday)
    v_day_of_week := EXTRACT(ISODOW FROM target_date) - 1;
    
    -- Count timetable entries for today
    SELECT COUNT(*) INTO v_entries
    FROM timetable_entries
    WHERE day_of_week = v_day_of_week
    AND is_active = true;
    
    -- Generate attendance for all classes today
    INSERT INTO attendance_records (
        id,
        school_id,
        campus_id,
        student_id,
        timetable_entry_id,
        attendance_date,
        status,
        auto_generated
    )
    SELECT 
        gen_random_uuid(),
        te.school_id,
        te.campus_id,
        s.id,
        te.id,
        target_date,
        'present',
        true
    FROM timetable_entries te
    INNER JOIN students s ON s.section_id = te.section_id
    WHERE te.day_of_week = v_day_of_week
    AND te.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM attendance_records ar
        WHERE ar.student_id = s.id
        AND ar.timetable_entry_id = te.id
        AND ar.attendance_date = target_date
    );
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN QUERY SELECT v_count, v_entries;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION generate_daily_attendance TO authenticated;
