-- =========================================
-- ACADEMICS MODULE: GRADE LEVELS, SECTIONS, SUBJECTS
-- Run this in Supabase SQL Editor
-- =========================================

-- Step 1: Create Grade Levels Table (The Parent Container)
CREATE TABLE IF NOT EXISTS grade_levels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    base_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    
    -- Ensure unique grade names per school
    CONSTRAINT unique_grade_per_school UNIQUE(school_id, name),
    -- Ensure unique order per school
    CONSTRAINT unique_order_per_school UNIQUE(school_id, order_index)
);

-- Step 2: Create Sections Table (Physical Classrooms)
CREATE TABLE IF NOT EXISTS sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    grade_level_id UUID NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 30,
    current_strength INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    
    -- Ensure unique section names per grade
    CONSTRAINT unique_section_per_grade UNIQUE(school_id, grade_level_id, name),
    -- Capacity validation
    CONSTRAINT valid_capacity CHECK (capacity > 0),
    CONSTRAINT valid_strength CHECK (current_strength >= 0 AND current_strength <= capacity)
);

-- Step 3: Create Subjects Table (Curriculum per Grade)
CREATE TABLE IF NOT EXISTS subjects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    grade_level_id UUID NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    subject_type VARCHAR(20) DEFAULT 'theory' CHECK (subject_type IN ('theory', 'lab', 'practical')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    
    -- Ensure unique subject codes per school
    CONSTRAINT unique_subject_code UNIQUE(school_id, code),
    -- Ensure unique subject names per grade
    CONSTRAINT unique_subject_per_grade UNIQUE(school_id, grade_level_id, name)
);

