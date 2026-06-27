-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own school folder
CREATE POLICY "Authenticated users can upload school assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'school-assets');

-- Allow public read access (images need to be publicly viewable)
CREATE POLICY "Public read access for school assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'school-assets');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated users can delete school assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'school-assets');
