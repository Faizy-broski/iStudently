-- =============================================================
-- Jahbadh grades — Wave 2 (data workflows): daily attendance per stage, homeroom teachers.
-- =============================================================
-- Brief B6 #26 (daily attendance «الحضور اليومي») and B9 (homeroom view «grades.view_section»).
-- Name import (#25) and the rollover to next year (#29) need no new tables: the import writes the
-- platform's students/profiles, the rollover writes student_enrollment.rollover_status/next_grade_id.
--
-- Run after jahbadh_wave1_2026_2027.sql. Safe to re-run.

BEGIN;

-- 1. Daily attendance: one code per student per school day -----------------------
-- غ = unexcused absence, ع = excused absence, ت = late, ح = present (set by hand over a platform
-- absence). No row = take the platform's attendance for that day (attendance_records), else present.
-- Stage totals are written into jg_activity_records (excused_days / unexcused_days), which the
-- report cards already print.
CREATE TABLE IF NOT EXISTS jg_daily_attendance (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  att_date         DATE NOT NULL,
  code             TEXT NOT NULL CHECK (code IN ('غ', 'ع', 'ت', 'ح')),
  updated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, academic_year_id, att_date)
);
CREATE INDEX IF NOT EXISTS idx_jg_daily_att_section ON jg_daily_attendance(section_id, academic_year_id, att_date);

-- Calendar per school (root) and academic year: the day each stage starts (stage 3 NULL when the
-- grade has two stages), weekend days (0 = Sunday … 6 = Saturday; Libya: Friday + Saturday),
-- holidays skipped, and the unexcused-absence alert limit (workbook default 10).
CREATE TABLE IF NOT EXISTS jg_attendance_calendar (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  stage1_start     DATE,
  stage2_start     DATE,
  stage3_start     DATE,
  year_end         DATE,
  weekend_days     SMALLINT[] NOT NULL DEFAULT '{5,6}',
  holidays         DATE[] NOT NULL DEFAULT '{}',
  alert_limit      SMALLINT NOT NULL DEFAULT 10 CHECK (alert_limit >= 0),
  updated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, academic_year_id)
);

-- 2. Homeroom teachers («رائد الفصل»): read-only access to every subject of the section ---
CREATE TABLE IF NOT EXISTS jg_homeroom_teachers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  staff_id         UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  updated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_id, academic_year_id)
);
CREATE INDEX IF NOT EXISTS idx_jg_homeroom_staff ON jg_homeroom_teachers(staff_id, academic_year_id);

-- The API uses the service role; no client reads these tables directly.
ALTER TABLE jg_daily_attendance    ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_attendance_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_homeroom_teachers   ENABLE ROW LEVEL SECURITY;

COMMIT;
