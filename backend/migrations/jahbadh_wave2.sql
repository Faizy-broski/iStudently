-- =============================================================
-- Jahbadh grades — Wave 2 (official outputs): student card fields and the second-round timetable.
-- =============================================================
-- Run after jahbadh_wave1_2026_2027.sql and jahbadh_grades_seed_2026_2027.sql. Safe to re-run.
--
-- Reused, not added:
--   • national ID («الرقم الوطني»)  → profiles.national_id (already on the platform).
--   • school number, «الكائنة بـ», exams coordinator, Hijri year, sub-office → jg_settings.header
--     (JSON keys school_number, located_at, exams_coordinator, hijri_year, sub_office).
--   • B/W, prediction and auto-notes card toggles → jg_report_card_settings.options (JSON).

BEGIN;

-- 1. Student fields printed on the official card (brief B6-24, B7) -----------------------------
-- «مستجد / معيد» and «صفة القيد» (نظامي / منازل). The guardian phone stays in students.custom_fields
-- (guardian_phone, written by the name import); daily attendance and homeroom teachers come from
-- jahbadh_wave2_data.sql.
ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_status TEXT
  CHECK (enrollment_status IS NULL OR enrollment_status IN ('مستجد', 'معيد'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS registration_type TEXT
  CHECK (registration_type IS NULL OR registration_type IN ('نظامي', 'منازل'));

-- 2. Second-round timetable (brief B6-18): filled once per grade and year, printed on the notices.
CREATE TABLE IF NOT EXISTS jg_round2_timetable (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  grade_code       SMALLINT NOT NULL CHECK (grade_code BETWEEN 1 AND 14),
  jg_subject_id    UUID NOT NULL REFERENCES jg_grade_subjects(id) ON DELETE CASCADE,
  exam_date        DATE,
  exam_time        TEXT,
  place            TEXT,
  updated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, academic_year_id, grade_code, jg_subject_id)
);
CREATE INDEX IF NOT EXISTS idx_jg_round2_timetable_year ON jg_round2_timetable(school_id, academic_year_id, grade_code);

-- Server-only access (the API checks the school); same as the other jg_* tables.
ALTER TABLE jg_round2_timetable ENABLE ROW LEVEL SECURITY;

COMMIT;