-- Step 4: Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_grade_levels_school ON grade_levels(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_grade_levels_order ON grade_levels(school_id, order_index);

CREATE INDEX IF NOT EXISTS idx_sections_school ON sections(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sections_grade ON sections(grade_level_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sections_capacity ON sections(school_id, is_active) WHERE current_strength < capacity;

CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_subjects_grade ON subjects(grade_level_id, is_active);

-- Step 5: Create Function to Update Section Strength
CREATE OR REPLACE FUNCTION update_section_strength()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE sections 
        SET current_strength = current_strength + 1,
            updated_at = NOW()
        WHERE id = NEW.section_id;
        
        -- Check capacity constraint
        IF (SELECT current_strength > capacity FROM sections WHERE id = NEW.section_id) THEN
            RAISE EXCEPTION 'Section capacity exceeded';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE sections 
        SET current_strength = GREATEST(0, current_strength - 1),
            updated_at = NOW()
        WHERE id = OLD.section_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.section_id IS DISTINCT FROM NEW.section_id THEN
        -- Student moved to different section
        UPDATE sections 
        SET current_strength = GREATEST(0, current_strength - 1),
            updated_at = NOW()
        WHERE id = OLD.section_id;
        
        UPDATE sections 
        SET current_strength = current_strength + 1,
            updated_at = NOW()
        WHERE id = NEW.section_id;
        
        -- Check new section capacity
        IF (SELECT current_strength > capacity FROM sections WHERE id = NEW.section_id) THEN
            RAISE EXCEPTION 'Target section capacity exceeded';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Trigger will be created after students table is updated with section_id

-- Step 6: Create Updated Timestamp Triggers
CREATE OR REPLACE FUNCTION update_academics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_grade_levels_timestamp
    BEFORE UPDATE ON grade_levels
    FOR EACH ROW
    EXECUTE FUNCTION update_academics_timestamp();

CREATE TRIGGER update_sections_timestamp
    BEFORE UPDATE ON sections
    FOR EACH ROW
    EXECUTE FUNCTION update_academics_timestamp();

CREATE TRIGGER update_subjects_timestamp
    BEFORE UPDATE ON subjects
    FOR EACH ROW
    EXECUTE FUNCTION update_academics_timestamp();

-- Step 7: Create Helper Functions for Academics

-- Get grade with section and subject counts
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
        0::BIGINT AS students_count, -- Will be updated after student schema changes
        gl.created_at
    FROM grade_levels gl
    LEFT JOIN sections s ON gl.id = s.grade_level_id AND s.is_active = true
    LEFT JOIN subjects subj ON gl.id = subj.grade_level_id AND subj.is_active = true
    WHERE gl.school_id = p_school_id
    GROUP BY gl.id, gl.name, gl.order_index, gl.base_fee, gl.is_active, gl.created_at
    ORDER BY gl.order_index;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get sections with current strength
CREATE OR REPLACE FUNCTION get_sections_by_grade(
    p_school_id UUID,
    p_grade_level_id UUID
)
RETURNS TABLE (
    id UUID,
    grade_level_id UUID,
    name VARCHAR(100),
    capacity INTEGER,
    current_strength INTEGER,
    available_seats INTEGER,
    is_active BOOLEAN,
    grade_name VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.grade_level_id,
        s.name,
        s.capacity,
        s.current_strength,
        (s.capacity - s.current_strength) AS available_seats,
        s.is_active,
        gl.name AS grade_name
    FROM sections s
    INNER JOIN grade_levels gl ON s.grade_level_id = gl.id
    WHERE s.school_id = p_school_id
        AND (p_grade_level_id IS NULL OR s.grade_level_id = p_grade_level_id)
        AND s.is_active = true
    ORDER BY gl.order_index, s.name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get subjects by grade
CREATE OR REPLACE FUNCTION get_subjects_by_grade(
    p_school_id UUID,
    p_grade_level_id UUID
)
RETURNS TABLE (
    id UUID,
    grade_level_id UUID,
    name VARCHAR(100),
    code VARCHAR(50),
    subject_type VARCHAR(20),
    is_active BOOLEAN,
    grade_name VARCHAR(100),
    grade_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        subj.id,
        subj.grade_level_id,
        subj.name,
        subj.code,
        subj.subject_type,
        subj.is_active,
        gl.name AS grade_name,
        gl.order_index AS grade_order
    FROM subjects subj
    INNER JOIN grade_levels gl ON subj.grade_level_id = gl.id
    WHERE subj.school_id = p_school_id
        AND (p_grade_level_id IS NULL OR subj.grade_level_id = p_grade_level_id)
        AND subj.is_active = true
    ORDER BY gl.order_index, subj.name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 8: Set up RLS (Row Level Security)
ALTER TABLE grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- Admin and Super Admin can do everything
CREATE POLICY grade_levels_admin_all ON grade_levels
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
            AND (role = 'super_admin' OR school_id = grade_levels.school_id)
        )
    );

CREATE POLICY sections_admin_all ON sections
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
            AND (role = 'super_admin' OR school_id = sections.school_id)
        )
    );

CREATE POLICY subjects_admin_all ON subjects
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
            AND (role = 'super_admin' OR school_id = subjects.school_id)
        )
    );

-- Teachers can read subjects for their school
CREATE POLICY subjects_teacher_read ON subjects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'teacher'
            AND school_id = subjects.school_id
        )
    );

-- Teachers can read grades and sections
CREATE POLICY grade_levels_teacher_read ON grade_levels
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'teacher'
            AND school_id = grade_levels.school_id
        )
    );

CREATE POLICY sections_teacher_read ON sections
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'teacher'
            AND school_id = sections.school_id
        )
    );

-- Step 9: Add comments for documentation
COMMENT ON TABLE grade_levels IS 'Grade levels are the parent container for all academic organization';
COMMENT ON TABLE sections IS 'Sections are physical classroom divisions within a grade level';
COMMENT ON TABLE subjects IS 'Subjects define the curriculum specific to each grade level';

COMMENT ON COLUMN grade_levels.order_index IS 'Used for sorting: Grade 1=1, Grade 2=2, etc.';
COMMENT ON COLUMN grade_levels.base_fee IS 'Default monthly tuition fee for this grade level';
COMMENT ON COLUMN sections.capacity IS 'Maximum number of students allowed in this section';
COMMENT ON COLUMN sections.current_strength IS 'Current number of students enrolled (auto-updated)';
COMMENT ON COLUMN subjects.subject_type IS 'theory, lab, or practical';

-- Done! The academics foundation is ready.
