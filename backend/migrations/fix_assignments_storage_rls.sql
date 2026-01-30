-- Fix RLS policies for Assignments_uploads storage bucket
-- Run this in Supabase SQL Editor

-- First, ensure the bucket exists and is public for downloads
INSERT INTO storage.buckets (id, name, public)
VALUES ('Assignments_uploads', 'Assignments_uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own files" ON storage.objects;
DROP POLICY IF EXISTS "assignments_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "assignments_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "assignments_delete_policy" ON storage.objects;
DROP POLICY IF EXISTS "assignments_update_policy" ON storage.objects;

-- Policy: Allow authenticated users to upload files to Assignments_uploads bucket
CREATE POLICY "assignments_upload_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'Assignments_uploads');

-- Policy: Allow anyone to read files (for public access to assignment attachments)
CREATE POLICY "assignments_read_policy"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'Assignments_uploads');

-- Policy: Allow authenticated users to update their files
CREATE POLICY "assignments_update_policy"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'Assignments_uploads')
WITH CHECK (bucket_id = 'Assignments_uploads');

-- Policy: Allow authenticated users to delete files
CREATE POLICY "assignments_delete_policy"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'Assignments_uploads');

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;
