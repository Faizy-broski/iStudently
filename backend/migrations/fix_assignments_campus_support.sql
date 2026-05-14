-- ============================================================================
-- FIX: Add campus_id support to assignments for multi-campus school structure
-- This migration adds campus_id column and updates RLS policies to support
-- campus users viewing/managing assignments across the school hierarchy
-- ============================================================================

-- Step 1: Add campus_id column to assignments table
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES schools(id);

-- Step 2: Add index for campus_id
CREATE INDEX IF NOT EXISTS idx_assignments_campus ON assignments(campus_id);

-- Step 3: Update existing RLS policies for campus hierarchy support

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view assignments from their school" ON assignments;
DROP POLICY IF EXISTS "Teachers can create assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers can update their own assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers can delete their own assignments" ON assignments;

-- Create new policies with campus hierarchy support

-- SELECT: Users can view assignments from their school OR parent school
CREATE POLICY "Campus users can view assignments from their school hierarchy"
    ON assignments FOR SELECT
    USING (
        school_id IN (
            SELECT p.school_id FROM profiles p WHERE p.id = auth.uid()
            UNION
            SELECT s.parent_school_id FROM schools s 
            JOIN profiles p ON p.school_id = s.id 
            WHERE p.id = auth.uid() AND s.parent_school_id IS NOT NULL
            UNION
            SELECT child.id FROM schools child
            JOIN profiles p ON p.school_id = child.parent_school_id
            WHERE p.id = auth.uid()
        )
        OR
        campus_id IN (
            SELECT p.school_id FROM profiles p WHERE p.id = auth.uid()
        )
    );

-- INSERT: Teachers can create assignments for their school/campus
CREATE POLICY "Teachers can create assignments for their campus"
    ON assignments FOR INSERT
    WITH CHECK (
        teacher_id IN (
            SELECT staff.id FROM staff
            WHERE staff.profile_id = auth.uid()
        )
        AND (
            -- User's school_id matches assignment school_id
            school_id IN (
                SELECT profiles.school_id FROM profiles 
                WHERE profiles.id = auth.uid()
            )
            OR
            -- User's campus matches parent of assignment school_id
            school_id IN (
                SELECT s.parent_school_id FROM schools s 
                JOIN profiles p ON p.school_id = s.id 
                WHERE p.id = auth.uid()
            )
            OR
            -- User is at main school and can create for campus
            campus_id IN (
                SELECT child.id FROM schools child
                JOIN profiles p ON p.school_id = child.parent_school_id
                WHERE p.id = auth.uid()
            )
        )
    );

-- UPDATE: Teachers can update their own assignments
CREATE POLICY "Teachers can update their own assignments"
    ON assignments FOR UPDATE
    USING (
        teacher_id IN (
            SELECT staff.id FROM staff
            WHERE staff.profile_id = auth.uid()
        )
    );

-- DELETE: Teachers can delete their own assignments
CREATE POLICY "Teachers can delete their own assignments"
    ON assignments FOR DELETE
    USING (
        teacher_id IN (
            SELECT staff.id FROM staff
            WHERE staff.profile_id = auth.uid()
        )
    );

-- Step 4: Update assignment_submissions RLS policies

DROP POLICY IF EXISTS "Users can view submissions from their school" ON assignment_submissions;
DROP POLICY IF EXISTS "Students can create their submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Students can update their own submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Teachers can update submissions for grading" ON assignment_submissions;

-- SELECT: Users can view submissions from their school hierarchy
CREATE POLICY "Campus users can view submissions from their school hierarchy"
    ON assignment_submissions FOR SELECT
    USING (
        school_id IN (
            SELECT p.school_id FROM profiles p WHERE p.id = auth.uid()
            UNION
            SELECT s.parent_school_id FROM schools s 
            JOIN profiles p ON p.school_id = s.id 
            WHERE p.id = auth.uid() AND s.parent_school_id IS NOT NULL
            UNION
            SELECT child.id FROM schools child
            JOIN profiles p ON p.school_id = child.parent_school_id
            WHERE p.id = auth.uid()
        )
    );

-- INSERT: Students can create their submissions  
CREATE POLICY "Students can create their submissions"
    ON assignment_submissions FOR INSERT
    WITH CHECK (
        student_id IN (
            SELECT students.id FROM students
            WHERE students.profile_id = auth.uid()
        )
    );

-- UPDATE: Students can update their own pending submissions
CREATE POLICY "Students can update their own pending submissions"
    ON assignment_submissions FOR UPDATE
    USING (
        student_id IN (
            SELECT students.id FROM students
            WHERE students.profile_id = auth.uid()
        )
        AND status IN ('pending', 'submitted')  -- Can only update if not graded
    );

-- UPDATE: Teachers can grade submissions for their assignments
CREATE POLICY "Teachers can grade submissions for their assignments"
    ON assignment_submissions FOR UPDATE
    USING (
        assignment_id IN (
            SELECT a.id FROM assignments a
            WHERE a.teacher_id IN (
                SELECT s.id FROM staff s
                WHERE s.profile_id = auth.uid()
            )
        )
    );

-- Step 5: Also update teacher_subject_assignments RLS policies
ALTER TABLE teacher_subject_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view teacher assignments from their school" ON teacher_subject_assignments;
DROP POLICY IF EXISTS "teacher_subject_assignments_select_policy" ON teacher_subject_assignments;
DROP POLICY IF EXISTS "teacher_subject_assignments_insert_policy" ON teacher_subject_assignments;
DROP POLICY IF EXISTS "teacher_subject_assignments_update_policy" ON teacher_subject_assignments;
DROP POLICY IF EXISTS "teacher_subject_assignments_delete_policy" ON teacher_subject_assignments;

CREATE POLICY "Campus users can view teacher subject assignments"
    ON teacher_subject_assignments FOR SELECT
    USING (
        school_id IN (
            SELECT p.school_id FROM profiles p WHERE p.id = auth.uid()
            UNION
            SELECT s.parent_school_id FROM schools s 
            JOIN profiles p ON p.school_id = s.id 
            WHERE p.id = auth.uid() AND s.parent_school_id IS NOT NULL
            UNION
            SELECT child.id FROM schools child
            JOIN profiles p ON p.school_id = child.parent_school_id
            WHERE p.id = auth.uid()
        )
    );

-- Allow service role to manage (backend uses service role key)
CREATE POLICY "Service role can manage teacher subject assignments"
    ON teacher_subject_assignments FOR ALL
    USING (auth.role() = 'service_role');

-- Allow admins to manage  
CREATE POLICY "Admins can manage teacher subject assignments"
    ON teacher_subject_assignments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role IN ('super_admin', 'admin')
        )
    );

COMMENT ON COLUMN assignments.campus_id IS 'Campus ID for campus-specific assignments. If null, assignment is school-wide';
