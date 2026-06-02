-- Migration: Fix get_teacher_schedule function to include timetable_entry_id
-- This is needed for the attendance marking functionality
-- Fixed to handle campus/parent school relationship properly

-- Step 1: Drop and recreate the get_teacher_schedule function with id column
-- Fixed to handle campus/parent school relationship - uses timetable entries directly
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
BEGIN
    -- Get day of week (0 = Monday in our system)
    day_number := EXTRACT(DOW FROM p_date) - 1;
    IF day_number = -1 THEN day_number := 6; END IF;
    
    -- Query timetable entries directly by teacher_id
    -- Join with periods to get period info - periods belong to main school
    -- Timetable entries link teacher to their campus via campus_id
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
    ORDER BY p.period_number;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create a function to get section students for a timetable entry
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
        p.first_name,
        p.last_name,
        CONCAT(p.first_name, ' ', p.last_name) as full_name
    FROM students s
    INNER JOIN profiles p ON s.profile_id = p.id
    INNER JOIN timetable_entries te ON s.section_id = te.section_id
    WHERE te.id = p_timetable_entry_id
    AND s.is_active = true
    ORDER BY s.student_number;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create function to generate attendance for a single class (on-demand)
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_teacher_schedule TO authenticated;
GRANT EXECUTE ON FUNCTION get_students_for_timetable_entry TO authenticated;
GRANT EXECUTE ON FUNCTION generate_class_attendance TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_teacher_schedule IS 'Get teacher schedule for a specific date with timetable entry IDs for attendance marking';
COMMENT ON FUNCTION get_students_for_timetable_entry IS 'Get all students in a section for a specific timetable entry';
COMMENT ON FUNCTION generate_class_attendance IS 'Generate attendance records for a single class on-demand';
