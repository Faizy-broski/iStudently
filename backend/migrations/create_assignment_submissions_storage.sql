-- Note: This uses the existing 'Assignments_uploads' bucket
-- Optimized path structure (no redundant folders):
--   Teacher files: {school_id}/{campus_id}/{academic_year}/{assignmentId}/{teacherId}/file.pdf
--   Student files: {school_id}/{campus_id}/{academic_year}/{assignmentId}/submissions/{studentId}/file.pdf
-- Benefits: Multi-tenant isolation + academic year organization + no wasted path space

-- Index Map:
-- [1] = school_id
-- [2] = campus_id
-- [3] = academic_year_id
-- [4] = assignmentId
-- [5] = 'submissions' (static string) OR teacherId
-- [6] = studentId (only for submissions)

-- ============================================================================
-- DROP EXISTING POLICIES (if any)
-- ============================================================================
DROP POLICY IF EXISTS "Students can upload assignment submission files" ON storage.objects;
DROP POLICY IF EXISTS "Students can read their own submission files" ON storage.objects;
DROP POLICY IF EXISTS "Students can delete their submission files" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload assignment instructions" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can read their assignment instructions" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can delete their assignment instructions" ON storage.objects;
DROP POLICY IF EXISTS "Students can read teacher assignment instructions" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can read student submission files" ON storage.objects;

-- ============================================================================
-- STUDENT POLICIES (Assignment Submissions)
-- ============================================================================

-- Allow students to upload their assignment submission files
-- Optimized: Direct path comparison instead of database join
CREATE POLICY "Students can upload assignment submission files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'Assignments_uploads' 
  AND (storage.foldername(name))[5] = 'submissions'  -- Must be in submissions folder
  AND (storage.foldername(name))[6] = auth.uid()::text  -- Student ID matches logged-in user
  -- Security: Verify user belongs to the school in the path
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND school_id::text = (storage.foldername(name))[1]
  )
);

-- Allow students to read their own assignment submission files
CREATE POLICY "Students can read their own submission files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'Assignments_uploads'
  AND (storage.foldername(name))[5] = 'submissions'
  AND (storage.foldername(name))[6] = auth.uid()::text  -- Direct path match
);

-- Allow students to delete their own submission files (before final grading)
CREATE POLICY "Students can delete their submission files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'Assignments_uploads'
  AND (storage.foldername(name))[5] = 'submissions'
  AND (storage.foldername(name))[6] = auth.uid()::text  -- Direct path match
);

-- ============================================================================
-- TEACHER POLICIES (Assignment Creation & Grading)
-- ============================================================================

-- Allow teachers to upload assignment instruction files
CREATE POLICY "Teachers can upload assignment instructions"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'Assignments_uploads'
  AND (storage.foldername(name))[5] != 'submissions'  -- NOT in submissions folder
  AND EXISTS (
    SELECT 1
    FROM staff s
    JOIN assignments a ON a.teacher_id = s.id
    WHERE s.profile_id = auth.uid()  -- Logged-in user is staff
      AND a.id::text = (storage.foldername(name))[4]  -- Match assignment ID
      AND a.school_id::text = (storage.foldername(name))[1]  -- Security: Match school
  )
);

-- Allow teachers to read their own assignment instruction files
CREATE POLICY "Teachers can read their assignment instructions"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'Assignments_uploads'
  AND (storage.foldername(name))[5] != 'submissions'  -- NOT in submissions folder
  AND EXISTS (
    SELECT 1
    FROM staff s
    JOIN assignments a ON a.teacher_id = s.id
    WHERE s.profile_id = auth.uid()
      AND a.id::text = (storage.foldername(name))[4]
      AND a.school_id::text = (storage.foldername(name))[1]
  )
);

-- Allow teachers to delete their own assignment instruction files
CREATE POLICY "Teachers can delete their assignment instructions"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'Assignments_uploads'
  AND (storage.foldername(name))[5] != 'submissions'
  AND EXISTS (
    SELECT 1
    FROM staff s
    JOIN assignments a ON a.teacher_id = s.id
    WHERE s.profile_id = auth.uid()
      AND a.id::text = (storage.foldername(name))[4]
      AND a.school_id::text = (storage.foldername(name))[1]
  )
);

-- ============================================================================
-- CROSS-ACCESS POLICIES
-- ============================================================================

-- Allow students to read teacher's assignment instruction files (download attachments)
-- Restricted: Only students enrolled in the assignment's section can access
CREATE POLICY "Students can read teacher assignment instructions"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'Assignments_uploads'
  AND (storage.foldername(name))[5] != 'submissions'  -- Teacher files only
  AND EXISTS (
    SELECT 1
    FROM students s
    JOIN assignments a ON a.id::text = (storage.foldername(name))[4]
    JOIN profiles p ON p.id = s.profile_id
    WHERE p.id = auth.uid()
      AND s.school_id::text = (storage.foldername(name))[1]
      AND s.section_id = a.section_id  -- Security: Only students in this section
      AND s.school_id = a.school_id
  )
);

-- Allow teachers to read student submission files (for grading)
CREATE POLICY "Teachers can read student submission files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'Assignments_uploads'
  AND (storage.foldername(name))[5] = 'submissions'  -- Student submissions only
  AND EXISTS (
    SELECT 1
    FROM staff s
    JOIN assignments a ON a.teacher_id = s.id
    WHERE s.profile_id = auth.uid()  -- Logged-in user is the teacher
      AND a.id::text = (storage.foldername(name))[4]  -- Match assignment ID
      AND a.school_id::text = (storage.foldername(name))[1]  -- Security: Match school
  )
);
