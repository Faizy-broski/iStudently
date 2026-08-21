-- =========================================
-- Teacher Messaging Restriction
-- Run this in Supabase SQL Editor
-- =========================================
-- Admin-curated whitelist of staff members a teacher is allowed to message
-- (in addition to admins, who are always messageable, and students in the
-- teacher's own classes). Backs the "Teacher Messaging Permissions" admin
-- settings page and is enforced server-side in messaging.service.ts —
-- not just hidden in the UI.

CREATE TABLE IF NOT EXISTS teacher_message_allowed_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    UNIQUE(school_id, staff_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_message_allowed_staff_school
    ON teacher_message_allowed_staff(school_id);

ALTER TABLE teacher_message_allowed_staff ENABLE ROW LEVEL SECURITY;

-- Admins manage the list; the backend uses the service-role key for the
-- actual read during message-send validation, so this policy only needs to
-- cover the admin settings UI reading/writing through the normal client.
DROP POLICY IF EXISTS teacher_message_allowed_staff_admin ON teacher_message_allowed_staff;
CREATE POLICY teacher_message_allowed_staff_admin ON teacher_message_allowed_staff FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'super_admin' OR profiles.school_id = teacher_message_allowed_staff.school_id)
        )
    );

COMMENT ON TABLE teacher_message_allowed_staff IS 'Staff a teacher may message in addition to admins and their own students, curated by the school admin.';
