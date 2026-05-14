-- ============================================================================
-- EXAMS AND GRADING SYSTEM
-- Creates tables for managing exams and student exam results
-- ============================================================================

-- Exam Types (Midterm, Final, Quiz, Class Test, etc.)
CREATE TABLE IF NOT EXISTS exam_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    weightage DECIMAL(5,2) DEFAULT 0, -- Percentage weight in final grade
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(school_id, name)
);

-- Exams
CREATE TABLE IF NOT EXISTS exams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    exam_type_id UUID NOT NULL REFERENCES exam_types(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    -- Exam Details
    exam_name VARCHAR(200) NOT NULL,
    exam_date DATE,
    duration_minutes INTEGER,
    max_marks DECIMAL(6,2) NOT NULL DEFAULT 100,
    passing_marks DECIMAL(6,2) NOT NULL DEFAULT 40,
    
    -- Grading Settings
    grading_scale VARCHAR(50), -- 'percentage', 'gpa', 'letter'
    instructions TEXT,
    
    -- Status
    is_published BOOLEAN DEFAULT false,
    is_completed BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    
    CONSTRAINT valid_marks CHECK (max_marks > 0 AND passing_marks >= 0 AND passing_marks <= max_marks)
);

-- Exam Results (Student Marks)
CREATE TABLE IF NOT EXISTS exam_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    -- Marks
    marks_obtained DECIMAL(6,2),
    is_absent BOOLEAN DEFAULT false,
    
    -- Grades
    percentage DECIMAL(5,2),
    grade VARCHAR(10), -- A+, A, B+, etc. or GPA
    remarks TEXT,
    
    -- Metadata
    marked_at TIMESTAMP WITH TIME ZONE,
    marked_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- One result per student per exam
    UNIQUE(exam_id, student_id),
    
    CONSTRAINT valid_result_marks CHECK (
        is_absent = true OR 
        (marks_obtained IS NOT NULL AND marks_obtained >= 0)
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_types_school ON exam_types(school_id);
CREATE INDEX IF NOT EXISTS idx_exams_school ON exams(school_id);
CREATE INDEX IF NOT EXISTS idx_exams_teacher ON exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_exams_section ON exams(section_id);
CREATE INDEX IF NOT EXISTS idx_exams_subject ON exams(subject_id);
CREATE INDEX IF NOT EXISTS idx_exams_date ON exams(exam_date);
CREATE INDEX IF NOT EXISTS idx_exams_year ON exams(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam ON exam_results(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_school ON exam_results(school_id);

-- Enable RLS
ALTER TABLE exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exam_types
CREATE POLICY "Users can view exam types from their school"
    ON exam_types FOR SELECT
    USING (
        school_id IN (
            SELECT profiles.school_id FROM profiles 
            WHERE profiles.id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage exam types"
    ON exam_types FOR ALL
    USING (
        school_id IN (
            SELECT profiles.school_id FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- RLS Policies for exams
CREATE POLICY "Users can view exams from their school"
    ON exams FOR SELECT
    USING (
        school_id IN (
            SELECT profiles.school_id FROM profiles 
            WHERE profiles.id = auth.uid()
        )
    );

CREATE POLICY "Teachers can create exams"
    ON exams FOR INSERT
    WITH CHECK (
        teacher_id IN (
            SELECT staff.id FROM staff
            WHERE staff.profile_id = auth.uid()
        )
        AND school_id IN (
            SELECT profiles.school_id FROM profiles 
            WHERE profiles.id = auth.uid()
        )
    );

CREATE POLICY "Teachers can update their own exams"
    ON exams FOR UPDATE
    USING (
        teacher_id IN (
            SELECT staff.id FROM staff
            WHERE staff.profile_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can delete their own exams"
    ON exams FOR DELETE
    USING (
        teacher_id IN (
            SELECT staff.id FROM staff
            WHERE staff.profile_id = auth.uid()
        )
    );

-- RLS Policies for exam_results
CREATE POLICY "Users can view results from their school"
    ON exam_results FOR SELECT
    USING (
        school_id IN (
            SELECT profiles.school_id FROM profiles 
            WHERE profiles.id = auth.uid()
        )
    );

CREATE POLICY "Teachers can insert results"
    ON exam_results FOR INSERT
    WITH CHECK (
        exam_id IN (
            SELECT exams.id FROM exams
            JOIN staff ON exams.teacher_id = staff.id
            WHERE staff.profile_id = auth.uid()
        )
        AND school_id IN (
            SELECT profiles.school_id FROM profiles 
            WHERE profiles.id = auth.uid()
        )
    );

CREATE POLICY "Teachers can update results"
    ON exam_results FOR UPDATE
    USING (
        exam_id IN (
            SELECT exams.id FROM exams
            JOIN staff ON exams.teacher_id = staff.id
            WHERE staff.profile_id = auth.uid()
        )
    );

-- Insert default exam types
INSERT INTO exam_types (school_id, name, description, weightage)
SELECT 
    id as school_id,
    name,
    description,
    weightage
FROM schools, (VALUES
    ('Midterm Exam', 'Mid-semester examination', 30.00),
    ('Final Exam', 'End-of-semester examination', 50.00),
    ('Quiz', 'Short assessment quiz', 10.00),
    ('Class Test', 'In-class test', 10.00),
    ('Assignment', 'Take-home assignment', 0.00),
    ('Practical', 'Practical/Lab examination', 0.00)
) AS exam_type_data(name, description, weightage)
ON CONFLICT (school_id, name) DO NOTHING;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
DROP TRIGGER IF EXISTS update_exam_types_updated_at ON exam_types;
CREATE TRIGGER update_exam_types_updated_at
    BEFORE UPDATE ON exam_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_exams_updated_at ON exams;
CREATE TRIGGER update_exams_updated_at
    BEFORE UPDATE ON exams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_exam_results_updated_at ON exam_results;
CREATE TRIGGER update_exam_results_updated_at
    BEFORE UPDATE ON exam_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE exam_types IS 'Types of exams (Midterm, Final, Quiz, etc.) with weightage';
COMMENT ON TABLE exams IS 'Exam schedules for sections and subjects';
COMMENT ON TABLE exam_results IS 'Student marks and grades for exams';
