-- =========================================
-- STUDENTS-SECTIONS INTEGRATION
-- ⚠️ RUN THIS AFTER create_academics_tables.sql
-- =========================================

-- Prerequisites:
-- 1. create_academics_tables.sql has been executed
-- 2. Students table exists
-- 3. Sections table exists with update_section_strength() function

-- Step 1: Add section and grade references to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS grade_level_id UUID REFERENCES grade_levels(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES sections(id) ON DELETE SET NULL;

-- Step 2: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade_level_id);
CREATE INDEX IF NOT EXISTS idx_students_section ON students(section_id);

-- Step 3: Migrate existing grade_level string data to grade_level_id (if needed)
-- This is optional - only if you have existing students with grade_level as string

-- Example migration:
-- UPDATE students s
-- SET grade_level_id = (
--     SELECT id FROM grade_levels gl 
--     WHERE gl.school_id = s.school_id 
--     AND gl.name = s.grade_level
--     LIMIT 1
-- )
-- WHERE s.grade_level IS NOT NULL;

-- Step 4: NOW create the trigger to auto-update section strength
-- This trigger uses the update_section_strength() function we created earlier
CREATE TRIGGER update_student_section_strength
    AFTER INSERT OR UPDATE OR DELETE ON students
    FOR EACH ROW
    EXECUTE FUNCTION update_section_strength();

-- Step 5: Initialize current_strength for existing sections
-- This counts students already assigned to sections
UPDATE sections s
SET current_strength = (
    SELECT COUNT(*) 
    FROM students st 
    WHERE st.section_id = s.id 
    AND st.school_id = s.school_id
),
updated_at = NOW()
WHERE s.school_id IS NOT NULL;

-- Step 6: Update get_grade_with_stats to include real student counts
CREATE OR REPLACE FUNCTION get_grade_with_stats(p_school_id UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR(100),
    order_index INTEGER,
    base_fee DECIMAL(10,2),
    is_active BOOLEAN,
    sections_count BIGINT,
    subjects_count BIGINT,
    students_count BIGINT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gl.id,
        gl.name,
        gl.order_index,
        gl.base_fee,
        gl.is_active,
        COUNT(DISTINCT s.id) AS sections_count,
        COUNT(DISTINCT subj.id) AS subjects_count,
        COUNT(DISTINCT st.id) AS students_count, -- Now using real student count
        gl.created_at
    FROM grade_levels gl
    LEFT JOIN sections s ON gl.id = s.grade_level_id AND s.is_active = true
    LEFT JOIN subjects subj ON gl.id = subj.grade_level_id AND subj.is_active = true
    LEFT JOIN students st ON gl.id = st.grade_level_id AND st.school_id = p_school_id
    WHERE gl.school_id = p_school_id
    GROUP BY gl.id, gl.name, gl.order_index, gl.base_fee, gl.is_active, gl.created_at
    ORDER BY gl.order_index;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 7: Create helper function to get students in a section
CREATE OR REPLACE FUNCTION get_students_by_section(
    p_school_id UUID,
    p_section_id UUID
)
RETURNS TABLE (
    student_id UUID,
    student_number VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    grade_level_name VARCHAR(100),
    section_name VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        st.id AS student_id,
        st.student_number,
        p.first_name,
        p.last_name,
        p.email,
        gl.name AS grade_level_name,
        sec.name AS section_name
    FROM students st
    INNER JOIN profiles p ON st.profile_id = p.id
    LEFT JOIN grade_levels gl ON st.grade_level_id = gl.id
    LEFT JOIN sections sec ON st.section_id = sec.id
    WHERE st.school_id = p_school_id
        AND (p_section_id IS NULL OR st.section_id = p_section_id)
        AND p.is_active = true
    ORDER BY p.last_name, p.first_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 8: Create function to validate student section assignment
CREATE OR REPLACE FUNCTION validate_student_section_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_grade_id UUID;
    v_section_grade_id UUID;
    v_section_capacity INTEGER;
    v_section_strength INTEGER;
BEGIN
    -- If section_id is being set
    IF NEW.section_id IS NOT NULL THEN
        -- Get the grade_id from the section
        SELECT grade_level_id, capacity, current_strength 
        INTO v_section_grade_id, v_section_capacity, v_section_strength
        FROM sections 
        WHERE id = NEW.section_id;
        
        -- Ensure student's grade matches section's grade
        IF NEW.grade_level_id IS NOT NULL AND NEW.grade_level_id != v_section_grade_id THEN
            RAISE EXCEPTION 'Student grade level does not match section grade level';
        END IF;
        
        -- Auto-assign grade if not set
        IF NEW.grade_level_id IS NULL THEN
            NEW.grade_level_id := v_section_grade_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_student_section
    BEFORE INSERT OR UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION validate_student_section_assignment();

-- Step 9: Add helpful comments
COMMENT ON COLUMN students.grade_level_id IS 'Foreign key to grade_levels table';
COMMENT ON COLUMN students.section_id IS 'Foreign key to sections table - determines student classroom';

-- Step 10: Create view for easy student-section-grade lookup
CREATE OR REPLACE VIEW student_academic_info AS
SELECT 
    st.id AS student_id,
    st.student_number,
    p.first_name,
    p.last_name,
    p.email,
    p.is_active,
    gl.id AS grade_level_id,
    gl.name AS grade_level_name,
    gl.order_index AS grade_order,
    sec.id AS section_id,
    sec.name AS section_name,
    sec.capacity AS section_capacity,
    sec.current_strength AS section_strength,
    st.school_id
FROM students st
INNER JOIN profiles p ON st.profile_id = p.id
LEFT JOIN grade_levels gl ON st.grade_level_id = gl.id
LEFT JOIN sections sec ON st.section_id = sec.id;

-- Grant appropriate permissions on the view
ALTER VIEW student_academic_info OWNER TO postgres;

-- Done! Students are now fully integrated with the academics system.

-- =========================================
-- TESTING QUERIES
-- =========================================

-- Test 1: Assign a student to a section (run this to test)
/*
UPDATE students 
SET 
    grade_level_id = (SELECT id FROM grade_levels WHERE name = 'Grade 10' LIMIT 1),
    section_id = (SELECT id FROM sections WHERE name = 'Section A' LIMIT 1)
WHERE student_number = 'STU001';
*/

-- Test 2: Check section strength was updated
/*
SELECT 
    s.name,
    s.capacity,
    s.current_strength,
    (s.capacity - s.current_strength) AS available_seats
FROM sections s
WHERE s.name = 'Section A';
*/

-- Test 3: View all students in a section
/*
SELECT * FROM student_academic_info 
WHERE section_name = 'Section A'
ORDER BY last_name, first_name;
*/

-- Test 4: Check grade statistics
/*
SELECT * FROM get_grade_with_stats('your-school-id');
*/

-- =========================================
-- ROLLBACK (if needed)
-- =========================================

/*
-- Drop trigger and revert changes
DROP TRIGGER IF EXISTS update_student_section_strength ON students;
DROP TRIGGER IF EXISTS validate_student_section ON students;
DROP VIEW IF EXISTS student_academic_info;
DROP FUNCTION IF EXISTS get_students_by_section(UUID, UUID);
DROP FUNCTION IF EXISTS validate_student_section_assignment();

-- Remove columns (WARNING: This deletes data!)
ALTER TABLE students DROP COLUMN IF EXISTS section_id;
ALTER TABLE students DROP COLUMN IF EXISTS grade_level_id;
*/
