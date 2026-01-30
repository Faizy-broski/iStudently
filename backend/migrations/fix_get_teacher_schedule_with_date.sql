-- Fix: Add p_date parameter to get_teacher_schedule function
-- The backend service calls this function with both p_teacher_id and p_date

-- First drop all existing versions
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid::regprocedure AS func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'get_teacher_schedule'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_signature || ' CASCADE';
    END LOOP;
END $$;

-- Create the function with p_date parameter
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
    subject_id UUID,
    campus_id UUID,
    day_of_week INTEGER
) AS $$
DECLARE
    v_day_of_week INTEGER;
BEGIN
    -- Get day of week from date (ISODOW: Monday=1, Sunday=7, we use Monday=0)
    v_day_of_week := EXTRACT(ISODOW FROM p_date) - 1;
    
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
    AND te.day_of_week = v_day_of_week
    ORDER BY p.period_number;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_teacher_schedule TO authenticated;

COMMENT ON FUNCTION get_teacher_schedule IS 'Get teacher schedule for a specific date with campus_id';
