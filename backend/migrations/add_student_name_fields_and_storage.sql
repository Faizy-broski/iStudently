-- Migration: Add Student Name Fields and Storage Policies
-- Date: 2024-01-17
-- Description: Adds father_name, grandfather_name to profiles table and sets up storage policies for student photos

-- ============================================================================
-- STEP 1: ADD NEW COLUMNS TO PROFILES TABLE
-- ============================================================================

-- Add father_name column (stores father's name for students)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS father_name TEXT;

-- Add grandfather_name column (stores grandfather's name for students)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS grandfather_name TEXT;

-- Add profile_photo_url column if not exists (for Supabase storage URLs)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Comment on new columns
COMMENT ON COLUMN profiles.father_name IS 'Father''s name for student profiles';
COMMENT ON COLUMN profiles.grandfather_name IS 'Grandfather''s name for student profiles';
COMMENT ON COLUMN profiles.profile_photo_url IS 'URL to profile photo stored in Supabase storage';

-- ============================================================================
-- STEP 2: CREATE INDEX FOR NAME SEARCHES
-- ============================================================================

-- Index for faster name-based searches (includes father_name now)
CREATE INDEX IF NOT EXISTS idx_profiles_names_search 
ON profiles USING gin(
  to_tsvector('english', 
    COALESCE(first_name, '') || ' ' || 
    COALESCE(last_name, '') || ' ' || 
    COALESCE(father_name, '') || ' ' ||
    COALESCE(grandfather_name, '')
  )
);

-- ============================================================================
-- STEP 3: SUPABASE STORAGE BUCKET POLICIES
-- Run these in the Supabase SQL Editor to set up policies for the 
-- 'students-profile-pictures' bucket
-- ============================================================================

-- NOTE: The bucket 'students-profile-pictures' must be created manually in 
-- Supabase Dashboard > Storage > New bucket with these settings:
-- - Name: students-profile-pictures
-- - Public: false (private bucket)
-- - File size limit: 1048576 (1MB)
-- - Allowed MIME types: image/svg+xml, image/png, image/jpeg, image/webp

-- Policy 1: Allow authenticated users to upload their own photos or school admins to upload for students
CREATE POLICY "School users can upload student photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'students-profile-pictures'
  AND (
    -- Allow if uploading to their school's folder
    (storage.foldername(name))[1] IN (
      SELECT school_id::text FROM profiles WHERE id = auth.uid()
    )
    -- Or user is admin/teacher
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'teacher')
    )
  )
);

-- Policy 2: Allow authenticated users to view photos from their school
CREATE POLICY "School users can view student photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'students-profile-pictures'
  AND (
    -- Can view photos from their school
    (storage.foldername(name))[1] IN (
      SELECT school_id::text FROM profiles WHERE id = auth.uid()
    )
    -- Or is the photo owner
    OR owner = auth.uid()
  )
);

-- Policy 3: Allow school admins to update/delete photos
CREATE POLICY "School admins can update student photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'students-profile-pictures'
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
    AND school_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "School admins can delete student photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'students-profile-pictures'
  AND (
    -- Photo owner can delete
    owner = auth.uid()
    -- Or school admin can delete
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND school_id::text = (storage.foldername(name))[1]
    )
  )
);

-- ============================================================================
-- STEP 4: UPDATE SEARCH FUNCTION TO INCLUDE FATHER NAME
-- ============================================================================

-- First drop the existing function (required because return type is changing)
DROP FUNCTION IF EXISTS search_students_for_library(UUID, TEXT, INTEGER);

-- Update the search_students_for_library function to include father_name in search
CREATE OR REPLACE FUNCTION search_students_for_library(
  p_school_id UUID,
  p_search TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  student_id UUID,
  profile_id UUID,
  student_number TEXT,
  first_name TEXT,
  last_name TEXT,
  father_name TEXT,
  grandfather_name TEXT,
  email TEXT,
  is_active BOOLEAN,
  grade_level TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as student_id,
    s.profile_id,
    s.student_number,
    p.first_name,
    p.last_name,
    p.father_name,
    p.grandfather_name,
    p.email,
    p.is_active,
    s.grade_level
  FROM students s
  JOIN profiles p ON s.profile_id = p.id
  WHERE s.school_id = p_school_id
    AND (
      p.first_name ILIKE '%' || p_search || '%'
      OR p.last_name ILIKE '%' || p_search || '%'
      OR p.father_name ILIKE '%' || p_search || '%'
      OR p.grandfather_name ILIKE '%' || p_search || '%'
      OR p.email ILIKE '%' || p_search || '%'
      OR s.student_number ILIKE '%' || p_search || '%'
    )
  ORDER BY p.first_name, p.last_name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
