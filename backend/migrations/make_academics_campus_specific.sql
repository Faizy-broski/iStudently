-- =========================================
-- MAKE ACADEMICS SYSTEM CAMPUS-SPECIFIC
-- This migration adds campus_id to all academic tables
-- =========================================

-- Step 1: Add campus_id to grade_levels table
ALTER TABLE grade_levels 
ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- Update existing grade_levels to use their school_id as campus_id
-- (For schools that are already campuses, this preserves their data)
UPDATE grade_levels
SET campus_id = school_id
WHERE campus_id IS NULL;

-- Make campus_id NOT NULL after populating
ALTER TABLE grade_levels 
ALTER COLUMN campus_id SET NOT NULL;

-- Update constraints to be campus-specific instead of school-specific
DO $$
BEGIN
    ALTER TABLE grade_levels DROP CONSTRAINT IF EXISTS unique_grade_per_school;
    ALTER TABLE grade_levels DROP CONSTRAINT IF EXISTS unique_order_per_school;
    
    -- Drop and recreate campus constraints to ensure idempotency
    ALTER TABLE grade_levels DROP CONSTRAINT IF EXISTS unique_grade_per_campus;
    ALTER TABLE grade_levels DROP CONSTRAINT IF EXISTS unique_order_per_campus;
    
    ALTER TABLE grade_levels ADD CONSTRAINT unique_grade_per_campus UNIQUE(campus_id, name);
    ALTER TABLE grade_levels ADD CONSTRAINT unique_order_per_campus UNIQUE(campus_id, order_index);
END $$;

-- Add index for campus_id
CREATE INDEX IF NOT EXISTS idx_grade_levels_campus ON grade_levels(campus_id, is_active);

-- Step 2: Add campus_id to sections table
ALTER TABLE sections 
ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- Update existing sections to use their school_id as campus_id
UPDATE sections
SET campus_id = school_id
WHERE campus_id IS NULL;

-- Make campus_id NOT NULL after populating
ALTER TABLE sections 
ALTER COLUMN campus_id SET NOT NULL;

-- Update constraints to be campus-specific
DO $$
BEGIN
    ALTER TABLE sections DROP CONSTRAINT IF EXISTS unique_section_per_grade;
    
    -- Drop and recreate campus constraint to ensure idempotency
    ALTER TABLE sections DROP CONSTRAINT IF EXISTS unique_section_per_grade_campus;
    ALTER TABLE sections ADD CONSTRAINT unique_section_per_grade_campus UNIQUE(campus_id, grade_level_id, name);
END $$;

-- Add index for campus_id
CREATE INDEX IF NOT EXISTS idx_sections_campus ON sections(campus_id, is_active);

-- Step 3: Add campus_id to subjects table
ALTER TABLE subjects 
ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- Update existing subjects to use their school_id as campus_id
UPDATE subjects
SET campus_id = school_id
WHERE campus_id IS NULL;

-- Make campus_id NOT NULL after populating
ALTER TABLE subjects 
ALTER COLUMN campus_id SET NOT NULL;

-- Update constraints to be campus-specific
DO $$
BEGIN
    ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_code;
    ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_per_grade;
    
    -- Drop and recreate campus constraints to ensure idempotency
    ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_code_per_campus;
    ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_per_grade_campus;
    
    ALTER TABLE subjects ADD CONSTRAINT unique_subject_code_per_campus UNIQUE(campus_id, code);
    ALTER TABLE subjects ADD CONSTRAINT unique_subject_per_grade_campus UNIQUE(campus_id, grade_level_id, name);
END $$;

-- Add index for campus_id
CREATE INDEX IF NOT EXISTS idx_subjects_campus ON subjects(campus_id, is_active);

