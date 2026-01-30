-- =========================================
-- TEACHERS & WORKLOAD MANAGEMENT SYSTEM
-- Run this in Supabase SQL Editor
-- =========================================

-- Step 1: Create Staff/Teachers Table (if not exists)
CREATE TABLE IF NOT EXISTS staff (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(100),
    department VARCHAR(100),
    qualifications TEXT,
    specialization VARCHAR(200),
    date_of_joining DATE,
    employment_type VARCHAR(20) DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract')),
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    
    CONSTRAINT unique_profile_per_school UNIQUE(profile_id, school_id)
);

-- Step 2: Create Academic Years Table (for tracking sessions)
CREATE TABLE IF NOT EXISTS academic_years (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_year_per_school UNIQUE(school_id, name),
    CONSTRAINT valid_dates CHECK (end_date > start_date)
);

-- Create partial unique index to ensure only one current year per school
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_current_year_per_school 
    ON academic_years(school_id) 
    WHERE is_current = true;

-- Step 3: Create Periods Table (time slots for timetable)
CREATE TABLE IF NOT EXISTS periods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    period_number INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    period_name VARCHAR(50),
    is_break BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_period_per_school UNIQUE(school_id, period_number),
    CONSTRAINT valid_time CHECK (end_time > start_time)
);

-- Step 4: Create Teacher Subject Assignments (Step 1: Workload Allocation)
CREATE TABLE IF NOT EXISTS teacher_subject_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT true,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES profiles(id),
    
    -- Prevent duplicate assignments
    CONSTRAINT unique_teacher_subject_section UNIQUE(teacher_id, subject_id, section_id, academic_year_id)
);

-- Create partial unique index to prevent multiple primary teachers for same subject-section
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_primary_teacher 
    ON teacher_subject_assignments(subject_id, section_id, academic_year_id) 
    WHERE is_primary = true;

-- Step 5: Create Timetable Entries (Step 2: Timetable Construction)
CREATE TABLE IF NOT EXISTS timetable_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Monday, 6=Sunday
    room_number VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    
    -- Prevent double booking of section at same time
    CONSTRAINT unique_section_period UNIQUE(section_id, day_of_week, period_id, academic_year_id),
    -- Prevent teacher being in two places at once
    CONSTRAINT unique_teacher_period UNIQUE(teacher_id, day_of_week, period_id, academic_year_id)
);

-- Step 6: Create Attendance Records (Step 3 & 4: Auto-generation & Teacher Verification)
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    timetable_entry_id UUID NOT NULL REFERENCES timetable_entries(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    marked_by UUID REFERENCES profiles(id),
    auto_generated BOOLEAN DEFAULT true,
    remarks TEXT,
    
    -- Prevent duplicate records
    CONSTRAINT unique_student_attendance UNIQUE(student_id, timetable_entry_id, attendance_date)
);

