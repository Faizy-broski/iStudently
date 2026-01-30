-- ============================================================================
-- STUDENT ASSIGNMENTS SYSTEM
-- Allows teachers to create assignments for their sections
-- ============================================================================

-- Create assignments table
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    
    -- Assignment Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
        
    -- Dates
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    due_time TIME,
    
    -- Settings
    max_score DECIMAL(5,2) DEFAULT 100.00,
    is_graded BOOLEAN DEFAULT true,
    allow_late_submission BOOLEAN DEFAULT false,
    
    -- Attachments (stored as JSON array of file URLs/paths)
    attachments JSONB DEFAULT '[]'::jsonb,
    
    -- Status
    is_published BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    
    CONSTRAINT valid_due_date CHECK (due_date >= assigned_date),
    CONSTRAINT valid_max_score CHECK (max_score > 0)
);

-- Create assignment submissions table
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Submission Details
    submission_text TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    
    -- Submission Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'late', 'graded', 'returned')),
    submitted_at TIMESTAMP WITH TIME ZONE,
    
    -- Grading
    score DECIMAL(5,2),
    feedback TEXT,
    graded_at TIMESTAMP WITH TIME ZONE,
    graded_by UUID REFERENCES profiles(id),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one submission per student per assignment
    UNIQUE(assignment_id, student_id),
    
    CONSTRAINT valid_score CHECK (score IS NULL OR score >= 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assignments_school ON assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_section ON assignments(section_id);
CREATE INDEX IF NOT EXISTS idx_assignments_subject ON assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_year ON assignments(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_assignments_published ON assignments(is_published, is_archived);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON assignment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_school ON assignment_submissions(school_id);

-- Enable RLS
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assignments
-- Pattern: Use direct column references for the secured table, fully qualify in subqueries
CREATE POLICY "Users can view assignments from their school"
    ON assignments FOR SELECT
    USING (
        school_id IN (
            SELECT profiles.school_id FROM profiles 
            WHERE profiles.id = auth.uid()
        )
    );

CREATE POLICY "Teachers can create assignments"
    ON assignments FOR INSERT
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

CREATE POLICY "Teachers can update their own assignments"
    ON assignments FOR UPDATE
    USING (
        teacher_id IN (
            SELECT staff.id FROM staff
            WHERE staff.profile_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can delete their own assignments"
    ON assignments FOR DELETE
    USING (
        teacher_id IN (
            SELECT staff.id FROM staff
            WHERE staff.profile_id = auth.uid()
        )
    );

-- RLS Policies for submissions
CREATE POLICY "Users can view submissions from their school"
    ON assignment_submissions FOR SELECT
    USING (
        school_id IN (
            SELECT profiles.school_id FROM profiles 
            WHERE profiles.id = auth.uid()
        )
    );

CREATE POLICY "Students can create their submissions"
    ON assignment_submissions FOR INSERT
    WITH CHECK (
        student_id IN (
            SELECT students.id FROM students
            WHERE students.profile_id = auth.uid()
        )
        AND school_id IN (
            SELECT profiles.school_id FROM profiles 
            WHERE profiles.id = auth.uid()
        )
    );

CREATE POLICY "Students can update their own submissions"
    ON assignment_submissions FOR UPDATE
    USING (
        student_id IN (
            SELECT students.id FROM students
            WHERE students.profile_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can update submissions for grading"
    ON assignment_submissions FOR UPDATE
    USING (
        assignment_id IN (
            SELECT a.id FROM assignments a
            JOIN staff s ON s.id = a.teacher_id
            JOIN profiles p ON p.id = s.profile_id
            WHERE p.id = auth.uid()
        )
    );

-- Comments
COMMENT ON TABLE assignments IS 'Student assignments/homework created by teachers';
COMMENT ON TABLE assignment_submissions IS 'Student submissions for assignments';
COMMENT ON COLUMN assignments.attachments IS 'JSON array of attachment URLs/file paths';
COMMENT ON COLUMN assignment_submissions.status IS 'Submission status: pending, submitted, late, graded, returned';