-- Step 4: Add campus_id to teacher_subject_assignments table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_subject_assignments') THEN
        -- Add campus_id column
        ALTER TABLE teacher_subject_assignments 
        ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES schools(id) ON DELETE CASCADE;

        -- Update existing assignments to use their school_id as campus_id
        UPDATE teacher_subject_assignments
        SET campus_id = school_id
        WHERE campus_id IS NULL;

        -- Make campus_id NOT NULL
        ALTER TABLE teacher_subject_assignments 
        ALTER COLUMN campus_id SET NOT NULL;

        -- Update unique constraint
        ALTER TABLE teacher_subject_assignments
        DROP CONSTRAINT IF EXISTS unique_teacher_subject_section;
        
        -- Drop and recreate campus constraint to ensure idempotency
        ALTER TABLE teacher_subject_assignments
        DROP CONSTRAINT IF EXISTS unique_teacher_subject_section_campus;

        ALTER TABLE teacher_subject_assignments
        ADD CONSTRAINT unique_teacher_subject_section_campus UNIQUE(campus_id, teacher_id, subject_id, section_id, academic_year_id);

        -- Add index for campus_id
        CREATE INDEX IF NOT EXISTS idx_teacher_assignments_campus ON teacher_subject_assignments(campus_id);
    END IF;
END $$;

-- Step 5: Add campus_id to timetable_entries table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'timetable_entries') THEN
        -- Add campus_id column
        ALTER TABLE timetable_entries 
        ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES schools(id) ON DELETE CASCADE;

        -- Update existing entries to use their school_id as campus_id
        UPDATE timetable_entries
        SET campus_id = school_id
        WHERE campus_id IS NULL;

        -- Make campus_id NOT NULL
        ALTER TABLE timetable_entries 
        ALTER COLUMN campus_id SET NOT NULL;

        -- Update constraints to be campus-specific
        ALTER TABLE timetable_entries
        DROP CONSTRAINT IF EXISTS unique_section_period;

        ALTER TABLE timetable_entries
        DROP CONSTRAINT IF EXISTS unique_teacher_period;
        
        -- Drop and recreate campus constraints to ensure idempotency
        ALTER TABLE timetable_entries
        DROP CONSTRAINT IF EXISTS unique_section_period_campus;
        
        ALTER TABLE timetable_entries
        DROP CONSTRAINT IF EXISTS unique_teacher_period_campus;

        ALTER TABLE timetable_entries
        ADD CONSTRAINT unique_section_period_campus UNIQUE(campus_id, section_id, day_of_week, period_id, academic_year_id);

        ALTER TABLE timetable_entries
        ADD CONSTRAINT unique_teacher_period_campus UNIQUE(campus_id, teacher_id, day_of_week, period_id, academic_year_id);

        -- Add index for campus_id
        CREATE INDEX IF NOT EXISTS idx_timetable_campus ON timetable_entries(campus_id);
    END IF;
END $$;

-- Step 6: Add campus_id to periods table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'periods') THEN
        -- Add campus_id column
        ALTER TABLE periods 
        ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES schools(id) ON DELETE CASCADE;

        -- Update existing periods to use their school_id as campus_id
        UPDATE periods
        SET campus_id = school_id
        WHERE campus_id IS NULL;

        
        -- Drop and recreate campus constraint to ensure idempotency
        ALTER TABLE periods
        DROP CONSTRAINT IF EXISTS unique_period_per_campus;
        -- Make campus_id NOT NULL
        ALTER TABLE periods 
        ALTER COLUMN campus_id SET NOT NULL;

        -- Update unique constraint
        ALTER TABLE periods
        DROP CONSTRAINT IF EXISTS unique_period_per_school;

        ALTER TABLE periods
        ADD CONSTRAINT unique_period_per_campus UNIQUE(campus_id, period_number);

        -- Add index for campus_id
        CREATE INDEX IF NOT EXISTS idx_periods_campus ON periods(campus_id, is_active);
    END IF;
END $$;

-- Step 7: Update RLS Policies for strict campus-specific access

-- Grade Levels RLS
DROP POLICY IF EXISTS grade_levels_policy ON grade_levels;
DROP POLICY IF EXISTS grade_levels_campus_policy ON grade_levels;