-- Step 7: Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_staff_school ON staff(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_staff_profile ON staff(profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_employee_number ON staff(employee_number);

CREATE INDEX IF NOT EXISTS idx_academic_years_school ON academic_years(school_id, is_current);
CREATE INDEX IF NOT EXISTS idx_academic_years_dates ON academic_years(school_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_periods_school ON periods(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_periods_number ON periods(school_id, period_number);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON teacher_subject_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_subject ON teacher_subject_assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_section ON teacher_subject_assignments(section_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_year ON teacher_subject_assignments(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_timetable_section ON timetable_entries(section_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON timetable_entries(teacher_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_day_period ON timetable_entries(day_of_week, period_id);
CREATE INDEX IF NOT EXISTS idx_timetable_year ON timetable_entries(academic_year_id, is_active);

CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_timetable ON attendance_records(timetable_entry_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(school_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(school_id, status, attendance_date);

-- Step 8: Create Function for Auto-Generating Daily Attendance (Step 3)
CREATE OR REPLACE FUNCTION generate_daily_attendance(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
    generated_count INTEGER,
    timetable_entries_processed INTEGER
) AS $$
DECLARE
    day_number INTEGER;
    entry_count INTEGER := 0;
    total_generated INTEGER := 0;
BEGIN
    -- Get day of week (0 = Monday in our system)
    day_number := EXTRACT(DOW FROM target_date) - 1;
    IF day_number = -1 THEN day_number := 6; END IF; -- Sunday handling
    
    -- Loop through all active timetable entries for this day
    FOR entry_count IN
        SELECT COUNT(*)
        FROM timetable_entries te
        INNER JOIN academic_years ay ON te.academic_year_id = ay.id
        WHERE te.day_of_week = day_number
        AND te.is_active = true
        AND ay.is_current = true
        AND target_date BETWEEN ay.start_date AND ay.end_date
    LOOP
        -- Insert attendance records for all active students in each section
        INSERT INTO attendance_records (
            school_id,
            student_id,
            timetable_entry_id,
            attendance_date,
            status,
            auto_generated
        )
        SELECT
            te.school_id,
            s.id,
            te.id,
            target_date,
            'present',
            true
        FROM timetable_entries te
        INNER JOIN academic_years ay ON te.academic_year_id = ay.id
        INNER JOIN students s ON s.section_id = te.section_id
        WHERE te.day_of_week = day_number
        AND te.is_active = true
        AND ay.is_current = true
        AND s.is_active = true
        AND target_date BETWEEN ay.start_date AND ay.end_date
        ON CONFLICT (student_id, timetable_entry_id, attendance_date) DO NOTHING;
        
        GET DIAGNOSTICS total_generated = ROW_COUNT;
    END LOOP;
    
    RETURN QUERY SELECT total_generated, entry_count;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create Function to Check Teacher Schedule Conflicts
CREATE OR REPLACE FUNCTION check_teacher_conflict(
    p_teacher_id UUID,
    p_day_of_week INTEGER,
    p_period_id UUID,
    p_academic_year_id UUID,
    p_exclude_entry_id UUID DEFAULT NULL
)
RETURNS TABLE(
    has_conflict BOOLEAN,
    conflict_details TEXT
) AS $$
DECLARE
    conflict_count INTEGER;
    conflict_info TEXT;
BEGIN
    SELECT COUNT(*), STRING_AGG(
        'Section: ' || sec.name || ' - Subject: ' || sub.name,
        ', '
    )
    INTO conflict_count, conflict_info
    FROM timetable_entries te
    INNER JOIN sections sec ON te.section_id = sec.id
    INNER JOIN subjects sub ON te.subject_id = sub.id
    WHERE te.teacher_id = p_teacher_id
    AND te.day_of_week = p_day_of_week
    AND te.period_id = p_period_id
    AND te.academic_year_id = p_academic_year_id
    AND te.is_active = true
    AND (p_exclude_entry_id IS NULL OR te.id != p_exclude_entry_id);
    
    RETURN QUERY SELECT 
        conflict_count > 0,
        COALESCE(conflict_info, 'No conflicts');
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create Function to Get Teacher's Daily Schedule
CREATE OR REPLACE FUNCTION get_teacher_schedule(
    p_teacher_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    period_number INTEGER,
    period_name VARCHAR,
    start_time TIME,
    end_time TIME,
    subject_name VARCHAR,
    section_name VARCHAR,
    grade_name VARCHAR,
    room_number VARCHAR,
    is_break BOOLEAN
) AS $$
DECLARE
    day_number INTEGER;
BEGIN
    -- Get day of week
    day_number := EXTRACT(DOW FROM p_date) - 1;
    IF day_number = -1 THEN day_number := 6; END IF;
    
    RETURN QUERY
    SELECT
        p.period_number,
        p.period_name,
        p.start_time,
        p.end_time,
        sub.name as subject_name,
        sec.name as section_name,
        gl.name as grade_name,
        te.room_number,
        p.is_break
    FROM periods p
    LEFT JOIN timetable_entries te ON p.id = te.period_id 
        AND te.teacher_id = p_teacher_id
        AND te.day_of_week = day_number
        AND te.is_active = true
    LEFT JOIN subjects sub ON te.subject_id = sub.id
    LEFT JOIN sections sec ON te.section_id = sec.id
    LEFT JOIN grade_levels gl ON sec.grade_level_id = gl.id
    WHERE p.school_id = (SELECT school_id FROM staff WHERE id = p_teacher_id)
    AND p.is_active = true
    ORDER BY p.period_number;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Enable Row Level Security (RLS)
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subject_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Step 12: Create RLS Policies

-- Staff Policies
CREATE POLICY "Users can view staff from their school"
    ON staff FOR SELECT
    USING (school_id IN (
        SELECT school_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can manage staff"
    ON staff FOR ALL
    USING (school_id IN (
        SELECT school_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    ));

-- Academic Years Policies
CREATE POLICY "Users can view academic years from their school"
    ON academic_years FOR SELECT
    USING (school_id IN (
        SELECT school_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can manage academic years"
    ON academic_years FOR ALL
    USING (school_id IN (
        SELECT school_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    ));

-- Periods Policies
CREATE POLICY "Users can view periods from their school"
    ON periods FOR SELECT
    USING (school_id IN (
        SELECT school_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can manage periods"
    ON periods FOR ALL
    USING (school_id IN (
        SELECT school_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    ));

-- Teacher Assignments Policies
CREATE POLICY "Users can view assignments from their school"
    ON teacher_subject_assignments FOR SELECT
    USING (school_id IN (
        SELECT school_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can manage teacher assignments"
    ON teacher_subject_assignments FOR ALL
    USING (school_id IN (
        SELECT school_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    ));

-- Timetable Policies
CREATE POLICY "Users can view timetable from their school"
    ON timetable_entries FOR SELECT
    USING (school_id IN (
        SELECT school_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can manage timetable"
    ON timetable_entries FOR ALL
    USING (school_id IN (
        SELECT school_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    ));

-- Attendance Policies
CREATE POLICY "Users can view attendance from their school"
    ON attendance_records FOR SELECT
    USING (school_id IN (
        SELECT school_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Teachers can mark attendance for their classes"
    ON attendance_records FOR UPDATE
    USING (
        school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
        AND timetable_entry_id IN (
            SELECT id FROM timetable_entries 
            WHERE teacher_id IN (
                SELECT id FROM staff WHERE profile_id = auth.uid()
            )
        )
    );

CREATE POLICY "Admins can manage all attendance"
    ON attendance_records FOR ALL
    USING (school_id IN (
        SELECT school_id FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    ));

-- Step 13: Create Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_academic_years_updated_at BEFORE UPDATE ON academic_years
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 14: Insert Sample Periods (8 periods per day)
-- Schools can customize this later
COMMENT ON TABLE periods IS 'Standard school periods - customizable per school';
COMMENT ON TABLE teacher_subject_assignments IS 'Step 1: Workload Allocation - Links Teacher ↔ Subject ↔ Section';
COMMENT ON TABLE timetable_entries IS 'Step 2: Timetable Construction - When teachers teach (Schedule)';
COMMENT ON TABLE attendance_records IS 'Step 3 & 4: Auto-attendance generation and teacher verification';

-- Success Message
DO $$
BEGIN
    RAISE NOTICE '✅ Teachers & Workload Management System Created Successfully!';
    RAISE NOTICE '📋 Next Steps:';
    RAISE NOTICE '1. Create academic year for your school';
    RAISE NOTICE '2. Define periods (time slots) for your school';
    RAISE NOTICE '3. Assign teachers to subjects and sections';
    RAISE NOTICE '4. Build the timetable';
    RAISE NOTICE '5. Run generate_daily_attendance() function daily (via cron)';
END $$;
