-- =========================================
-- ADD TEACHER ASSIGNMENT FIELDS TO STAFF TABLE
-- Run this in Supabase SQL Editor
-- =========================================

-- Add grade_level_id and section_id to staff table for class teacher assignments
DO $$ 
BEGIN
    -- Add grade_level_id column for class teacher assignment
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='staff' AND column_name='grade_level_id') THEN
        ALTER TABLE staff ADD COLUMN grade_level_id UUID REFERENCES grade_levels(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_staff_grade_level ON staff(grade_level_id);
    END IF;

    -- Add section_id column for class teacher assignment
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='staff' AND column_name='section_id') THEN
        ALTER TABLE staff ADD COLUMN section_id UUID REFERENCES sections(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_staff_section ON staff(section_id);
    END IF;

    -- Add role column to staff table (teacher, admin, librarian, etc.)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='staff' AND column_name='role') THEN
        ALTER TABLE staff ADD COLUMN role VARCHAR(50) DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin', 'librarian', 'counselor', 'staff'));
        CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN staff.grade_level_id IS 'Optional: Grade level this teacher is assigned as class teacher';
COMMENT ON COLUMN staff.section_id IS 'Optional: Specific section this teacher is assigned as class teacher';
COMMENT ON COLUMN staff.role IS 'Role of the staff member in the school';

-- Update existing staff to set role as teacher by default (based on profile role)
UPDATE staff s
SET role = 'teacher'
FROM profiles p
WHERE s.profile_id = p.id
  AND p.role = 'teacher'
  AND s.role IS NULL;

-- Update admins
UPDATE staff s
SET role = 'admin'
FROM profiles p
WHERE s.profile_id = p.id
  AND p.role = 'admin'
  AND s.role IS NULL;
