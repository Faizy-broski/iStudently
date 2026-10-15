-- Let inspectors attach voice notes recorded on phones (the mobile app records .m4a; some
-- recorders produce .wav). The API (inspection-media.controller.ts) already accepts these and
-- checks the file bytes; the bucket's own MIME allow-list must match.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/wav']
where id = 'inspection-media';
