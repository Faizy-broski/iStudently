-- Allow discipline referrals to be filed against staff/teachers in addition to students.
-- student_id becomes nullable; new columns person_type and staff_id are added.

ALTER TABLE discipline_referrals
  ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE discipline_referrals
  ADD COLUMN IF NOT EXISTS person_type TEXT NOT NULL DEFAULT 'student'
    CHECK (person_type IN ('student', 'staff', 'teacher')),
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