CREATE POLICY grade_levels_campus_policy ON grade_levels
FOR ALL
USING (
    campus_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

-- Sections RLS
DROP POLICY IF EXISTS sections_policy ON sections;
DROP POLICY IF EXISTS sections_campus_policy ON sections;

CREATE POLICY sections_campus_policy ON sections
FOR ALL
USING (
    campus_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

-- Subjects RLS
DROP POLICY IF EXISTS subjects_campus_policy ON subjects;
DROP POLICY IF EXISTS subjects_policy ON subjects;

CREATE POLICY subjects_campus_policy ON subjects
FOR ALL
USING (
    campus_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
);

-- Step 8: Update helper functions to be campus-aware

-- Drop existing functions first to avoid signature conflicts
DROP FUNCTION IF EXISTS get_grade_with_stats();
DROP FUNCTION IF EXISTS get_grade_with_stats(UUID);
DROP FUNCTION IF EXISTS get_grade_with_stats(UUID, UUID);
DROP FUNCTION IF EXISTS get_sections_by_grade(UUID);
DROP FUNCTION IF EXISTS get_sections_by_grade(UUID, UUID);
DROP FUNCTION IF EXISTS get_sections_by_grade(p_grade_level_id UUID);
DROP FUNCTION IF EXISTS get_sections_by_grade(p_grade_level_id UUID, p_school_id UUID);
DROP FUNCTION IF EXISTS get_sections_by_grade(p_grade_level_id UUID, p_campus_id UUID);
DROP FUNCTION IF EXISTS get_all_sections_with_campus();
DROP FUNCTION IF EXISTS get_all_sections_with_campus(UUID);
DROP FUNCTION IF EXISTS get_all_sections_with_campus(UUID, UUID);
DROP FUNCTION IF EXISTS get_subjects_by_campus(UUID);
DROP FUNCTION IF EXISTS get_subjects_by_campus(UUID, UUID);

-- Update get_grade_with_stats function
CREATE OR REPLACE FUNCTION get_grade_with_stats(p_campus_id UUID DEFAULT NULL, p_school_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    campus_id UUID,
    school_id UUID,
    name VARCHAR,
    order_index INTEGER,
    base_fee DECIMAL,
    is_active BOOLEAN,
    sections_count BIGINT,
    subjects_count BIGINT,
    students_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id AS id,
        g.campus_id AS campus_id,
        g.school_id AS school_id,
        g.name::VARCHAR AS name,
        g.order_index AS order_index,
        g.base_fee AS base_fee,
        g.is_active AS is_active,
        COUNT(DISTINCT sec.id) AS sections_count,
        COUNT(DISTINCT sub.id) AS subjects_count,
        COALESCE(SUM(sec.current_strength), 0) AS students_count
    FROM grade_levels g
    LEFT JOIN sections sec ON sec.grade_level_id = g.id AND sec.is_active = true
    LEFT JOIN subjects sub ON sub.grade_level_id = g.id AND sub.is_active = true
    WHERE 
        (p_campus_id IS NULL OR g.campus_id = p_campus_id) AND
        (p_school_id IS NULL OR g.school_id = p_school_id) AND
        g.is_active = true
    GROUP BY g.id, g.campus_id, g.school_id, g.name, g.order_index, g.base_fee, g.is_active
    ORDER BY g.order_index;
END;
$$ LANGUAGE plpgsql;

-- Update get_sections_by_grade function
CREATE OR REPLACE FUNCTION get_sections_by_grade(p_grade_level_id UUID, p_campus_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    campus_id UUID,
    school_id UUID,
    grade_level_id UUID,
    grade_name VARCHAR,
    section_name VARCHAR,
    capacity INTEGER,
    current_strength INTEGER,
    available_seats INTEGER,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id AS id,
        s.campus_id AS campus_id,
        s.school_id AS school_id,
        s.grade_level_id AS grade_level_id,
        g.name::VARCHAR AS grade_name,
        s.name::VARCHAR AS section_name,
        s.capacity AS capacity,
        s.current_strength AS current_strength,
        (s.capacity - s.current_strength)::INTEGER AS available_seats,
        s.is_active AS is_active
    FROM sections s
    JOIN grade_levels g ON g.id = s.grade_level_id
    WHERE 
        s.grade_level_id = p_grade_level_id AND
        (p_campus_id IS NULL OR s.campus_id = p_campus_id) AND
        s.is_active = true
    ORDER BY s.name;
END;
$$ LANGUAGE plpgsql;

-- Create new function to get all sections with campus info
CREATE OR REPLACE FUNCTION get_all_sections_with_campus(p_campus_id UUID DEFAULT NULL, p_school_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    campus_id UUID,
    campus_name VARCHAR,
    school_id UUID,
    grade_level_id UUID,
    grade VARCHAR,
    section VARCHAR,
    capacity INTEGER,
    current_strength INTEGER,
    available_seats INTEGER,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id AS id,
        s.campus_id AS campus_id,
        c.name::VARCHAR AS campus_name,
        s.school_id AS school_id,
        s.grade_level_id AS grade_level_id,
        g.name::VARCHAR AS grade,
        s.name::VARCHAR AS section,
        s.capacity AS capacity,
        s.current_strength AS current_strength,
        (s.capacity - s.current_strength)::INTEGER AS available_seats,
        s.is_active AS is_active
    FROM sections s
    JOIN grade_levels g ON g.id = s.grade_level_id
    JOIN schools c ON c.id = s.campus_id
    WHERE 
        (p_campus_id IS NULL OR s.campus_id = p_campus_id) AND
        (p_school_id IS NULL OR s.school_id = p_school_id) AND
        s.is_active = true
    ORDER BY c.name, g.order_index, s.name;
END;
$$ LANGUAGE plpgsql;

-- Create function to get subjects by campus
CREATE OR REPLACE FUNCTION get_subjects_by_campus(p_campus_id UUID, p_grade_level_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    campus_id UUID,
    school_id UUID,
    grade_level_id UUID,
    grade_name VARCHAR,
    subject_name VARCHAR,
    code VARCHAR,
    subject_type VARCHAR,
    is_active BOOLEAN,
    assigned_teachers_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sub.id AS id,
        sub.campus_id AS campus_id,
        sub.school_id AS school_id,
        sub.grade_level_id AS grade_level_id,
        g.name::VARCHAR AS grade_name,
        sub.name::VARCHAR AS subject_name,
        sub.code::VARCHAR AS code,
        sub.subject_type::VARCHAR AS subject_type,
        sub.is_active AS is_active,
        COALESCE(COUNT(DISTINCT tsa.teacher_id), 0) AS assigned_teachers_count
    FROM subjects sub
    JOIN grade_levels g ON g.id = sub.grade_level_id
    LEFT JOIN teacher_subject_assignments tsa ON tsa.subject_id = sub.id
    WHERE 
        sub.campus_id = p_campus_id AND
        (p_grade_level_id IS NULL OR sub.grade_level_id = p_grade_level_id) AND
        sub.is_active = true
    GROUP BY sub.id, sub.campus_id, sub.school_id, sub.grade_level_id, g.name, g.order_index, sub.name, sub.code, sub.subject_type, sub.is_active
    ORDER BY g.order_index, sub.name;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create view for easy campus-aware queries
CREATE OR REPLACE VIEW v_academics_campus_overview AS
SELECT 
    c.id as campus_id,
    c.name as campus_name,
    c.parent_school_id as school_id,
    COUNT(DISTINCT g.id) as grade_levels_count,
    COUNT(DISTINCT s.id) as sections_count,
    COUNT(DISTINCT sub.id) as subjects_count,
    COALESCE(SUM(s.current_strength), 0) as total_students,
    COALESCE(SUM(s.capacity), 0) as total_capacity
FROM schools c
LEFT JOIN grade_levels g ON g.campus_id = c.id AND g.is_active = true
LEFT JOIN sections s ON s.campus_id = c.id AND s.is_active = true
LEFT JOIN subjects sub ON sub.campus_id = c.id AND sub.is_active = true
WHERE c.parent_school_id IS NOT NULL  -- Only campuses
GROUP BY c.id, c.name, c.parent_school_id;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE 'All academic tables are now campus-specific:';
    RAISE NOTICE '  - grade_levels';
    RAISE NOTICE '  - sections';
    RAISE NOTICE '  - subjects';
    RAISE NOTICE '  - teacher_subject_assignments';
    RAISE NOTICE '  - timetable_entries';
    RAISE NOTICE '  - periods';
    RAISE NOTICE '';
    RAISE NOTICE 'New helper functions created:';
    RAISE NOTICE '  - get_all_sections_with_campus()';
    RAISE NOTICE '  - get_subjects_by_campus()';
    RAISE NOTICE '  - v_academics_campus_overview (view)';
END $$;
