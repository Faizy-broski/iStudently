-- Migration: Make periods campus-specific
-- This allows each campus to have its own period timings

-- Step 1: Add campus_id column to periods table
ALTER TABLE periods 
ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES schools(id);

-- Step 2: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_periods_campus_id ON periods(campus_id);

-- Step 3: Update existing periods - set campus_id to the first campus of each school
-- This is a one-time migration for existing data
UPDATE periods p
SET campus_id = (
    SELECT s.id 
    FROM schools s 
    WHERE s.parent_school_id = p.school_id 
    LIMIT 1
)
WHERE p.campus_id IS NULL
AND EXISTS (
    SELECT 1 FROM schools s WHERE s.parent_school_id = p.school_id
);

-- For schools without campuses, keep campus_id as NULL (periods apply to main school)

-- Step 4: Drop existing functions first (to allow changing return types)
DROP FUNCTION IF EXISTS get_teacher_schedule(UUID, DATE);
DROP FUNCTION IF EXISTS get_campus_periods(UUID);
DROP FUNCTION IF EXISTS get_students_for_timetable_entry(UUID);
DROP FUNCTION IF EXISTS generate_class_attendance(UUID, DATE);

-- Step 5: Update the get_teacher_schedule function to properly handle campus-specific periods
CREATE OR REPLACE FUNCTION get_teacher_schedule(
    p_teacher_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
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
    subject_id UUID
) AS $$
DECLARE
    day_number INTEGER;
    v_staff_school_id UUID;
    v_main_school_id UUID;
BEGIN
    -- Get day of week (0 = Monday in our system)
    day_number := EXTRACT(DOW FROM p_date) - 1;
    IF day_number = -1 THEN day_number := 6; END IF;
    
    -- Get the staff's school_id (this is their campus)
    SELECT school_id INTO v_staff_school_id FROM staff WHERE id = p_teacher_id;
    
    -- Get the main school ID (parent of campus, or same if not a campus)
    SELECT COALESCE(parent_school_id, id) INTO v_main_school_id 
    FROM schools WHERE id = v_staff_school_id;
    
    -- Query timetable entries directly by teacher_id
    -- Join with periods - filter by campus_id matching staff's school OR main school if campus_id is null
    RETURN QUERY
    SELECT
        te.id,
        p.period_number,
        p.period_name,
        p.start_time,
        p.end_time,
        sub.name as subject_name,
        sec.name as section_name,
        gl.name as grade_name,
        te.room_number,
        p.is_break,
        te.section_id,
        te.subject_id
    FROM timetable_entries te
    INNER JOIN periods p ON te.period_id = p.id
    LEFT JOIN subjects sub ON te.subject_id = sub.id
    LEFT JOIN sections sec ON te.section_id = sec.id
    LEFT JOIN grade_levels gl ON sec.grade_level_id = gl.id
    WHERE te.teacher_id = p_teacher_id
    AND te.day_of_week = day_number
    AND te.is_active = true
    AND p.is_active = true
    -- Period must match campus OR be a school-level period (null campus)
    AND (p.campus_id = v_staff_school_id OR (p.campus_id IS NULL AND p.school_id = v_main_school_id))
    ORDER BY p.period_number;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create a function to get periods for a specific campus
CREATE OR REPLACE FUNCTION get_campus_periods(
    p_campus_id UUID
)
RETURNS TABLE(
    id UUID,
    period_number INTEGER,
    period_name VARCHAR,
    start_time TIME,
    end_time TIME,
    is_break BOOLEAN,
    is_active BOOLEAN
) AS $$
DECLARE
    v_main_school_id UUID;
BEGIN
    -- Get the main school ID
    SELECT COALESCE(parent_school_id, id) INTO v_main_school_id 
    FROM schools WHERE id = p_campus_id;
    
    RETURN QUERY
    SELECT
        p.id,
        p.period_number,
        p.period_name,
        p.start_time,
        p.end_time,
        p.is_break,
        p.is_active
    FROM periods p
    WHERE (p.campus_id = p_campus_id OR (p.campus_id IS NULL AND p.school_id = v_main_school_id))
    AND p.is_active = true
    ORDER BY p.period_number;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Function to get section students for a timetable entry
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
    AND s.is_active = true
    ORDER BY s.student_number;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Function to generate attendance for a single class (on-demand)
CREATE OR REPLACE FUNCTION generate_class_attendance(
    p_timetable_entry_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    generated_count INTEGER
) AS $$
DECLARE
    v_school_id UUID;
    v_count INTEGER := 0;
BEGIN
    -- Get school ID from timetable entry
    SELECT school_id INTO v_school_id 
    FROM timetable_entries 
    WHERE id = p_timetable_entry_id;
    
    -- Insert attendance records for all students in the section
    -- Only for students who don't already have a record for this class/date
    INSERT INTO attendance_records (
        id,
        school_id,
        student_id,
        timetable_entry_id,
        attendance_date,
        status,
        auto_generated
    )
    SELECT 
        gen_random_uuid(),
        v_school_id,
        s.id,
        p_timetable_entry_id,
        p_date,
        'present',
        true
    FROM students s
    INNER JOIN timetable_entries te ON s.section_id = te.section_id
    WHERE te.id = p_timetable_entry_id
    AND s.is_active = true
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

-- Step 9: Grant execute permissions
GRANT EXECUTE ON FUNCTION get_teacher_schedule TO authenticated;
GRANT EXECUTE ON FUNCTION get_campus_periods TO authenticated;
GRANT EXECUTE ON FUNCTION get_students_for_timetable_entry TO authenticated;
GRANT EXECUTE ON FUNCTION generate_class_attendance TO authenticated;

-- Step 10: Add comments
COMMENT ON COLUMN periods.campus_id IS 'Optional campus reference. If NULL, period applies to main school and all campuses. If set, period is specific to that campus.';
COMMENT ON FUNCTION get_teacher_schedule IS 'Get teacher schedule for a specific date with campus-aware period filtering';
COMMENT ON FUNCTION get_campus_periods IS 'Get all periods for a specific campus (includes campus-specific and school-wide periods)';
COMMENT ON FUNCTION get_students_for_timetable_entry IS 'Get all students in a section for a specific timetable entry';
COMMENT ON FUNCTION generate_class_attendance IS 'Generate attendance records for a single class on-demand';
